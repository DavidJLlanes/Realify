/* ═══════════════════════════════════════════════════════════════
   AI-KIT · PANEL SIMPLE DESDE `params`
   Para las funciones con pocos mandos (hasta 4, ver 4.7 del plan): construye el cuerpo de un diálogo o de runAdjust a partir
   del MISMO esquema `params` que usan los editores a pantalla completa (js/ui/kit/params-panel.js). No hay mandos dibujados
   a mano en las funciones: usa slider() y pickerGroup() de js/editor/adjust/adjust.js, como el resto de la app.
   Entradas: params, perfil, onChange(clave, valor, valores). Salida: { body, values } (el nodo y los valores vivos).
   ═══════════════════════════════════════════════════════════════ */

import { slider, pickerGroup } from "../../editor/adjust/adjust.js";
import { paramsFor, defaultsOf } from "../../ui/kit/params-panel.js";
import { escAttr as esc } from "../../core/util/html.js";

export function buildSimpleBody(params, { profile = null, onChange = () => {} } = {}){
  const values = defaultsOf(params, profile);
  const body = document.createElement("div");
  const sliders = [];
  const emit = (key, v) => { values[key] = v; onChange(key, v, values); };
  for(const p of paramsFor(params, profile)){
    if(p.type === "range"){
      sliders.push({ label: p.label, node: slider(p.label, p.min, p.max, values[p.key], v => emit(p.key, v), p.unit || "", p.step || 1) });
    } else if(p.type === "toggle"){
      const row = document.createElement("label"); row.className = "field";
      row.innerHTML = `<span class="grow">${esc(p.label)}</span><input type="checkbox"${values[p.key] ? " checked" : ""}>`;
      row.querySelector("input").addEventListener("change", e => emit(p.key, e.target.checked));
      body.appendChild(row);
    } else if(p.type === "text"){
      const row = document.createElement("div"); row.className = "field";
      row.innerHTML = `<label>${esc(p.label)}</label><input type="text" class="grow" value="${esc(values[p.key] ?? "")}" autocomplete="off" spellcheck="false">`;
      row.querySelector("input").addEventListener("input", e => emit(p.key, e.target.value));
      body.appendChild(row);
    } else if(p.type === "seg" || p.type === "select"){
      const opts = typeof p.options === "function" ? p.options() : p.options;
      const row = document.createElement("div"); row.className = "field";
      row.innerHTML = `<label>${esc(p.label)}</label><select class="grow">${opts.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(values[p.key]) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
      row.querySelector("select").addEventListener("change", e => emit(p.key, typeof opts[0][0] === "number" ? +e.target.value : e.target.value));
      body.appendChild(row);
    }
  }
  if(sliders.length) body.prepend(pickerGroup(sliders));
  return { body, values };
}
