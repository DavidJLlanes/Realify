/* ═══════════════════════════════════════════════════════════════
   QUITAR DESENFOQUE · FLUJO
   Panel → motor → capa nueva. El flujo común está en js/features/scene/shared/ejecutar.js; aquí no hay píxeles.
   Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../../scene/shared/ejecutar.js";
import { quitarDesenfoque } from "./engine.js";
import { panel } from "./ui.js";

export function ejecutar(){
  return ejecutarEscena({
    panel: panel(), nombre: "Quitar desenfoque",
    datos: null,
    motor: (p, ctx, v) => quitarDesenfoque(p, { tipo: v.tipo, largo: v.tamano, radio: v.tamano, angulo: v.angulo < 0 ? null : v.angulo, auto: v.angulo < 0, cantidad: v.cantidad })
  });
}
