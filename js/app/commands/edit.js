/* ═══════════════════════════════════════════════════════════════
   APP · comandos de Edición
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { undo, canUndo, redo, canRedo, list as historyList, historyLevels, setHistoryLevels, clear as clearHistory } from "../../core/history.js";
import { toast } from "../../core/toast.js";
import { dialog, promptDlg } from "../../ui/kit/dialog.js";
import { renderHistory } from "../../ui/panels.js";
import { copyToClipboard, cutToClipboard, pasteFromClipboard, hasClip, deleteSelection } from "../../editor/clipboard.js";
import { doc, activeLayer } from "../../core/doc.js";
import { takeSnapshot } from "../../core/snapshots.js";
import { setTool } from "../../editor/tools/tools.js";
import { needsDoc } from "./helpers.js";

registerAll({
  "edit.undo": { run: () => { if(!undo()) toast("Nada que deshacer"); }, enabled: canUndo },
  "edit.redo": { run: () => { if(!redo()) toast("Nada que rehacer"); }, enabled: canRedo },
  "edit.levels": { run: async () => {
    const h = historyList();
    const mb = (h.bytes / 1048576).toFixed(0);
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <p class="hint" style="margin:0 0 10px">Cuántos pasos se pueden recorrer hacia
        atrás <b>y hacia delante</b>. El mismo número para deshacer y para rehacer:
        todo lo que se deshace se puede volver a hacer.</p>
      <div class="field"><label>Pasos</label>
        <input type="range" id="hlR" class="grow" min="5" max="200" step="5" value="${historyLevels()}">
        <span class="unit mono" id="hlV" style="min-width:34px;text-align:right">${historyLevels()}</span></div>
      <p class="hint" style="margin:10px 0 0">Cada paso que toca píxeles guarda dos
        copias de la capa, la de antes y la de después, así que subir esto cuesta
        memoria en imágenes grandes. Ahora mismo el historial ocupa
        <b>${mb} MB</b>; si se pasa del techo, los pasos más lejanos se van soltando
        solos y dejan de poder recorrerse.</p>`;
    const r = wrap.querySelector("#hlR"), v = wrap.querySelector("#hlV");
    r.addEventListener("input", () => { v.textContent = r.value; });
    const res = await dialog({
      title: "Niveles de historial", body: wrap,
      buttons: [{ label:"Cancelar", value:null },
                { label:"Aceptar", primary:true, value:"go" }]
    });
    if(res !== "go") return;
    const n = setHistoryLevels(+r.value);
    renderHistory();
    toast(`${n} pasos de deshacer y rehacer`, "ok");
  }},
  "edit.clearHistory": { run: () => { clearHistory(); toast("Historial vaciado"); }, enabled: needsDoc },
  "edit.copy":  { run: copyToClipboard,  enabled: needsDoc },
  "edit.cut":   { run: cutToClipboard,   enabled: () => doc.open && !(activeLayer() || {}).locked },
  "edit.paste": { run: pasteFromClipboard, enabled: () => doc.open && hasClip() },
  /* Suprimir. Pide selección a propósito: sin ella, la tecla vaciaría
     la capa entera de un toque accidental, y para eso ya está el
     comando de borrar capa, que se pulsa aposta. */
  "edit.clear": { run: deleteSelection,
                  enabled: () => doc.open && !!doc.selection &&
                    !!activeLayer() && !activeLayer().locked },
  "snapshot.add": { run: async () => {
      const name = await promptDlg("Nueva instantánea", "Nombre", "");
      if(name !== null) takeSnapshot(name);
    }, enabled: needsDoc },
  "historyBrush.start": { run: () => setTool("historyBrush"), enabled: needsDoc }
});
