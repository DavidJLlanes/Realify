/* ═══════════════════════════════════════════════════════════════
   OJERAS · MOTOR (puro, sin DOM)
   Iguala la luz y el tono de la banda bajo los ojos con el de la mejilla de debajo, con una ganancia suave y multiplicativa (la
   textura de la piel pasa intacta, sólo cambia el nivel). Nunca oscurece y limita la subida para no dejar un parche blanco.
   Entradas: ctx { W, H, R, G, B, Y, F, zonas, piel } y { ojeras_int 0-100 }. Salida: modifica ctx.R/G/B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { gaussMasked } from "../shared/blur.js";
import { channels, luma } from "../shared/planes.js";
import { multiply } from "../shared/raster.js";

export function stage(ctx, p){
  const int = (p.ojeras_int ?? 0) / 100; if(int <= 0) return;
  const n = ctx.W * ctx.H, ref = multiply(ctx.zonas.mejilla, ctx.piel);
  let peso = 0; for(let i = 0; i < n; i++) peso += ref[i];
  if(peso < 20) return;                                   // no hay mejilla fiable que copiar
  const media = c => { let s = 0; for(let i = 0; i < n; i++) s += c[i] * ref[i]; return s / peso; };
  const refY = media(ctx.Y), refC = channels(ctx).map(c => media(c) / Math.max(refY, 1e-4));
  const zona = multiply(ctx.zonas.ojeras, ctx.piel);
  const lowY = gaussMasked(ctx.Y, ctx.piel, ctx.W, ctx.H, ctx.F * 0.03);
  const lows = channels(ctx).map(c => gaussMasked(c, ctx.piel, ctx.W, ctx.H, ctx.F * 0.03));
  const chs = channels(ctx);
  for(let i = 0; i < n; i++){
    const w = zona[i] * int; if(w < 0.002 || lowY[i] <= 1e-4) continue;
    const gY = Math.min(1 + 0.8 * int, Math.max(1, refY / lowY[i]));
    for(let c = 0; c < 3; c++){
      const rc = Math.min(1.3, Math.max(0.75, refC[c] / Math.max(lows[c][i] / lowY[i], 1e-4)));
      chs[c][i] *= (1 + w * (gY - 1)) * (1 + w * 0.6 * (rc - 1));
    }
  }
  luma(ctx);
}
