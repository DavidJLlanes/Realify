/* ═══════════════════════════════════════════════════════════════
   QUITAR NEBLINA CON PROFUNDIDAD · FLUJO
   Panel → datos (IA) → motor → capa nueva. El flujo común está en ../shared/ejecutar.js; aquí no hay píxeles.
   Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../shared/ejecutar.js";
import { quitarNeblina } from "./engine.js";
import { panel } from "./ui.js";
import { profundidadTrabajo } from "./analysis.js";

export function ejecutar(){
  return ejecutarEscena({
    panel: panel(), nombre: "Quitar neblina con IA",
    datos: async (src, prep) => ({ d: await profundidadTrabajo(src, prep) }),
    motor: (p, ctx, v) => quitarNeblina(p, ctx.d, v)
  });
}
