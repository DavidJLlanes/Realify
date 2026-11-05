/* ═══════════════════════════════════════════════════════════════
   MEJORAR CIELO · FLUJO
   Panel → datos (IA) → motor → capa nueva. El flujo común está en ../shared/ejecutar.js; aquí no hay píxeles.
   Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../shared/ejecutar.js";
import { mejorarCielo } from "./engine.js";
import { panel } from "./ui.js";
import { mascaraClases, mascaraSujeto, mascaraPiel, CATEGORIAS } from "./analysis.js";

export function ejecutar(){
  return ejecutarEscena({
    panel: panel(), nombre: "Mejorar cielo",
    datos: async (src, prep) => { const { mascara, hay } = await mascaraClases(src, CATEGORIAS.cielo, prep.W, prep.H, "Detectando el cielo con IA"); return hay ? { cielo: mascara } : { aviso: "No he encontrado cielo en la foto" }; },
    motor: (p, ctx, v) => mejorarCielo(p, ctx.cielo, v)
  });
}
