/* ═══════════════════════════════════════════════════════════════
   OJOS · MOTOR (puro, sin DOM)
   Trabaja en OKLab sobre el iris y la esclera de cada ojo (máscaras de zones-rasgos.js, que ya excluyen los párpados): LUZ (más claridad y
   detalle en el iris sin quemar el reflejo), COLOR del iris (cambia el tono y deja la luminosidad; la pupila no se tiñe) y BLANCO (aclara y
   quita el amarillo y el rojo de la esclera). Entradas: ctx { W, H, R, G, B, Y, F, zonas } y { ojos_luz 0-100, ojos_color, ojos_color_int 0-100,
   ojos_blanco 0-100 }. Salida: modifica ctx.R/G/B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { oklab, linear } from "../../ai-kit/oklab.js";
import { gauss, smoothstep } from "../shared/blur.js";
import { channels, luma } from "../shared/planes.js";

/** Tono (grados en el plano a-b de OKLab) y croma del iris para cada color. */
export const COLORES = { natural: null, marron: [55, 0.07], avellana: [75, 0.075], verde: [140, 0.075], azul: [250, 0.085], gris: [250, 0.01] };

export function stage(ctx, p){
  const luz = (p.ojos_luz ?? 0) / 100, col = COLORES[p.ojos_color || "natural"], ci = (p.ojos_color_int ?? 70) / 100, bl = (p.ojos_blanco ?? 0) / 100;
  if(luz <= 0 && !(col && ci > 0) && bl <= 0) return;
  const { W, H } = ctx, iris = ctx.zonas.iris, esclera = ctx.zonas.esclera, n = W * H;
  const [R, G, B] = channels(ctx), lab = new Float32Array(3), rgb = new Float32Array(3);
  const fin = luz > 0 ? [R, G, B].map(c => gauss(c, W, H, Math.max(0.8, ctx.F * 0.012))) : null;
  for(let i = 0; i < n; i++){
    const wi = iris[i], we = esclera[i]; if(wi < 0.01 && we < 0.01) continue;
    let r = R[i], g = G[i], b = B[i];
    if(wi > 0.01 && luz > 0){                                               // luz y detalle en el iris
      const k = wi * luz, brillo = 1 - smoothstep(0.55, 0.9, ctx.Y[i]);     // no tocar el reflejo
      r += k * (r - fin[0][i]) * 1.2 * brillo; g += k * (g - fin[1][i]) * 1.2 * brillo; b += k * (b - fin[2][i]) * 1.2 * brillo;
      const f = 1 + k * 0.35 * brillo; r *= f; g *= f; b *= f;
    }
    if(wi > 0.01 && col && ci > 0){                                         // color del iris
      oklab(Math.max(0, r), Math.max(0, g), Math.max(0, b), lab);
      const w = wi * ci * smoothstep(0.2, 0.4, lab[0]), ang = col[0] * Math.PI / 180, ch = Math.hypot(lab[1], lab[2]);
      const cn = ch + (col[1] - ch) * w;                                    // el croma va hacia el del color elegido (poco croma = gris)
      lab[1] += (Math.cos(ang) * cn - lab[1]) * w; lab[2] += (Math.sin(ang) * cn - lab[2]) * w;
      linear(lab[0], lab[1], lab[2], rgb); r = rgb[0]; g = rgb[1]; b = rgb[2];
    }
    if(we > 0.01 && bl > 0){                                                // blanco de los ojos
      oklab(Math.max(0, r), Math.max(0, g), Math.max(0, b), lab);
      const w = we * bl * smoothstep(0.55, 0.75, lab[0]);
      lab[1] *= 1 - 0.7 * w; lab[2] *= 1 - 0.8 * w; lab[0] += 0.06 * w * (1 - lab[0]);
      linear(lab[0], lab[1], lab[2], rgb); r = rgb[0]; g = rgb[1]; b = rgb[2];
    }
    R[i] = Math.max(0, r); G[i] = Math.max(0, g); B[i] = Math.max(0, b);
  }
  luma(ctx);
}
