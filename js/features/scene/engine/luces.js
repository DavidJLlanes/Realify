/* ═══════════════════════════════════════════════════════════════
   ESCENA · RECUPERAR LUCES (puro, sin DOM)
   Reconstruye canales recortados (valor máximo): la proporción de color de un píxel quemado se toma de sus vecinos sanos (promedio ponderado
   solo por los píxeles no recortados), la luz que le correspondería se deduce de los canales que sí se conservan, y el exceso se comprime
   con un hombro suave para no volver a recortar. Entradas: planos en luz lineal (se modifican), valores { fuerza 0-100, umbral 80-100 (% del
   valor máximo a partir del cual un canal cuenta como quemado) }. Salida: cuántos píxeles se tocaron.
   ═══════════════════════════════════════════════════════════════ */
import { gaussMasked, smoothstep, gauss } from "../../portrait/shared/blur.js";

export const hayLuces = v => (v.fuerza || 0) > 0;

export function recuperarLuces(p, v){
  const { W, H, R, G, B, Y } = p, n = W * H, f = Math.min(100, Math.max(0, v.fuerza || 0)) / 100, thr = Math.pow(Math.min(100, Math.max(80, v.umbral == null ? 98 : v.umbral)) / 100, 2.2);
  const quem = new Float32Array(n), sano = new Float32Array(n), rr = new Float32Array(n), bb = new Float32Array(n); let tocados = 0;
  for(let i = 0; i < n; i++){
    const m = Math.max(R[i], G[i], B[i]); quem[i] = m >= thr ? 1 : 0;
    if(m < thr * 0.97 && Y[i] > 0.02){ sano[i] = 1; rr[i] = R[i] / Y[i]; bb[i] = B[i] / Y[i]; }
  }
  const F = Math.sqrt(n), s0 = Math.max(3, F * 0.02), rb = new Float32Array(n), bg = new Float32Array(n), listo = new Uint8Array(n), peso = gauss(quem, W, H, 1.5);
  for(let e = 0; e < 5; e++){                                   // escalas crecientes: una zona quemada grande se rellena desde más lejos
    const s = s0 * 3 ** e, w = gauss(sano, W, H, s), a = gaussMasked(rr, sano, W, H, s), b = gaussMasked(bb, sano, W, H, s);
    for(let i = 0; i < n; i++) if(!listo[i] && w[i] > 0.01){ rb[i] = a[i]; bg[i] = b[i]; listo[i] = 1; }
  }
  for(let i = 0; i < n; i++){
    if(quem[i] === 0 && peso[i] < 0.02) continue;
    const w = f * Math.min(1, peso[i] * 1.5 + quem[i]); if(w <= 0.01) continue;
    const cr = rb[i] > 0 ? rb[i] : 1, cb = bg[i] > 0 ? bg[i] : 1, cg = Math.max(0.05, (1 - 0.2126 * cr - 0.0722 * cb) / 0.7152), c = [cr, cg, cb], v0 = [R[i], G[i], B[i]];
    let Yest = Y[i], hay = false;
    for(let q = 0; q < 3; q++) if(v0[q] < thr * 0.97 && c[q] > 0.05){ Yest = Math.max(Yest, v0[q] / c[q]); hay = true; }
    if(!hay) Yest = Y[i] * 1.25;
    const nuevo = c.map((k, q) => Math.max(v0[q], k * Yest)); let m = Math.max(...nuevo);
    if(m > thr){ const hombro = thr + (1 - thr) * (1 - Math.exp(-(m - thr) / (1 - thr))); const s2 = hombro / m; for(let q = 0; q < 3; q++) nuevo[q] *= s2; }
    R[i] += w * (nuevo[0] - R[i]); G[i] += w * (nuevo[1] - G[i]); B[i] += w * (nuevo[2] - B[i]); tocados++;
  }
  for(let i = 0; i < n; i++) Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
  return tocados;
}
