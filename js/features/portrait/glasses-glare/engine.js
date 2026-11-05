/* ═══════════════════════════════════════════════════════════════
   REFLEJOS EN GAFAS · MOTOR (puro, sin DOM)
   Dentro de la máscara de las gafas (modelo de partes refinado) encuentra los brillos especulares (mucho más claros que el cristal de
   alrededor) y los rellena con el cristal que los rodea, sin contar los propios brillos. No toca los ojos ni la montura fuera de los brillos.
   Entradas: ctx { W, H, R, G, B, Y, F, mascaras.gafas } y { gafas_int 0-100 }. Salida: modifica ctx.R/G/B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { gauss, gaussMasked, smoothstep } from "../shared/blur.js";
import { channels, luma } from "../shared/planes.js";

export function stage(ctx, p){
  const int = (p.gafas_int ?? 0) / 100, M = ctx.mascaras && ctx.mascaras.gafas; if(int <= 0 || !M) return;
  const { W, H, F } = ctx, n = W * H, lente = new Float32Array(n), brillo = new Float32Array(n);
  for(let i = 0; i < n; i++) lente[i] = M[i] > 0.4 ? 1 : 0;
  const ref = gaussMasked(ctx.Y, lente, W, H, F * 0.06);
  for(let i = 0; i < n; i++) brillo[i] = lente[i] * smoothstep(1.35, 2.4, ctx.Y[i] / Math.max(ref[i], 1e-3)) * (ctx.Y[i] > 0.25 ? 1 : 0);
  const b = gauss(brillo, W, H, Math.max(0.8, F * 0.006)), libre = new Float32Array(n);
  for(let i = 0; i < n; i++){ b[i] = Math.min(1, b[i] * 1.6) * M[i]; libre[i] = lente[i] * (1 - Math.min(1, b[i] * 2)); }
  for(const ch of channels(ctx)){
    const fondo = gaussMasked(ch, libre, W, H, F * 0.02);
    for(let i = 0; i < n; i++) if(b[i] > 0.02) ch[i] += int * b[i] * (fondo[i] - ch[i]);
  }
  luma(ctx);
}
