/* ═══════════════════════════════════════════════════════════════
   RECUPERAR LUCES · FLUJO
   Panel → datos (IA) → motor → capa nueva. El flujo común está en ../shared/ejecutar.js; aquí no hay píxeles.
   Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../shared/ejecutar.js";
import { recuperarLuces } from "./engine.js";
import { panel } from "./ui.js";

export function ejecutar(){
  return ejecutarEscena({
    panel: panel(), nombre: "Recuperar luces",
    datos: null,
    motor: (p, ctx, v) => { recuperarLuces(p, v); }
  });
}
