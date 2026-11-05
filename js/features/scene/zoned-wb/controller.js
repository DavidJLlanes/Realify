/* ═══════════════════════════════════════════════════════════════
   BALANCE DE BLANCOS POR ZONAS · FLUJO
   Panel → datos (IA) → motor → capa nueva. El flujo común está en ../shared/ejecutar.js; aquí no hay píxeles.
   Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../shared/ejecutar.js";
import { balanceZonas } from "./engine.js";
import { panel } from "./ui.js";

export function ejecutar(){
  return ejecutarEscena({
    panel: panel(), nombre: "Balance de blancos por zonas",
    datos: null,
    motor: (p, ctx, v) => balanceZonas(p, v)
  });
}
