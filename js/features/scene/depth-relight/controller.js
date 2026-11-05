/* ═══════════════════════════════════════════════════════════════
   LUZ DIRECCIONAL CON RELIEVE · FLUJO
   Panel → datos (IA) → motor → capa nueva. El flujo común está en ../shared/ejecutar.js; aquí no hay píxeles.
   Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../shared/ejecutar.js";
import { luzRelieve } from "./engine.js";
import { panel } from "./ui.js";
import { profundidadTrabajo } from "./analysis.js";

export function ejecutar(){
  return ejecutarEscena({
    panel: panel(), nombre: "Luz direccional con relieve",
    datos: async (src, prep) => ({ d: await profundidadTrabajo(src, prep) }),
    motor: (p, ctx, v) => luzRelieve(p, ctx.d, v)
  });
}
