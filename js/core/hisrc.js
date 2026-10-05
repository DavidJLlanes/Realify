/* ═══════════════════════════════════════════════════════════════
   ORIGEN DE ALTA PROFUNDIDAD DE UNA CAPA (fase 4 de PENDIENTE.md)

   Las capas del documento son lienzos de 8 bits. Cuando la foto llega
   con más (RAW revelado, PNG o TIFF de 16 bits, AVIF de 10/12 bits), la
   capa base guarda además esos datos tal cual: `layer.hiSrc` =
   { data: Uint16Array RGB entrelazado (0-65535, mismo espacio que el
   lienzo), w, h, dither }.

   El lienzo de 8 bits es exactamente el redondeo de esos datos (el de un
   RAW, con un tramado que sólo depende de la posición), así que
   el motor de exportación en coma flotante (core/precision-stack.js)
   puede decidir PÍXEL A PÍXEL: si el lienzo sigue valiendo lo mismo que
   el redondeo del origen, ese píxel no se ha tocado y se usan sus 16
   bits; si se ha pintado, clonado o filtrado encima, el lienzo manda.
   No hace falta seguir cada herramienta: deshacer devuelve el píxel al
   origen y vuelve a contar con sus 16 bits.

   Si la capa cambia de tamaño (recortar, girar, cambiar el tamaño del
   documento) el origen deja de corresponder y se descarta.
   ═══════════════════════════════════════════════════════════════ */

const q8 = v => (v + 128) / 257 | 0;   // 0-65535 → 0-255 redondeado

/* Tramado determinista (el mismo ruido que la salida de 8 bits del
   revelador Premium, raw/premium/cpu.js): el lienzo de 8 bits de un RAW
   no muestra bandas, y como sólo depende de la posición, se puede
   recalcular para saber si un píxel sigue sin tocar. */
const dith = (x, y, c) => {
  let h = Math.imul(x * 3 + c + 0x2545f491, 0x9e3779b1) ^ Math.imul(y + 0x6a09e667, 0x85ebca77);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return ((h & 1023) + 0.5) / 1024 - 0.5;
};
const d8 = (v, x, y, c) => { const r = Math.round(v * (255 / 65535) + dith(x, y, c)); return r < 0 ? 0 : r > 255 ? 255 : r; };

/** Valor de 8 bits del lienzo para un valor de 16 bits en (x, y) del origen: el mismo redondeo (con
    tramado si el origen lo lleva) que usa `fillBand` para saber si un píxel sigue sin tocar. */
export const hiToCanvas8 = (v, x, y, c, dither) => dither ? d8(v, x, y, c) : q8(v);

/** ¿Cabe un origen de w×h en la memoria de este equipo? Ocupa 6 bytes
    por píxel: hasta 12 MP (72 MB) en móviles, 32 MP en ordenador (el
    mismo tope que la exportación en coma flotante). */
export function hiAllowed(w, h){
  const mem = navigator.deviceMemory || 8;
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  return w * h <= ((coarse || mem <= 4) ? 12e6 : 32e6);
}

/** Remuestrea RGB de 16 bits a W×H promediando áreas en luz lineal
    (para cuando la foto se abre reducida). */
