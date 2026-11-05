/* ═══════════════════════════════════════════════════════════════
   UNIFICAR ILUMINACIÓN · FLUJO
   Panel → datos (IA) → motor → capa nueva. El flujo común está en ../shared/ejecutar.js; aquí no hay píxeles.
   Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../shared/ejecutar.js";
import { armonizar } from "./engine.js";
import { panel } from "./ui.js";
import { mascaraClases, mascaraSujeto, mascaraPiel, CATEGORIAS } from "./analysis.js";

export function ejecutar(){
  return ejecutarEscena({
    panel: panel(), nombre: "Unificar iluminación",
    datos: async (src, prep) => { const r = await mascaraSujeto(src, prep.W, prep.H); return r.hay ? { sujeto: r.mascara } : { aviso: "No he encontrado ninguna persona en la foto" }; },
    motor: (p, ctx, v) => armonizar(p, ctx.sujeto, v)
  });
}
