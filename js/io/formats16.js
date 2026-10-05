/* ═══════════════════════════════════════════════════════════════
   PNG Y TIFF DE 16 BITS POR CANAL
   El lienzo del navegador sólo sabe codificar 8 bits por canal. Para
   no tirar la precisión de la exportación en coma flotante
   (core/precision-stack.js), estos dos codificadores escriben los
   16 bits tal cual:
     · PNG: RGB o RGBA de 16 bits, filtro «Sub» por fila y compresión
       zlib del propio navegador (CompressionStream), con fragmento sRGB.
     · TIFF: RGB o RGBA de 16 bits sin comprimir, intel (little-endian),
       una sola tira; con alfa, «ExtraSamples = alfa sin asociar».
   `img`: { data: Uint16Array (codificado), channels: 3|4, w, h, space }.
   Con `space: "display-p3"` se incrusta el perfil Display P3 (iCCP en
   PNG, etiqueta 34675 en TIFF) en vez de la etiqueta sRGB.
   ═══════════════════════════════════════════════════════════════ */

import { crc32 } from "./zip.js";
import { profileFor } from "../core/icc.js";
import { pngIccpChunk } from "./icc-embed.js";

export const png16Supported = () => typeof CompressionStream === "function";

function chunk(type, payload){
  const out = new Uint8Array(12 + payload.length), v = new DataView(out.buffer);
  v.setUint32(0, payload.length);
  for(let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  v.setUint32(8 + payload.length, crc32(out.subarray(4, 8 + payload.length)));
  return out;
}

export async function png16(img){
  if(!png16Supported()) throw new Error("Este navegador no puede comprimir PNG de 16 bits");
  const { data, channels: ch, w, h } = img;
  const bpp = ch * 2, stride = w * bpp;
  /* Filas con su byte de filtro: «Sub» (1) resta el píxel de la
     izquierda, que en degradados de 16 bits comprime mucho mejor que
     dejarlo sin filtrar. */
  const raw = new Uint8Array(h * (stride + 1));
  const row = new Uint8Array(stride);
  for(let y = 0; y < h; y++){
    let o = y * w * ch;
    for(let i = 0; i < stride; i += 2, o++){ const v = data[o]; row[i] = v >> 8; row[i + 1] = v & 255; }
    const base = y * (stride + 1);
    raw[base] = 1;
    for(let i = 0; i < stride; i++) raw[base + 1 + i] = (row[i] - (i >= bpp ? row[i - bpp] : 0)) & 255;
  }
  const zipped = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
  const ihdr = new Uint8Array(13), v = new DataView(ihdr.buffer);
  v.setUint32(0, w); v.setUint32(4, h);
  ihdr[8] = 16;                    // profundidad
  ihdr[9] = ch === 4 ? 6 : 2;      // RGBA o RGB
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const color = img.space === "display-p3" ? await pngIccpChunk("display-p3") : chunk("sRGB", new Uint8Array([0]));
  return new Blob([sig, chunk("IHDR", ihdr), color,
    chunk("IDAT", zipped), chunk("IEND", new Uint8Array(0))], { type: "image/png" });
}

export function tiff16(img){ return tiffWrite(img.data, img.channels, img.w, img.h, 16, img.space === "display-p3" ? profileFor("display-p3") : null); }

/** TIFF de 8 bits (RGBA sin asociar del lienzo) con el perfil de `space` si es Display P3 */
export function tiff8(rgba, w, h, space){ return tiffWrite(rgba, 4, w, h, 8, space === "display-p3" ? profileFor("display-p3") : null); }

function tiffWrite(data, ch, w, h, bits, icc){
  const B = bits / 8, tags = [];
  const tag = (id, type, count, value) => tags.push({ id, type, count, value });
  const nTags = (ch === 4 ? 15 : 14) + (icc ? 1 : 0);
  const ifd = 8, ifdSize = 2 + nTags * 12 + 4;
  const bpsOff = ifd + ifdSize, resOff = bpsOff + ((ch * 2 + 1) & ~1), iccOff = resOff + 16;
  const dataOff = (iccOff + (icc ? icc.length : 0) + 1) & ~1;
  const bytes = w * h * ch * B;
  tag(256, 4, 1, w);                       // ImageWidth
  tag(257, 4, 1, h);                       // ImageLength
  tag(258, 3, ch, bpsOff);                 // BitsPerSample
  tag(259, 3, 1, 1);                       // sin compresión
  tag(262, 3, 1, 2);                       // RGB
  tag(273, 4, 1, dataOff);                 // StripOffsets
  tag(274, 3, 1, 1);                       // Orientation
  tag(277, 3, 1, ch);                      // SamplesPerPixel
  tag(278, 4, 1, h);                       // RowsPerStrip
  tag(279, 4, 1, bytes);                   // StripByteCounts
  tag(282, 5, 1, resOff);                  // XResolution 72
  tag(283, 5, 1, resOff + 8);              // YResolution 72
  tag(284, 3, 1, 1);                       // PlanarConfiguration contigua
  tag(296, 3, 1, 2);                       // pulgadas
  if(ch === 4) tag(338, 3, 1, 2);          // ExtraSamples: alfa sin asociar
  if(icc) tag(34675, 7, icc.length, iccOff); // perfil ICC (Display P3)
  const buf = new ArrayBuffer(dataOff + bytes), v = new DataView(buf);
  v.setUint16(0, 0x4949); v.setUint16(2, 42, true); v.setUint32(4, ifd, true);
  v.setUint16(ifd, tags.length, true);
  tags.forEach((t, k) => {
    const p = ifd + 2 + k * 12;
    v.setUint16(p, t.id, true); v.setUint16(p + 2, t.type, true); v.setUint32(p + 4, t.count, true);
    if(t.type === 3 && t.count === 1) v.setUint16(p + 8, t.value, true); else v.setUint32(p + 8, t.value, true);
  });
  v.setUint32(ifd + 2 + tags.length * 12, 0, true);
  for(let k = 0; k < ch; k++) v.setUint16(bpsOff + k * 2, bits, true);
  v.setUint32(resOff, 72, true); v.setUint32(resOff + 4, 1, true);
  v.setUint32(resOff + 8, 72, true); v.setUint32(resOff + 12, 1, true);
  if(icc) new Uint8Array(buf, iccOff, icc.length).set(icc);
  (bits === 16 ? new Uint16Array(buf, dataOff, w * h * ch) : new Uint8Array(buf, dataOff, w * h * ch)).set(data);   // little-endian, como el resto del archivo
  return new Blob([buf], { type: "image/tiff" });
}
