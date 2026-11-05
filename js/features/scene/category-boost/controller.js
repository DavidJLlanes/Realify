/* ═══════════════════════════════════════════════════════════════
   REALZAR POR TIPO · FLUJO
   Panel → datos (IA) → motor → capa nueva. El flujo común está en ../shared/ejecutar.js; aquí no hay píxeles.
   Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../shared/ejecutar.js";
import { realzarTipo } from "./engine.js";
import { panel } from "./ui.js";
import { mascaraClases, mascaraSujeto, mascaraPiel, CATEGORIAS } from "./analysis.js";

export function ejecutar(){
  return ejecutarEscena({
    panel: panel(), nombre: "Realzar por tipo",
    datos: async (src, prep, v) => { const r = v.tipo === "piel" ? await mascaraPiel(src, prep.W, prep.H) : await mascaraClases(src, CATEGORIAS[v.tipo], prep.W, prep.H, "Buscando en la foto con IA"); return r.hay ? { m: r.mascara } : { aviso: "No he encontrado eso en la foto" }; },
    motor: (p, ctx, v) => realzarTipo(p, ctx.m, v.tipo, v.cantidad, v.detalle)
  });
}
