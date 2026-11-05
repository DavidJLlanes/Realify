/* ═══════════════════════════════════════════════════════════════
   TEXTURA DE PIEL · MOTOR (puro, sin DOM)
   Mide cuánto detalle fino tiene cada punto de la piel y, sólo donde falta (piel demasiado lisa, típica de la IA), añade grano fino
   y poros: ruido determinista de banda limitada, multiplicativo (más visible en medios tonos) y modulado por el déficit local.
   Una piel que ya tiene textura no cambia. Entradas: ctx { W, H, R, G, B, Y, F, piel } y { textura_int 0-100, textura_poros 0-100 }.
   Salida: modifica ctx.R/G/B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { gauss, smoothstep } from "../shared/blur.js";
import { sqrtPlane, channels, luma } from "../shared/planes.js";
import { ruido } from "../shared/ruido.js";

/** Energía de detalle fino (desviación de la luminancia perceptual sin su desenfoque) en un entorno. */
export function detalleFino(ctx){
  const P = sqrtPlane(ctx.Y), b = gauss(P, ctx.W, ctx.H, Math.max(0.8, ctx.F * 0.0035)), e = new Float32Array(P.length);
  for(let i = 0; i < e.length; i++){ const d = P[i] - b[i]; e[i] = d * d; }
  const m = gauss(e, ctx.W, ctx.H, ctx.F * 0.025); for(let i = 0; i < m.length; i++) m[i] = Math.sqrt(m[i]);
  return m;
}

export function stage(ctx, p){
  const int = (p.textura_int ?? 0) / 100, poros = (p.textura_poros ?? 50) / 100; if(int <= 0) return;
  const n = ctx.W * ctx.H, det = detalleFino(ctx), OBJETIVO = 0.010;
  const grano = ruido(ctx.W, ctx.H, Math.max(0.6, ctx.F * 0.0016), 1), pr = ruido(ctx.W, ctx.H, Math.max(0.8, ctx.F * 0.0026), 2);
  const chs = channels(ctx);
  for(let i = 0; i < n; i++){
    if(ctx.piel[i] < 0.02) continue;
    const falta = smoothstep(0.25, 1, (OBJETIVO - det[i]) / OBJETIVO);        // 0 = ya tiene textura, 1 = lisa del todo
    if(falta <= 0) continue;
    const medios = 4 * Math.min(1, ctx.Y[i] * 2.2) * (1 - Math.min(1, ctx.Y[i] * 0.8)) + 0.2;
    const poro = Math.max(0, pr[i] - 1.1);                                    // puntos sueltos, sólo los picos del ruido
    const a = int * 0.05 * falta * ctx.piel[i] * Math.min(1, medios);
    const g = 1 + a * (grano[i] * 0.7 - poro * 2.4 * poros);
    for(let c = 0; c < 3; c++) chs[c][i] *= g;
  }
  luma(ctx);
}
