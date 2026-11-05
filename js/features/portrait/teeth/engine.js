/* ═══════════════════════════════════════════════════════════════
   DIENTES · MOTOR (puro, sin DOM)
   Blanquea sólo los dientes: dentro del interior de la boca (landmarks) toma lo claro y poco coloreado, y en OKLab quita el amarillo y
   el rojo y sube un poco la luz sin llegar al brillo, que se conserva. Encías, lengua y labios no cambian.
   Entradas: ctx { W, H, R, G, B, Y, zonas } y { dientes_int 0-100 }. Salida: modifica ctx.R/G/B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { oklab, linear } from "../../ai-kit/oklab.js";
import { smoothstep } from "../shared/blur.js";
import { channels, luma } from "../shared/planes.js";

export function stage(ctx, p){
  const int = (p.dientes_int ?? 0) / 100; if(int <= 0) return;
  const n = ctx.W * ctx.H, [R, G, B] = channels(ctx), lab = new Float32Array(3), rgb = new Float32Array(3), boca = ctx.zonas.boca;
  for(let i = 0; i < n; i++){
    if(boca[i] < 0.02) continue;
    oklab(Math.max(0, R[i]), Math.max(0, G[i]), Math.max(0, B[i]), lab);
    const croma = Math.hypot(lab[1], lab[2]), rojo = smoothstep(0.01, 0.05, lab[1] - 0.6 * lab[2]);      // la encía es roja (a alto, b bajo); el diente, amarillo o neutro
    const w = boca[i] * smoothstep(0.6, 0.78, lab[0]) * (1 - smoothstep(0.1, 0.16, croma)) * (1 - rojo) * int;
    if(w < 0.005) continue;
    lab[1] *= 1 - 0.55 * w; lab[2] *= 1 - 0.85 * w; lab[0] += 0.05 * w * (1 - smoothstep(0.88, 0.97, lab[0]));
    linear(lab[0], lab[1], lab[2], rgb); R[i] = Math.max(0, rgb[0]); G[i] = Math.max(0, rgb[1]); B[i] = Math.max(0, rgb[2]);
  }
  luma(ctx);
}
