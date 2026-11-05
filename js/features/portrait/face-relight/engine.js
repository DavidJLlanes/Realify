/* ═══════════════════════════════════════════════════════════════
   LUZ EN LA CARA · MOTOR (puro, sin DOM)
   Reilumina la cara con una luz direccional: Lambert sobre las normales de relight/ (profundidad + elipsoide) mezclado en luz LINEAL con
   una ganancia multiplicativa igual en los tres canales (el color de la piel no cambia) y centrada en la luz media de la cara (la
   exposición global se conserva). Fuera de la cara la luz se apaga con suavidad. Sin modelo generativo.
   Entradas: ctx { W, H, R, G, B, Y, F, zonas, profundidad } y { luz_int 0-100, luz_azim -90..90, luz_alt 0..90, luz_suave 0-100 }.
   Salida: modifica ctx.R/G/B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { normalesCara } from "../../relight/normals.js";
import { lambert } from "../../relight/light.js";
import { gauss } from "../shared/blur.js";
import { union } from "../shared/raster.js";
import { channels, luma } from "../shared/planes.js";

export function stage(ctx, p){
  const int = (p.luz_int ?? 0) / 100; if(int <= 0) return;
  const { W, H, F } = ctx, n = W * H, cara = union([ctx.zonas.ovalo, ctx.zonas.cuello]);
  const normales = ctx.cache.normales || (ctx.cache.normales = normalesCara(ctx.profundidad || null, ctx.zonas.ovalo, W, H, F));
  const lam = lambert(normales, W, H, p.luz_azim ?? -40, p.luz_alt ?? 35, F * (0.006 + 0.05 * (p.luz_suave ?? 50) / 100));
  let s = 0, c = 0; for(let i = 0; i < n; i++) if(ctx.zonas.ovalo[i] > 0.5){ s += lam[i]; c++; }
  const ref = c ? s / c : 0.5, peso = gauss(cara, W, H, F * 0.05), chs = channels(ctx);
  for(let i = 0; i < n; i++){
    const w = Math.min(1, peso[i] * 1.5); if(w < 0.01) continue;
    const g = Math.min(2.2, Math.max(0.45, 1 + int * 1.5 * w * (lam[i] - ref)));
    for(const ch of chs) ch[i] *= g;
  }
  luma(ctx);
}
