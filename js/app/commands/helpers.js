/* ═══════════════════════════════════════════════════════════════
   APP · ayudas comunes de los comandos: cuándo están activos, herramientas fotográficas y «Documento nuevo»
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer, newDoc } from "../../core/doc.js";
import { getMaskTarget } from "../../editor/layers/masks.js";
import { getSelectedLayerIds } from "../../ui/panels.js";
import { dialog } from "../../ui/kit/dialog.js";
import { openAsNewTab } from "../../editor/documents.js";
import { clear as clearHistory } from "../../core/history.js";
import { clearSnapshots } from "../../core/snapshots.js";

/* ═══ comandos ═══ */
export const needsDoc = () => doc.open;

/* La capa cuya máscara está en edición ahora mismo, o null: el mismo
   "¿a qué tiene el foco puesto el usuario?" que decide si Ctrl+I,
   Ctrl+L o Ctrl+M actúan sobre la máscara o sobre la capa, igual que
   en Photoshop. */
export const maskInFocus = () => {
  const l = activeLayer();
  return (l && l.mask && getMaskTarget() === l.id) ? l : null;
};

/* Alinear una sola capa es "contra el lienzo", así que basta con la
   activa aunque no haya marcado nada a propósito; con dos o más
   marcadas, es "unas contra otras". */
export const selOrActive = () => getSelectedLayerIds().length >= 2 ? getSelectedLayerIds()
                          : doc.activeId !== null ? [doc.activeId] : [];

export const needsSelOrActive = () => doc.open && selOrActive().length >= 1;

export const photoTool = name => async () => (await import("../../features/photo-tools.js"))[name]();

export async function newDialog(){
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="field"><label>Ancho</label>
      <input type="number" id="nw" class="grow" min="1" max="16384" value="1920">
      <span class="unit">px</span></div>
    <div class="field"><label>Alto</label>
      <input type="number" id="nh" class="grow" min="1" max="16384" value="1080">
      <span class="unit">px</span></div>
    <div class="field"><label>Fondo</label>
      <select id="nf" class="grow">
        <option value="#ffffff">Blanco</option>
        <option value="#000000">Negro</option>
        <option value="">Transparente</option>
      </select></div>`;
  const r = await dialog({
    title:"Documento nuevo", body: wrap,
    buttons:[{ label:"Cancelar", value:null }, { label:"Crear", primary:true, value:"go" }]
  });
  if(r !== "go") return;
  const w = Math.max(1, +wrap.querySelector("#nw").value);
  const h = Math.max(1, +wrap.querySelector("#nh").value);
  const fill = wrap.querySelector("#nf").value;
  // En una pestaña nueva, igual que abrir un archivo: nunca sustituye
  // lo que ya hubiera abierto.
  await openAsNewTab(() => {
    newDoc(w, h, { fill: fill || null, name: "Sin título" });
    clearHistory();
    clearSnapshots();
  });
}
