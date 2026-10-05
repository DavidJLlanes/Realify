/* ═══════════════════════════════════════════════════════════════
   REVELADO PREMIUM · salida
   · Enfoque de salida: al reducir el revelado al tamaño del documento
     se pierde algo de nitidez aparente; se devuelve con un enfoque
     suave de luminosidad (3×3), proporcional a cuánto se ha reducido y
     con límite de halo. Sólo cuando la salida es menor que el original.
   · TIFF de 16 bits por canal, RGB, sin compresión (lo abren Photoshop,
     Lightroom, GIMP, Affinity, darktable…), con los datos en sRGB.
   ═══════════════════════════════════════════════════════════════ */

import { profileFor } from "../../js/core/icc.js";

export function outputSharpen(canvas, scale){
  if(!(scale < 0.98)) return;
  const amount = Math.min(0.6, 0.15 + 0.6 * (1 - scale));
  const w = canvas.width, h = canvas.height, x = canvas.getContext("2d", { willReadFrequently: true });
  const img = x.getImageData(0, 0, w, h), d = img.data, Y = new Float32Array(w * h);
  for(let i = 0; i < w * h; i++) Y[i] = 0.2126 * d[i*4] + 0.7152 * d[i*4+1] + 0.0722 * d[i*4+2];
  for(let yy = 0; yy < h; yy++){
    const ym = Math.max(0, yy - 1), yp = Math.min(h - 1, yy + 1);
    for(let xx = 0; xx < w; xx++){
      const xm = Math.max(0, xx - 1), xp = Math.min(w - 1, xx + 1);
      const b = (Y[ym*w+xm] + 2 * Y[ym*w+xx] + Y[ym*w+xp] + 2 * Y[yy*w+xm] + 4 * Y[yy*w+xx] + 2 * Y[yy*w+xp] + Y[yp*w+xm] + 2 * Y[yp*w+xx] + Y[yp*w+xp]) / 16;
      const i = yy * w + xx, delta = Math.max(-8, Math.min(8, (Y[i] - b) * amount));
      d[i*4] += delta; d[i*4+1] += delta; d[i*4+2] += delta;
    }
  }
  x.putImageData(img, 0, 0);
}

/* Lo mismo sobre RGB de 16 bits (Uint16, entrelazado): la salida para
   «Abrir en Realify» con los 16 bits (fase 4). */
export function outputSharpen16(data, w, h, scale){
  if(!(scale < 0.98)) return;
  const amount = Math.min(0.6, 0.15 + 0.6 * (1 - scale)), lim = 8 * 257;
  const Y = new Float32Array(w * h);
  for(let i = 0; i < w * h; i++) Y[i] = 0.2126 * data[i*3] + 0.7152 * data[i*3+1] + 0.0722 * data[i*3+2];
  for(let yy = 0; yy < h; yy++){
    const ym = Math.max(0, yy - 1), yp = Math.min(h - 1, yy + 1);
    for(let xx = 0; xx < w; xx++){
      const xm = Math.max(0, xx - 1), xp = Math.min(w - 1, xx + 1);
      const b = (Y[ym*w+xm] + 2 * Y[ym*w+xx] + Y[ym*w+xp] + 2 * Y[yy*w+xm] + 4 * Y[yy*w+xx] + 2 * Y[yy*w+xp] + Y[yp*w+xm] + 2 * Y[yp*w+xx] + Y[yp*w+xp]) / 16;
      const i = yy * w + xx, delta = Math.max(-lim, Math.min(lim, (Y[i] - b) * amount));
      for(let c = 0; c < 3; c++){ const v = Math.round(data[i*3+c] + delta); data[i*3+c] = v < 0 ? 0 : v > 65535 ? 65535 : v; }
    }
  }
}

export function tiff16(pixels, width, height, space = "srgb"){
  const icc = space === "display-p3" ? profileFor("display-p3") : null;
  const entries = [];
  const tag = (id, type, count, value) => entries.push({ id, type, count, value });
  const dataSize = width * height * 6, nTags = 12 + (icc ? 1 : 0);
  const ifdOffset = 8, ifdSize = 2 + nTags * 12 + 4;
  const bpsOffset = ifdOffset + ifdSize, resOffset = bpsOffset + 8, iccOffset = resOffset + 16, dataOffset = (iccOffset + (icc ? icc.length : 0) + 1) & ~1;
  tag(256, 4, 1, width); tag(257, 4, 1, height);
  tag(258, 3, 3, bpsOffset);                    // BitsPerSample 16,16,16
  tag(259, 3, 1, 1);                            // sin compresión
  tag(262, 3, 1, 2);                            // RGB
  tag(273, 4, 1, dataOffset);                   // StripOffsets
  tag(277, 3, 1, 3);                            // SamplesPerPixel
  tag(278, 4, 1, height);                       // RowsPerStrip
  tag(279, 4, 1, dataSize);                     // StripByteCounts
  tag(282, 5, 1, resOffset); tag(283, 5, 1, resOffset + 8);
  tag(296, 3, 1, 2);                            // pulgadas
  if(icc) tag(34675, 7, icc.length, iccOffset); // perfil ICC (Display P3)
  const buf = new ArrayBuffer(dataOffset + dataSize), v = new DataView(buf);
  v.setUint16(0, 0x4949); v.setUint16(2, 42, true); v.setUint32(4, ifdOffset, true);
  v.setUint16(ifdOffset, nTags, true);
  entries.forEach((e, k) => {
    const p = ifdOffset + 2 + k * 12;
    v.setUint16(p, e.id, true); v.setUint16(p + 2, e.type, true); v.setUint32(p + 4, e.count, true);
    if(e.type === 3 && e.count === 1) v.setUint16(p + 8, e.value, true); else v.setUint32(p + 8, e.value, true);
  });
  v.setUint32(ifdOffset + 2 + nTags * 12, 0, true);
  for(let k = 0; k < 3; k++) v.setUint16(bpsOffset + k * 2, 16, true);
  v.setUint32(resOffset, 300, true); v.setUint32(resOffset + 4, 1, true); v.setUint32(resOffset + 8, 300, true); v.setUint32(resOffset + 12, 1, true);
  if(icc) new Uint8Array(buf, iccOffset, icc.length).set(icc);
  new Uint16Array(buf, dataOffset, width * height * 3).set(pixels);   // dataOffset es par: alineado
  return new Blob([buf], { type: "image/tiff" });
}
