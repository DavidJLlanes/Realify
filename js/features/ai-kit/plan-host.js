/* ═══════════════════════════════════════════════════════════════
   AI-KIT · HOST DEL ASISTENTE
   Lo que el asistente necesita de la interfaz: enseñar el plan para confirmarlo y ejecutar una función de IA sin que la persona toque sus mandos
   (el diálogo de la función se rellena solo con los valores del plan y se pulsa «Aplicar», igual que hace «Acciones»). Es el único sitio que
   importa `dialog` para esto. Entradas: plan legible / comando y valores. Salidas: promesa (true/false) o la ejecución del comando.
   Límites: si el diálogo que aparece no tiene los mandos esperados (p. ej. la descarga de un modelo) se deja a la persona.
   ═══════════════════════════════════════════════════════════════ */
import { dialog, setDialogHooks } from "../../ui/kit/dialog.js";
import { runAsync } from "../../core/commands.js";
import { escAttr as esc } from "../../core/util/html.js";

export async function confirmarPlan({ pedido, lineas, avisos = [] }){
  const body = `<p class="hint" style="margin:0 0 8px">«${esc(pedido)}»</p><ol style="margin:0 0 8px 18px;padding:0">${lineas.map(l => `<li>${esc(l)}</li>`).join("")}</ol>` +
    (avisos.length ? `<p class="hint" style="margin:0;color:var(--warn)">${avisos.map(esc).join("<br>")}</p>` : "") +
    `<p class="hint" style="margin:8px 0 0">Todo va en capas nuevas o de ajuste: puedes retocarlo o deshacerlo.</p>`;
  return (await dialog({ title: "Asistente 👑", body, buttons: [{ label: "Cancelar", value: false }, { label: "Aplicar", value: true, primary: true }] })) === true;
}

const textoDe = f => (f.querySelector("label, span.grow")?.textContent || "").replace(/\s+/g, " ").trim();
function rellenar(body, params, valores){
  const campos = [...body.querySelectorAll(".field")]; let n = 0;
  for(const p of params){
    const f = campos.find(x => textoDe(x) === p.label); if(!f) continue; n++;
    if(!(p.key in valores)) continue;
    const el = f.querySelector("input[type=range], input[type=checkbox], select, input[type=text]"); if(!el) continue;
    if(el.type === "checkbox") el.checked = !!valores[p.key]; else el.value = valores[p.key];
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return n;
}

/** Ejecuta `cmd` (una función de IA con panel simple) con los valores del plan. */
export async function correrIA(cmd, params, valores){
  setDialogHooks({ autofill(titulo, body){ return rellenar(body, params, valores) > 0 ? 1 : -2; } });
  try{ await runAsync(cmd); } finally { setDialogHooks(null); }
}
