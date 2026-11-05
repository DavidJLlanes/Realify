/* ═══════════════════════════════════════════════════════════════
   RETRATO · DESENFOQUES EN COMA FLOTANTE (puro, sin DOM)
   Gaussiana por tres pasadas de caja (boxBlurFloat, la de «Refinar borde»), versión normalizada por máscara (el color de la piel sin
   contar lo que no es piel) y filtro guiado. Todo sobre Float32Array de un canal, valores en luz lineal 0-1.
   Entradas: matriz, ancho, alto, sigma en píxeles. Salida: matriz nueva del mismo tamaño.
   ═══════════════════════════════════════════════════════════════ */
import { boxBlurFloat, guidedFilterAlpha } from "../../../editor/selection/refineedge-math.js";

/** Radio de caja que tras tres pasadas da una gaussiana de desviación `sigma` (varianza = r·(r+1)). */
const radiusFor = sigma => Math.max(0, Math.round(Math.sqrt(sigma * sigma + 0.25) - 0.5));

export function gauss(src, w, h, sigma){
  const r = radiusFor(sigma);
  if(r < 1) return Float32Array.from(src);
  let a = boxBlurFloat(src, w, h, r);
  a = boxBlurFloat(a, w, h, r);
  return boxBlurFloat(a, w, h, r);
}

/** Gaussiana normalizada por pesos: sólo promedia donde `peso` > 0 (piel), sin arrastrar el color de ojos, pelo o fondo. */
export function gaussMasked(src, peso, w, h, sigma){
  const n = w * h, num = new Float32Array(n);
  for(let i = 0; i < n; i++) num[i] = src[i] * peso[i];
  const a = gauss(num, w, h, sigma), b = gauss(peso, w, h, sigma);
  for(let i = 0; i < n; i++) a[i] = b[i] > 1e-4 ? a[i] / b[i] : src[i];
  return a;
}

/** Paso bajo que respeta los bordes: filtro guiado por la luminancia (en raíz, más parecida a lo que ve el ojo). */
export function edgeLow(src, guia, w, h, radius, eps = 0.0016){
  return guidedFilterAlpha(guia, src, w, h, Math.max(1, radius | 0), eps);
}

export const smoothstep = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };
