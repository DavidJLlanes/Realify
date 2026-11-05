/* ═══════════════════════════════════════════════════════════════
   SELECCIÓN RÁPIDA · MOTOR (puro, sin DOM)
   Lo que hace falta para elegir las mejores fotos de una tanda: hash perceptual de diferencias (dHash, 64 bits) y su distancia de Hamming,
   agrupación de duplicados o ráfagas, ojos cerrados con la proporción de apertura (EAR) de los puntos de la cara, puntuación 0-100 de cada
   foto (nitidez, exposición, ojos y composición) y el mejor de cada grupo. Sin modelos aquí: los puntos de la cara y el mapa de importancia
   los da quien llama (plugins/culling/analisis.js).
   Entradas: lado 9×8 de luminancia (Float32Array 72), puntos de la cara (478 × [x,y]), medidas { nitidez, pasos, quemado, negro }.
   Salidas: dHash() → texto hex de 16 cifras, hamming(a,b), grupos(hashes, umbral), ojosCerrados(pts), puntuar(m), mejores(fotos, grupos).
   ═══════════════════════════════════════════════════════════════ */

export function dHash(g72){
  let hi = 0, lo = 0;
  for(let y = 0; y < 8; y++) for(let x = 0; x < 8; x++){
    const bit = g72[y * 9 + x] > g72[y * 9 + x + 1] ? 1 : 0, k = y * 8 + x;
    if(k < 32) hi = (hi * 2 + bit) >>> 0; else lo = (lo * 2 + bit) >>> 0;
  }
  return hi.toString(16).padStart(8, "0") + lo.toString(16).padStart(8, "0");
}

const pop = v => { v = v - ((v >>> 1) & 0x55555555); v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
export const hamming = (a, b) => pop((parseInt(a.slice(0, 8), 16) ^ parseInt(b.slice(0, 8), 16)) >>> 0) + pop((parseInt(a.slice(8), 16) ^ parseInt(b.slice(8), 16)) >>> 0);

/** Grupos de fotos casi iguales (distancia ≤ umbral, transitiva). Devuelve listas de índices con 2 o más fotos. */
export function grupos(hashes, umbral = 10){
  const p = hashes.map((_, i) => i), raiz = i => { while(p[i] !== i){ p[i] = p[p[i]]; i = p[i]; } return i; };
  for(let i = 0; i < hashes.length; i++) for(let j = i + 1; j < hashes.length; j++) if(hashes[i] && hashes[j] && hamming(hashes[i], hashes[j]) <= umbral) p[raiz(i)] = raiz(j);
  const m = new Map(); hashes.forEach((_, i) => { const r = raiz(i); if(!m.has(r)) m.set(r, []); m.get(r).push(i); });
  return [...m.values()].filter(g => g.length > 1);
}

const OJO_D = [33, 160, 158, 133, 153, 144], OJO_I = [362, 385, 387, 263, 373, 380];
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const apertura = (pts, o) => (d2(pts[o[1]], pts[o[5]]) + d2(pts[o[2]], pts[o[4]])) / (2 * Math.max(1e-6, d2(pts[o[0]], pts[o[3]])));

/** true si algún ojo está cerrado (apertura < 0,15); null si no hay puntos. */
export function ojosCerrados(pts){
  if(!pts || pts.length < 400) return null;
  return Math.min(apertura(pts, OJO_D), apertura(pts, OJO_I)) < 0.15;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Puntuación 0-100 y motivos. m = { nitidez (laplaciano), pasos (rango dinámico), quemado, negro (fracciones), ojos (true/false/null), compo (0-1 o null) }. */
export function puntuar(m){
  const nit = clamp(Math.log10(1 + Math.max(0, m.nitidez)) / Math.log10(1 + 600), 0, 1);
  const exp = clamp(1 - (Math.max(0, m.quemado - 0.01) * 6 + Math.max(0, m.negro - 0.03) * 4), 0, 1) * clamp((m.pasos - 3) / 5, 0.3, 1);
  const motivos = [];
  if(nit < 0.35) motivos.push("desenfocada");
  if(m.quemado > 0.04) motivos.push("luces quemadas");
  if(m.negro > 0.08) motivos.push("sombras tapadas");
  if(m.ojos === true) motivos.push("ojos cerrados");
  let s = 100 * (0.5 * nit + 0.3 * exp + 0.2 * (m.compo == null ? 0.6 : m.compo));
  if(m.ojos === true) s *= 0.55;
  return { puntos: Math.round(clamp(s, 0, 100)), motivos };
}

/** Para cada grupo, el índice de la mejor foto (más puntos). */
export const mejores = (puntos, gr) => gr.map(g => g.reduce((b, i) => puntos[i] > puntos[b] ? i : b, g[0]));

/** Centralidad 0-1 de un mapa de importancia: cercanía del centro de masa al punto de tercios más próximo. */
export function composicion(imp, gw, gh){
  let s = 0, cx = 0, cy = 0; for(let y = 0; y < gh; y++) for(let x = 0; x < gw; x++){ const v = imp[y * gw + x]; s += v; cx += v * x; cy += v * y; }
  if(s < 1e-6) return null;
  cx = cx / s / gw; cy = cy / s / gh;
  const d = Math.min(...[1 / 3, 2 / 3].flatMap(a => [1 / 3, 2 / 3].map(b => Math.hypot(cx - a, cy - b))), Math.hypot(cx - 0.5, cy - 0.5) + 0.05);
  return clamp(1 - d / 0.45, 0, 1);
}
