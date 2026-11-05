/* ═══════════════════════════════════════════════════════════════
   ESCENA · QUITAR NEBLINA CON PROFUNDIDAD (puro, sin DOM)
   Modelo de la neblina I = J·t + A·(1−t). La luz atmosférica A sale de los puntos más brillantes del canal oscuro; la transmisión t sale de dos
   estimaciones que se mezclan: el canal oscuro (prior de He et al.) y la distancia del mapa de profundidad (la neblina crece con ella). t se
   afina con un filtro guiado por la luminancia para que no haya halos en los bordes. Se invierte en luz lineal. Entradas: planos (se modifican),
   profundidad d (1 = cerca, 0 = lejos; Float32 W×H) o null, valores { fuerza 0-100, profundidad 0-100 (peso de la distancia) }. Salida: nada.
   ═══════════════════════════════════════════════════════════════ */
import { guidedFilterAlpha } from "../../../editor/selection/refineedge-math.js";

export const hayNeblina = v => (v.fuerza || 0) > 0;

function minimo(src, W, H, r){
  const t = new Float32Array(W * H), o = new Float32Array(W * H);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ let m = 9; for(let k = Math.max(0, x - r); k <= Math.min(W - 1, x + r); k++) m = Math.min(m, src[y * W + k]); t[y * W + x] = m; }
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ let m = 9; for(let k = Math.max(0, y - r); k <= Math.min(H - 1, y + r); k++) m = Math.min(m, t[k * W + x]); o[y * W + x] = m; }
  return o;
}

export function luzAtmosferica(p){
  const { W, H, R, G, B } = p, n = W * H, dc = new Float32Array(n); for(let i = 0; i < n; i++) dc[i] = Math.min(R[i], G[i], B[i]);
  const m = minimo(dc, W, H, Math.max(2, Math.round(Math.max(W, H) / 200))), idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => m[b] - m[a]).slice(0, Math.max(10, n / 1000 | 0));
  let r = 0, g = 0, b = 0; for(const i of idx){ r += R[i]; g += G[i]; b += B[i]; }
  const c = idx.length; return [Math.max(0.4, r / c), Math.max(0.4, g / c), Math.max(0.4, b / c)];
}

export function quitarNeblina(p, d, v){
  const { W, H, R, G, B, Y } = p, n = W * H, f = Math.min(100, Math.max(0, v.fuerza || 0)) / 100, pd = d ? Math.min(100, Math.max(0, v.profundidad == null ? 50 : v.profundidad)) / 100 : 0;
  if(f <= 0) return;
  const A = luzAtmosferica(p), norm = new Float32Array(n);
  for(let i = 0; i < n; i++) norm[i] = Math.min(R[i] / A[0], G[i] / A[1], B[i] / A[2]);
  const dc = minimo(norm, W, H, Math.max(2, Math.round(Math.max(W, H) / 200))), t = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const tDcp = 1 - 0.95 * dc[i], tDep = d ? Math.exp(-1.6 * (1 - d[i])) : tDcp;
    t[i] = Math.min(1, Math.max(0.1, tDcp * (1 - pd) + tDep * pd));
  }
  const guia = new Float32Array(n); for(let i = 0; i < n; i++) guia[i] = Math.sqrt(Math.max(0, Y[i]));
  const tt = guidedFilterAlpha(guia, t, W, H, Math.max(6, Math.round(Math.max(W, H) / 60)), 0.001);
  for(let i = 0; i < n; i++){
    const ti = 1 - f * (1 - Math.min(1, Math.max(0.2, tt[i])));                                // fuerza 0 = sin cambio
    R[i] = Math.min(1, Math.max(0, (R[i] - A[0]) / ti + A[0])); G[i] = Math.min(1, Math.max(0, (G[i] - A[1]) / ti + A[1])); B[i] = Math.min(1, Math.max(0, (B[i] - A[2]) / ti + A[2]));
    Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
  }
}
