/* ═══════════════════════════════════════════════════════════════
   MOIRÉ Y BANDAS · FLUJO
   Panel → motor → capa nueva. El flujo común está en js/features/scene/shared/ejecutar.js; aquí no hay píxeles.
   Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../../scene/shared/ejecutar.js";
import { quitarMoire } from "./engine.js";
import { panel } from "./ui.js";

export function ejecutar(){
  return ejecutarEscena({
    panel: panel(), nombre: "Moiré y bandas",
    datos: null,
    motor: (p, ctx, v) => { quitarMoire(p, v); }
  });
}
