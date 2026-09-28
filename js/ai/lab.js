/* ═══════════════════════════════════════════════════════════════
   IA · COLOR LAB (sRGB D65)
   Lo usan «Colorear» y su worker: el modelo decide el COLOR (a, b) y
   la luminancia (L) se toma siempre de la foto original a tamaño
   completo, así que el resultado es tan nítido como el original.
   ═══════════════════════════════════════════════════════════════ */

const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const LIN = new Float32Array(256); for(let i = 0; i < 256; i++) LIN[i] = lin(i);
const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
const fi = t => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };
const enc = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; return (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255; };

/** RGB 8 bits → [L, a, b] */
export function rgbToLab(r, g, b){
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const x = f((R * .4124 + G * .3576 + B * .1805) / .95047), y = f(R * .2126 + G * .7152 + B * .0722), z = f((R * .0193 + G * .1192 + B * .9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/** Float RGB 0-1 → [L, a, b] (salidas de modelos) */
export function rgbfToLab(r, g, b){ return rgbToLab(Math.max(0, Math.min(255, r * 255)) | 0, Math.max(0, Math.min(255, g * 255)) | 0, Math.max(0, Math.min(255, b * 255)) | 0); }
/** [L, a, b] → RGB 8 bits */
export function labToRgb(L, a, b){
  const y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200;
  const X = fi(x) * .95047, Y = fi(y), Z = fi(z) * 1.08883;
  return [enc(X * 3.2406 + Y * -1.5372 + Z * -.4986), enc(X * -.9689 + Y * 1.8758 + Z * .0415), enc(X * .0557 + Y * -.2040 + Z * 1.0570)];
}
