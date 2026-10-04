/* ═══════════════════════════════════════════════════════════════
   CLAHE · CONTRASTE LOCAL ADAPTATIVO (fase 8) · matemática pura
   Ecualización de histograma por mosaicos con límite de contraste
   (Zuiderveld): la imagen se reparte en una cuadrícula, cada mosaico
   tiene su propia curva de ecualización, recortada para que no
   dispare el ruido, y cada punto mezcla las curvas de los cuatro
   mosaicos más cercanos (interpolación bilineal): sin costuras.
   Sin DOM: la usan el ajuste y las pruebas en Node.
   ═══════════════════════════════════════════════════════════════ */

/**
 * @param L     luminosidad 0-1 (Float32Array w×h)
 * @param opts  tilesX, tilesY (cuadrícula), clip (múltiplo del histograma plano:
 *              1 = sin contraste añadido, 2-4 habitual), bins (256 o más)
 * @returns Float32Array con la luminosidad ecualizada localmente (0-1)
 */
export function claheMap(L, w, h, { tilesX = 8, tilesY = 8, clip = 3, bins = 256 } = {}){
  tilesX = Math.max(1, Math.min(tilesX, w)); tilesY = Math.max(1, Math.min(tilesY, h));
  const tw = w / tilesX, th = h / tilesY, luts = new Float32Array(tilesX * tilesY * bins);
  const hist = new Float64Array(bins);
  for(let ty = 0; ty < tilesY; ty++) for(let tx = 0; tx < tilesX; tx++){
    hist.fill(0);
    const x0 = Math.floor(tx * tw), x1 = Math.floor((tx + 1) * tw), y0 = Math.floor(ty * th), y1 = Math.floor((ty + 1) * th);
    let n = 0;
    for(let y = y0; y < y1; y++){ const o = y * w; for(let x = x0; x < x1; x++){ let b = (L[o + x] * bins) | 0; if(b < 0) b = 0; else if(b >= bins) b = bins - 1; hist[b]++; n++; } }
    if(!n) continue;
    // Recorte y reparto uniforme del exceso (repetido: el reparto puede volver a pasar el límite)
    const limit = Math.max(1, clip * n / bins);
    for(let it = 0; it < 4; it++){
      let excess = 0;
      for(let b = 0; b < bins; b++) if(hist[b] > limit){ excess += hist[b] - limit; hist[b] = limit; }
      if(excess < 1e-6) break;
      const add = excess / bins; for(let b = 0; b < bins; b++) hist[b] += add;
    }
    // Curva = distribución acumulada (centrada en cada casilla, para que una imagen plana no se desplace)
    const o = (ty * tilesX + tx) * bins; let cum = 0, tot = 0;
    for(let b = 0; b < bins; b++) tot += hist[b];
    for(let b = 0; b < bins; b++){ luts[o + b] = (cum + 0.5 * hist[b]) / tot; cum += hist[b]; }
  }
  const out = new Float32Array(w * h);
  // Posición de cada columna/fila respecto a los centros de mosaico
  const colT = new Int32Array(w), colF = new Float32Array(w), rowT = new Int32Array(h), rowF = new Float32Array(h);
  for(let x = 0; x < w; x++){ const g = Math.min(tilesX - 1, Math.max(0, (x + 0.5) / tw - 0.5)); const i = Math.min(tilesX - 2 < 0 ? 0 : tilesX - 2, g | 0); colT[x] = i; colF[x] = tilesX === 1 ? 0 : g - i; }
  for(let y = 0; y < h; y++){ const g = Math.min(tilesY - 1, Math.max(0, (y + 0.5) / th - 0.5)); const j = Math.min(tilesY - 2 < 0 ? 0 : tilesY - 2, g | 0); rowT[y] = j; rowF[y] = tilesY === 1 ? 0 : g - j; }
  const dx = tilesX > 1 ? 1 : 0, dy = tilesY > 1 ? 1 : 0, S = bins - 1;
  for(let y = 0; y < h; y++){
    const j = rowT[y], fy = rowF[y], r0 = j * tilesX, r1 = (j + dy) * tilesX;
    for(let x = 0; x < w; x++){
      const l = L[y * w + x], pos = Math.min(S, Math.max(0, l * bins - 0.5)), b0 = pos | 0, b1 = b0 < S ? b0 + 1 : b0, fb = pos - b0, i = colT[x], fx = colF[x];
      const o00 = (r0 + i) * bins, o10 = (r0 + i + dx) * bins, o01 = (r1 + i) * bins, o11 = (r1 + i + dx) * bins;
      const v00 = luts[o00 + b0] + (luts[o00 + b1] - luts[o00 + b0]) * fb, v10 = luts[o10 + b0] + (luts[o10 + b1] - luts[o10 + b0]) * fb;
      const v01 = luts[o01 + b0] + (luts[o01 + b1] - luts[o01 + b0]) * fb, v11 = luts[o11 + b0] + (luts[o11 + b1] - luts[o11 + b0]) * fb;
      out[y * w + x] = (v00 + (v10 - v00) * fx) * (1 - fy) + (v01 + (v11 - v01) * fx) * fy;
    }
  }
  return out;
}

/* ── OKLab ───────────────────────────────────────────────────── */
export const DEC = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; DEC[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
export const enc = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };

export function linToOklab(r, g, b, out){
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  out[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return out;
}
export function oklabToLin(L, a, b, out){
  const l = L + 0.3963377774 * a + 0.2158037573 * b, m = L - 0.1055613458 * a - 0.0638541728 * b, s = L - 0.0894841775 * a - 1.291485548 * b, l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;
  out[0] = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  out[1] = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  out[2] = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  return out;
}
/** Lleva (L, a, b) a RGB lineal dentro de gama reduciendo el croma lo justo (con L fija). */
export function oklabToLinInGamut(L, a, b, out){
  oklabToLin(L, a, b, out);
  if(out[0] >= 0 && out[0] <= 1 && out[1] >= 0 && out[1] <= 1 && out[2] >= 0 && out[2] <= 1) return out;
  let lo = 0, hi = 1;
  for(let i = 0; i < 12; i++){ const t = (lo + hi) / 2; oklabToLin(L, a * t, b * t, out); if(out[0] >= -1e-4 && out[0] <= 1.0001 && out[1] >= -1e-4 && out[1] <= 1.0001 && out[2] >= -1e-4 && out[2] <= 1.0001) lo = t; else hi = t; }
  return oklabToLin(L, a * lo, b * lo, out);
}
