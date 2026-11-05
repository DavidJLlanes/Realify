/* ═══════════════════════════════════════════════════════════════
   PELOS SUELTOS · MOTOR (puro, sin DOM)
   Busca líneas finas (claras u oscuras) en la franja que rodea al pelo, FUERA de la persona, con un filtro de crestas, y las rellena con el
   fondo de alrededor (convolución normalizada que no cuenta los propios pelos). Sólo toca el fondo: el pelo del peinado y la piel no
   se tocan. Entradas: ctx { W, H, R, G, B, Y, F, mascaras.persona } y { pelos_int 0-100 }. Salida: modifica ctx.R/G/B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { gauss, gaussMasked, smoothstep } from "../shared/blur.js";
import { ridgeStrength } from "../shared/ridges.js";
import { sqrtPlane, channels, luma } from "../shared/planes.js";

export function stage(ctx, p){
  const int = (p.pelos_int ?? 0) / 100, P = ctx.mascaras && ctx.mascaras.persona; if(int <= 0 || !P) return;
  const { W, H, F } = ctx, n = W * H;
  const Ys = sqrtPlane(ctx.Y), neg = Ys.map(v => 1 - v), esc = [F * 0.004, F * 0.007];
  const A = ridgeStrength(Ys, W, H, esc, 0.01), Bc = ridgeStrength(neg, W, H, esc, 0.01);
  const cerca = gauss(ctx.mascaras.pelo || P, W, H, F * 0.1), m = new Float32Array(n), libre = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const fuera = 1 - smoothstep(0.35, 0.75, P[i]), franja = smoothstep(0.02, 0.12, cerca[i]);       // fuera de la persona y cerca de su pelo
    m[i] = smoothstep(0.2, 0.55, Math.max(A[i], Bc[i])) * fuera * franja;
  }
  const mm = gauss(m, W, H, Math.max(1.2, F * 0.008));                   // un poco más ancha que el pelo: así el relleno no cuenta su sombra
  for(let i = 0; i < n; i++){ mm[i] = Math.min(1, mm[i] * 3); libre[i] = (1 - mm[i]) * (1 - smoothstep(0.35, 0.75, P[i])); }
  for(const ch of channels(ctx)){
    const fondo = gaussMasked(ch, libre, W, H, F * 0.015);
    for(let i = 0; i < n; i++) if(mm[i] > 0.02) ch[i] += int * mm[i] * (fondo[i] - ch[i]);
  }
  luma(ctx);
}