export function resizeHi(data, w, h, W, H){
  if(w === W && h === H) return data;
  const lin = new Float32Array(65536);
  for(let i = 0; i < 65536; i++){ const v = i / 65535; lin[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  const enc = v => { v = v <= 0 ? 0 : v >= 1 ? 1 : v; return Math.round(65535 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); };
  const out = new Uint16Array(W * H * 3), sx = w / W, sy = h / H;
  const acc = new Float64Array(3);
  for(let Y = 0; Y < H; Y++){
    const y0 = Y * sy, y1 = Math.min(h, y0 + sy);
    for(let X = 0; X < W; X++){
      const x0 = X * sx, x1 = Math.min(w, x0 + sx);
      acc[0] = acc[1] = acc[2] = 0; let wsum = 0;
      for(let y = Math.floor(y0); y < Math.ceil(y1); y++){
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for(let x = Math.floor(x0); x < Math.ceil(x1); x++){
          const k = wy * (Math.min(x + 1, x1) - Math.max(x, x0)), i = (y * w + x) * 3;
          acc[0] += lin[data[i]] * k; acc[1] += lin[data[i + 1]] * k; acc[2] += lin[data[i + 2]] * k; wsum += k;
        }
      }
      const o = (Y * W + X) * 3;
      out[o] = enc(acc[0] / wsum); out[o + 1] = enc(acc[1] / wsum); out[o + 2] = enc(acc[2] / wsum);
    }
  }
  return out;
}

/** Lienzo de 8 bits (opaco, sRGB) con los datos de 16 bits tramados
    (el revelado RAW, que sale en sRGB). */
export function canvasFromHi(data, w, h, space = "srgb"){
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true, colorSpace: space, forceSrgb: space === "srgb" });
  const img = x.createImageData(w, h), d = img.data;
  for(let y = 0, i = 0; y < h; y++) for(let xx = 0; xx < w; xx++, i++){
    const o = i * 4, j = i * 3;
    d[o] = d8(data[j], xx, y, 0); d[o + 1] = d8(data[j + 1], xx, y, 1); d[o + 2] = d8(data[j + 2], xx, y, 2); d[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

/** Asocia un origen de 16 bits a una capa cuyo lienzo YA es su versión
    tramada (la ha pintado canvasFromHi). */
export function attachHi(layer, data, w, h){
  if(!layer || layer.canvas.width !== w || layer.canvas.height !== h || !hiAllowed(w, h)){ return false; }
  layer.hiSrc = { data, w, h, dither: true, x:0, y:0, canvasW:w, canvasH:h };
  return true;
}

/** Compara los 16 bits decodificados por Realify con la imagen que ha
    decodificado el navegador (`image`, a tamaño completo), que sí aplica
    el perfil de color del archivo. Coinciden si la diferencia media es
    menor de 0,6 niveles y casi todos los píxeles opacos quedan a ±1,5
    (AVIF: el navegador pasa de YUV a RGB con otro redondeo y difiere
    hasta 1 nivel de media; se le da algo más de margen).
    Se compara por franjas para no duplicar la memoria. */
export function matchesImage(image, data, w, h, { mean = 0.6, worst: worstMax = 1.5, far: farMax = 0.01 } = {}){
  if(image.width !== w || image.height !== h) return false;
  const rows = Math.max(1, Math.floor(2e6 / w));
  const c = document.createElement("canvas"); c.width = w; c.height = rows;
  const x = c.getContext("2d", { willReadFrequently: true });
  let sum = 0, far = 0, n = 0;
  for(let y0 = 0; y0 < h; y0 += rows){
    const bh = Math.min(rows, h - y0);
    x.clearRect(0, 0, w, rows);
    x.drawImage(image, 0, y0, w, bh, 0, 0, w, bh);
    const d = x.getImageData(0, 0, w, bh).data;
    for(let i = 0; i < w * bh; i++){
      const o = i * 4;
      if(d[o + 3] < 255) continue;   // con transparencia el navegador premultiplica: no sirve de referencia
      const j = (y0 * w + i) * 3;
      let worst = 0;
      for(let k = 0; k < 3; k++){ const e = Math.abs(d[o + k] - data[j + k] / 257); sum += e; if(e > worst) worst = e; }
      if(worst > worstMax) far++;
      n++;
    }
  }
  return n > 0 && sum / (3 * n) <= mean && far / n <= farMax;
}

/** Pinta en la capa el redondeo de los 16 bits (sólo en los píxeles
    opacos: los transparentes se quedan como los dejó el navegador) y le
    asocia el origen. */
export function adoptHi(layer, data, w, h){
  if(!layer || layer.canvas.width !== w || layer.canvas.height !== h || !hiAllowed(w, h)) return false;
  const x = layer.ctx, img = x.getImageData(0, 0, w, h), d = img.data;
  for(let i = 0, j = 0; i < w * h; i++, j += 3){
    const o = i * 4;
    if(d[o + 3] < 255) continue;
    d[o] = q8(data[j]); d[o + 1] = q8(data[j + 1]); d[o + 2] = q8(data[j + 2]);
  }
  x.putImageData(img, 0, 0);
  layer.hiSrc = { data, w, h, x:0, y:0, canvasW:w, canvasH:h };
  layer.thumbDirty = true;
  return true;
}

/** Banda de la capa en Float32 premultiplicado (0-1), con los 16 bits de
    origen en los píxeles que no se han tocado. `d` es la banda de 8 bits
    (RGBA) ya leída del lienzo. Devuelve cuántos píxeles usaron 16 bits. */
export function fillBand(layer, d, out, y0, w, bh){
  /* Si la capa cambió de tamaño el origen no corresponde: se IGNORA, pero no se borra —deshacer esa operación
     devuelve el lienzo a su tamaño y con él los 16 bits—. */
  const hs = layer.hiSrc;
  const matches = !!hs && (hs.canvasW || hs.w) === layer.canvas.width && (hs.canvasH || hs.h) === layer.canvas.height;
  const hi = matches ? hs : null, ox = hi ? (hi.x || 0) : 0, oy = hi ? (hi.y || 0) : 0;
  let used = 0;
  for(let i = 0, p = 0; i < d.length; i += 4, p++){
    const a = d[i + 3] / 255;
    if(a <= 0) continue;
    let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    if(hi){
      const cx = p % w, cy = y0 + (p / w | 0), sx = cx - ox, sy = cy - oy;
      if(sx >= 0 && sy >= 0 && sx < hi.w && sy < hi.h){
        const j = (sy * hi.w + sx) * 3, R = hi.data[j], G = hi.data[j + 1], B = hi.data[j + 2];
        let same;
        if(hi.dither) same = d8(R, sx, sy, 0) === d[i] && d8(G, sx, sy, 1) === d[i + 1] && d8(B, sx, sy, 2) === d[i + 2];
        else same = q8(R) === d[i] && q8(G) === d[i + 1] && q8(B) === d[i + 2];
        if(same){ r = R / 65535; g = G / 65535; b = B / 65535; used++; }
      }
    }
    out[i] = r * a; out[i + 1] = g * a; out[i + 2] = b * a; out[i + 3] = a;
  }
  return used;
}

/** Rectángulo del lienzo que cubre el origen de 16 bits de la capa ({ x, y, w, h }), o null si no sirve: no corresponde al lienzo
    (cambió de tamaño) o se sale de él. Puede ser el lienzo entero (lo habitual) o sólo una parte (recortado o desplazado). */
export function hiRect(layer){
  const hs = layer?.hiSrc;
  if(!hs || !hs.data) return null;
  const W = layer.canvas.width, H = layer.canvas.height, x = hs.x || 0, y = hs.y || 0;
  if((hs.canvasW || hs.w) !== W || (hs.canvasH || hs.h) !== H) return null;
  if(x < 0 || y < 0 || hs.w < 1 || hs.h < 1 || x + hs.w > W || y + hs.h > H || hs.data.length < hs.w * hs.h * 3) return null;
  return { x, y, w: hs.w, h: hs.h };
}

/** ¿El origen de 16 bits de la capa corresponde a su lienzo y lo cubre entero? (única forma que sabe mover remapHi) */
export function hiCoversCanvas(layer){
  const hs = layer?.hiSrc, c = layer?.canvas;
  return !!hs && !!hs.data && !!c && hs.w === c.width && hs.h === c.height && (hs.canvasW || hs.w) === c.width && (hs.canvasH || hs.h) === c.height && !(hs.x || 0) && !(hs.y || 0);
}

/**
 * Lleva el origen de 16 bits de una capa a su lienzo NUEVO tras mover píxeles sin cambiarlos (girar, voltear, recortar,
 * ampliar el lienzo, y sus inversas al deshacer). `inv(nx, ny)` da el índice (fila·ancho + columna) del píxel de
 * origen en el lienzo anterior, o -1 si el píxel nuevo no viene de ninguno (zona añadida). `oldData`: los píxeles de
 * 8 bits del lienzo anterior (RGBA), para saber qué píxeles seguían siendo el redondeo de sus 16 bits (los pintados
 * encima no lo son y se quedan como están). La capa ya debe llevar su lienzo nuevo, que se vuelve a tramar en su
 * sitio nuevo en los píxeles sin tocar (el tramado depende de la posición). Devuelve el origen nuevo o null.
 */
export function remapHi(layer, oldData, oW, oH, inv){
  const hs = layer?.hiSrc;
  if(!hs || !hs.data || hs.w !== oW || hs.h !== oH || (hs.canvasW || hs.w) !== oW || (hs.canvasH || hs.h) !== oH || (hs.x || 0) || (hs.y || 0)) return null;
  const nW = layer.canvas.width, nH = layer.canvas.height;
  if(nW * nH > 64e6) return null;
  const src = hs.data, out = new Uint16Array(nW * nH * 3), dither = !!hs.dither;
  const cx = layer.ctx, img = dither ? cx.getImageData(0, 0, nW, nH) : null;
  const d = img ? img.data : null;
  let patched = false;
  for(let ny = 0, i = 0; ny < nH; ny++) for(let nx = 0; nx < nW; nx++, i++){
    const o = inv(nx, ny), j = i * 3;
    if(o < 0){
      // zona añadida: lo que haya en el lienzo (si es transparente, sin color)
      if(d && d[i * 4 + 3]){ out[j] = d[i * 4] * 257; out[j + 1] = d[i * 4 + 1] * 257; out[j + 2] = d[i * 4 + 2] * 257; }
      continue;
    }
    const p = o * 3, R = src[p], G = src[p + 1], B = src[p + 2];
    out[j] = R; out[j + 1] = G; out[j + 2] = B;
    if(!dither) continue;                 // el redondeo no depende del sitio: el lienzo ya vale
    const q = o * 4;
    if(oldData[q + 3] === 0) continue;
    const oy = (o / oW) | 0, ox = o - oy * oW;
    if(d8(R, ox, oy, 0) === oldData[q] && d8(G, ox, oy, 1) === oldData[q + 1] && d8(B, ox, oy, 2) === oldData[q + 2]){
      const k = i * 4;
      d[k] = d8(R, nx, ny, 0); d[k + 1] = d8(G, nx, ny, 1); d[k + 2] = d8(B, nx, ny, 2);
      patched = true;
    }
  }
  if(patched) cx.putImageData(img, 0, 0);
  return { ...hs, data: out, w: nW, h: nH, x: 0, y: 0, canvasW: nW, canvasH: nH };
}

/** ¿Tiene el documento alguna capa visible con origen de alta profundidad? */
export const docHasHi = layers => layers.some(l => {
  if(!l.visible || !l.hiSrc) return false;
  const h=l.hiSrc;
  return (h.canvasW || h.w) === l.canvas.width && (h.canvasH || h.h) === l.canvas.height;
});
