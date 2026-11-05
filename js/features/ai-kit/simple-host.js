/* ═══════════════════════════════════════════════════════════════
   AI-KIT · HOST SIMPLE
   Monta como diálogo el panel de una función simple (4.7 del plan): los mandos salen de `params` (simple-panel.js), la marca Premium 👑
   va en el título y los botones son Cancelar / Aplicar. Es el ÚNICO sitio que importa `dialog` para las funciones simples.
   Entradas: { title, subtitle, params, applyLabel, profile }. Salida: promesa { ok, values } (values = valores finales de los mandos).
   ═══════════════════════════════════════════════════════════════ */
import { dialog } from "../../ui/kit/dialog.js";
import { buildSimpleBody } from "./simple-panel.js";

export async function openSimple({ title, subtitle = "", params, applyLabel = "Aplicar", profile = null }){
  const { body, values } = buildSimpleBody(params, { profile });
  if(subtitle){
    const p = document.createElement("p"); p.className = "hint"; p.textContent = subtitle;
    body.prepend(p);
  }
  const r = await dialog({ title, body, buttons: [{ label: "Cancelar", value: false }, { label: applyLabel, value: true, primary: true }] });
  return { ok: r === true, values: { ...values } };
}
