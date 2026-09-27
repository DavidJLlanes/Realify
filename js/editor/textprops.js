/* ═══════════════════════════════════════════════════════════════
   PROPIEDADES DE TEXTO, EN VIVO
   Fuente, tamaño e interlineado de una capa de texto, montados en el
   panel de propiedades: no hace falta activar la herramienta Texto
   ni abrir su barra de opciones para tocar estos tres mandos, basta
   con tener la capa seleccionada. Comparte `updateText` —la misma
   función que usa la barra de opciones mientras se edita en el
   lienzo— para la vista previa, y anota un único paso de historial
   al confirmar, igual que `endEdit` hace al terminar de escribir.
   ═══════════════════════════════════════════════════════════════ */

import { FONTS, loadFontFile, updateText, isText } from "./text.js";
import { slider } from "./adjust.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { renderTextLayer } from "./text.js";
import { toast } from "../ui/toast.js";

const LOAD_FONT = "__load_font__";

export function mountTextProperties(layer, container){
  if(!isText(layer)) return null;
  const before = { ...layer.text };

  const box = document.createElement("div");
  box.innerHTML = `<div class="field"><label>Fuente</label><select id="tpFont" class="grow"></select></div>`;
  const select = box.querySelector("#tpFont");
  for(const [val, label] of FONTS){
    const op = document.createElement("option");
    op.value = val; op.textContent = label;
    op.style.fontFamily = val;
    if(val === layer.text.font) op.selected = true;
    select.appendChild(op);
  }
  const loadOp = document.createElement("option");
  loadOp.value = LOAD_FONT;
  loadOp.textContent = "Cargar fuente desde archivo…";
  select.appendChild(loadOp);

  select.addEventListener("change", async () => {
    if(select.value === LOAD_FONT){
      select.value = layer.text.font;
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2";
      inp.style.display = "none";
      document.body.appendChild(inp);
      inp.addEventListener("change", async () => {
        const f = inp.files?.[0];
        inp.remove();
        if(!f) return;
        try{
          const family = await loadFontFile(f);
          toast(`Fuente cargada: ${family.replace(/'/g, "")}`, "ok");
          const op = document.createElement("option");
          op.value = family; op.textContent = family.replace(/'/g, "");
          select.insertBefore(op, loadOp);
          select.value = family;
          updateText(layer, { font: family });
        }catch(err){
          toast("No se pudo cargar la fuente: " + (err.message || "archivo no válido"), "err");
        }
      });
      inp.click();
      return;
    }
    updateText(layer, { font: select.value });
  });
  box.appendChild(select.closest(".field"));

  box.appendChild(slider("Tamaño", 4, 400, layer.text.size,
    v => updateText(layer, { size: v }), " px"));
  box.appendChild(slider("Interlineado", 50, 300, Math.round(layer.text.lineHeight * 100),
    v => updateText(layer, { lineHeight: v / 100 }), "%"));

  // Sangrías: sólo tienen efecto con marco puesto —igual condición que
  // usa layoutText() en text.js—, así que fuera de un párrafo no se
  // enseñan: no habría nada que reajustar con ellas.
  if(Number.isFinite(layer.text.boxW) && layer.text.boxW > 0){
    box.appendChild(slider("Sangría 1ª línea", -2000, 2000, layer.text.indentFirst || 0,
      v => updateText(layer, { indentFirst: v }), " px"));
    box.appendChild(slider("Sangría izquierda", 0, 2000, layer.text.indentLeft || 0,
      v => updateText(layer, { indentLeft: v }), " px"));
    box.appendChild(slider("Sangría derecha", 0, 2000, layer.text.indentRight || 0,
      v => updateText(layer, { indentRight: v }), " px"));
  }

  const warpKind = layer.text.warp ? layer.text.warp.kind : "none";
  const warpBox = document.createElement("div");
  warpBox.innerHTML = `<div class="field"><label>Deformar</label>
    <select id="tpWarp" class="grow">
      <option value="none">Ninguna</option>
      <option value="arc">Arco</option>
      <option value="flag">Bandera</option>
      <option value="fish">Pez</option>
    </select></div>`;
  warpBox.querySelector("#tpWarp").value = warpKind;
  box.appendChild(warpBox);
  let warpAmountRow = null;
  const syncWarpAmount = () => {
    if(warpAmountRow){ warpAmountRow.remove(); warpAmountRow = null; }
    const kind = warpBox.querySelector("#tpWarp").value;
    if(kind === "none") return;
    warpAmountRow = slider("Fuerza", -100, 100, layer.text.warp ? layer.text.warp.amount : 50,
      v => updateText(layer, { warp: { kind: warpBox.querySelector("#tpWarp").value, amount: v } }), "%");
    warpBox.after(warpAmountRow);
  };
  warpBox.querySelector("#tpWarp").addEventListener("change", () => {
    const kind = warpBox.querySelector("#tpWarp").value;
    updateText(layer, { warp: kind === "none" ? null : { kind, amount: layer.text.warp?.amount ?? 50 } });
    syncWarpAmount();
  });
  syncWarpAmount();

  const openType = document.createElement("div");
  openType.className = "field";
  openType.innerHTML = `<label>OpenType</label>
    <label class="chk"><input type="checkbox" id="tpLig"${layer.text.ligatures !== false ? " checked" : ""}> Ligaduras</label>
    <label class="chk"><input type="checkbox" id="tpSmcp"${layer.text.smallCaps ? " checked" : ""}> Versalitas</label>`;
  openType.querySelector("#tpLig").addEventListener("change", e => updateText(layer, { ligatures: e.target.checked }));
  openType.querySelector("#tpSmcp").addEventListener("change", e => updateText(layer, { smallCaps: e.target.checked }));
  box.appendChild(openType);

  if(layer.text.path){
    const pathRow = document.createElement("div");
    pathRow.className = "field";
    pathRow.innerHTML = `<label>Trazado</label><button id="tpPathOff">Quitar</button>`;
    pathRow.querySelector("#tpPathOff").addEventListener("click", () => {
      updateText(layer, { path: null });
      emit("doc:structure");
    });
    box.appendChild(pathRow);
  }

  container.appendChild(box);

  return {
    commit(){
      const after = { ...layer.text };
      if(!Object.keys(after).some(k => after[k] !== before[k])) return;
      record("Editar texto",
        () => { Object.assign(layer.text, before); renderTextLayer(layer); emit("doc:structure"); emit("doc:change"); },
        () => { Object.assign(layer.text, after);  renderTextLayer(layer); emit("doc:structure"); emit("doc:change"); });
      emit("doc:structure"); emit("doc:change");
    }
  };
}
