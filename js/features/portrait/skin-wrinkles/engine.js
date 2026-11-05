/* ═══════════════════════════════════════════════════════════════
   ARRUGAS · MOTOR (puro, sin DOM)
   Detecta los surcos con un filtro de crestas, sólo dentro de las zonas elegidas y de la piel, y atenúa su baja y media frecuencia
   hacia la piel de alrededor (sin contar el propio surco). La textura fina (poros) se reinyecta según «conservar textura».
   Entradas: ctx { W, H, R, G, B, Y, F, zonas, piel, cache } y { arrugas_int, arrugas_tex, z_frente, z_entrecejo, z_ojos, z_surcos, z_cuello }.
   Salida: modifica ctx.R/G/B en sitio. Límites: sin intensidad no hace nada.
   ═══════════════════════════════════════════════════════════════ */
import { gauss, gaussMasked } from "../shared/blur.js";
import { ridgeStrength } from "../shared/ridges.js";
import { sqrtPlane, channels, luma } from "../shared/planes.js";
import { union, multiply } from "../shared/raster.js";

export function mapaSurcos(ctx){
  if(!ctx.cache.surcos) ctx.cache.surcos = ridgeStrength(sqrtPlane(ctx.Y), ctx.W, ctx.H, [ctx.F * 0.005, ctx.F * 0.009]);
  return ctx.cache.surcos;
}

export function stage(ctx, p){
  const int = (p.arrugas_int ?? 0) / 100; if(int <= 0) return;
  const tex = (p.arrugas_tex ?? 70) / 100, z = ctx.zonas, lista = [];
  if(p.z_frente !== false) lista.push(z.frente);
  if(p.z_entrecejo !== false) lista.push(z.entrecejo);
  if(p.z_ojos !== false) lista.push(z.ojos);
  if(p.z_surcos !== false) lista.push(z.surcos, z.comisuras);
  if(p.z_cuello !== false) lista.push(z.cuello);
  if(!lista.length) return;
  const zona = multiply(union(lista), ctx.piel), S = mapaSurcos(ctx), n = ctx.W * ctx.H;
  const a = new Float32Array(n), libre = new Float32Array(n);
  for(let i = 0; i < n; i++){ a[i] = Math.min(1, int * 1.6 * S[i] * zona[i]); libre[i] = ctx.piel[i] * (1 - Math.min(1, S[i] * 1.5)); }
  for(const ch of channels(ctx)){
    const fino = gauss(ch, ctx.W, ctx.H, Math.max(0.8, ctx.F * 0.004));        // lo que queda al quitar poros
    const ancho = gaussMasked(ch, libre, ctx.W, ctx.H, ctx.F * 0.03);            // la piel de alrededor sin el surco
    for(let i = 0; i < n; i++){
      if(a[i] < 0.002) continue;
      const hf = ch[i] - fino[i];
      ch[i] = Math.max(0, ch[i] + a[i] * (ancho[i] - fino[i]) - a[i] * (1 - tex) * hf * 0.85);
    }
  }
  luma(ctx);
}
