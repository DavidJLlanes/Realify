/* ═══════════════════════════════════════════════════════════════
   BRILLOS DE LA PIEL · MOTOR (puro, sin DOM)
   Encuentra los brillos (la luz baja de la piel muy por encima de la de su entorno) y los acerca al nivel de la piel, con una
   ganancia multiplicativa igual en los tres canales para no cambiar el tono. Ojos, cejas y labios no se tocan (zona excluida).
   Entradas: ctx { W, H, R, G, B, Y, F, piel } y { brillos_int 0-100 }. Salida: modifica ctx.R/G/B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { gaussMasked, smoothstep } from "../shared/blur.js";
import { channels, luma } from "../shared/planes.js";

export function stage(ctx, p){
  const int = (p.brillos_int ?? 0) / 100; if(int <= 0) return;
  const n = ctx.W * ctx.H;
  const low = gaussMasked(ctx.Y, ctx.piel, ctx.W, ctx.H, ctx.F * 0.015);
  const ref = gaussMasked(ctx.Y, ctx.piel, ctx.W, ctx.H, ctx.F * 0.15);       // el nivel de la piel en la zona
  const chs = channels(ctx), tono = chs.map(c => gaussMasked(c, ctx.piel, ctx.W, ctx.H, ctx.F * 0.15));   // color de la piel de alrededor: un brillo es casi blanco
  for(let i = 0; i < n; i++){
    if(ctx.piel[i] < 0.02 || low[i] <= 1e-4) continue;
    const exceso = low[i] / Math.max(ref[i], 1e-4), e = smoothstep(1.12, 1.7, exceso);
    if(e <= 0) continue;
    const g = 1 - int * e * ctx.piel[i] * (1 - Math.min(1, ref[i] * 1.1 / low[i]));
    const k = Math.min(1, int * e * ctx.piel[i] * 0.8);                       // al apagar el brillo, el color vuelve al de la piel
    for(let c = 0; c < 3; c++){ const v = chs[c][i] * g; chs[c][i] = v + k * (tono[c][i] / Math.max(ref[i], 1e-4) * ctx.Y[i] * g - v); }
  }
  luma(ctx);
}
