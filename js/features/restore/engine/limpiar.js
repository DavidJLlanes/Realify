/* ═══════════════════════════════════════════════════════════════
   RESTAURAR · LIMPIAR PARA REALIFY (puro, sin DOM)
   Quita el ruido original antes de que Realify añada el grano propio de sensor: así no se suman dos ruidos. Estima el nivel de ruido
   (mediana de la desviación del laplaciano, robusta a bordes) y lo usa para fijar la fuerza: el color se limpia fuerte (filtro guiado por
   la luminancia, que no corre el color por los bordes) y la luminancia con un filtro guiado sobre sí misma cuyo epsilon es ∝ σ², de modo
   que las zonas planas se alisan y los bordes y la textura gruesa quedan. Entradas: planos (se modifican), valores { fuerza 0-100 }.
   Salida: el nivel de ruido estimado.
   ═══════════════════════════════════════════════════════════════ */
import { guidedFilterAlpha } from "../../../editor/selection/refineedge-math.js";

export const hayLimpieza = v => (v.fuerza || 0) > 0;

export function nivelRuido(Y, W, H){
  const d = []; for(let y = 1; y < H - 1; y += 2) for(let x = 1; x < W - 1; x += 2){ const i = y * W + x; d.push(Math.abs(4 * Y[i] - Y[i - 1] - Y[i + 1] - Y[i - W] - Y[i + W])); }
  d.sort((a, b) => a - b); return (d[d.length >> 1] || 0) / 0.6745 / 2.45;
}

export function limpiarRuido(p, v){
  const { W, H, R, G, B, Y } = p, n = W * H, f = Math.min(100, Math.max(0, v.fuerza || 0)) / 100;
  if(f <= 0) return 0;
  const g = new Float32Array(n), sg = new Float32Array(n); for(let i = 0; i < n; i++){ g[i] = Math.pow(Math.max(Y[i], 0), 1 / 2.2); }
  const sigma = nivelRuido(g, W, H), r = Math.max(2, Math.round(Math.max(W, H) / 700)), eps = Math.max(1e-6, (sigma * (1 + 2 * f)) ** 2);
  const yl = guidedFilterAlpha(g, g, W, H, r + 1, eps), cr = new Float32Array(n), cb = new Float32Array(n);
  for(let i = 0; i < n; i++){ cr[i] = R[i] - Y[i]; cb[i] = B[i] - Y[i]; }
  const crl = guidedFilterAlpha(g, cr, W, H, r * 3, eps * 4), cbl = guidedFilterAlpha(g, cb, W, H, r * 3, eps * 4);
  for(let i = 0; i < n; i++){
    const y1 = Math.pow(Math.max(0, g[i] + f * (yl[i] - g[i])), 2.2), y2 = Math.max(0, y1), a = cr[i] + f * (crl[i] - cr[i]), b = cb[i] + f * (cbl[i] - cb[i]);
    const rr = y2 + a, bb = y2 + b, gg = (y2 - 0.2126 * rr - 0.0722 * bb) / 0.7152;
    R[i] = Math.min(1, Math.max(0, rr)); B[i] = Math.min(1, Math.max(0, bb)); G[i] = Math.min(1, Math.max(0, gg));
  }
  for(let i = 0; i < n; i++) Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
  return sigma;
}
