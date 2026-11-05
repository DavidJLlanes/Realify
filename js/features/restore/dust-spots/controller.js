/* ═══════════════════════════════════════════════════════════════
   POLVO Y MOTAS · FLUJO
   Panel → motor → capa nueva. El flujo común está en js/features/scene/shared/ejecutar.js; aquí no hay píxeles.
   Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../../scene/shared/ejecutar.js";
import { toast } from "../../../core/toast.js";
import { quitarMotas } from "./engine.js";
import { panel } from "./ui.js";

export function ejecutar(){
  return ejecutarEscena({
    panel: panel(), nombre: "Polvo y motas del sensor",
    datos: null,
    motor: (p, ctx, v) => { const r = quitarMotas(p, v); toast(r.motas ? `He limpiado ${r.motas} mota(s)` : "No he encontrado motas con esa sensibilidad"); }
  });
}
