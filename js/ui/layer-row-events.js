/* ═══════════════════════════════════════════════════════════════
   PANEL DE CAPAS · gestos de cada fila
   Arrastrar y soltar (máscaras entre capas; capa a otra pestaña) y menús contextuales (máscara y capa) de una fila del panel Capas. Lo llama
   js/ui/panels.js por cada fila. Entradas: el elemento de la fila, su capa, si es grupo y `renderLayers` (para repintar sin importar panels.js).
   Salida: listeners sobre la fila (wireContextMenus devuelve maskMenu(x, y)). Límites: los grupos no se copian a otra pestaña.
   ═══════════════════════════════════════════════════════════════ */
import { doc, setActive } from "../core/doc.js";
import { emit } from "../core/bus.js";
import { record } from "../core/history.js";
import { toast } from "../core/toast.js";
import { getMaskTarget, setMaskTarget, toggleMask, removeMask, copyMask, moveMask, linkMask, getIsolateView, setIsolateView, toggleIsolateView } from "../editor/layers/masks.js";
import { listTabs, activeTab, copyLayerToTab } from "../editor/documents.js";
import { confirmDlg, promptDlg } from "./kit/dialog.js";
import { openContextMenu } from "./menu.js";

export function wireDragDrop(el, l, isGroup, renderLayers){
  el.draggable = true;
  el.addEventListener("dragstart", e => {
    const maskThumb = e.target.closest("[data-mask]");
    if(maskThumb && l.mask){
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("application/x-mask-source", JSON.stringify({
        layerId: l.id,
        hasMask: !!l.mask
      }));
      return;
    }
    if(e.target.closest("button, input, [data-add-mask]")){ e.preventDefault(); return; }
  // Copiar a otra pestaña sólo sabe llevarse el lienzo propio de
  // la capa; un grupo no tiene ninguno (su contenido vive en sus
  // miembros), así que por ahora ese gesto queda fuera para no
  // crear en la otra pestaña una capa vacía sin avisar.
    if(isGroup){ e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/x-realify-layer", String(l.id));
  });

  el.addEventListener("dragover", e => {
    const maskThumb = e.target.closest("[data-mask]");
    if(!maskThumb) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : e.altKey ? "move" : "link";
    maskThumb.classList.add("drag-over");
  });

  el.addEventListener("dragleave", e => {
    const maskThumb = e.target.closest("[data-mask]");
    if(!maskThumb) return;
    maskThumb.classList.remove("drag-over");
  });

  el.addEventListener("drop", e => {
    const maskThumb = e.target.closest("[data-mask]");
    if(!maskThumb) return;
    e.preventDefault();
    maskThumb.classList.remove("drag-over");
    const data = JSON.parse(e.dataTransfer.getData("application/x-mask-source") || "{}");
    if(!data.layerId) return;
    const srcLayer = doc.layers.find(ly => ly.id === data.layerId);
    if(!srcLayer || !srcLayer.mask || srcLayer === l) return;
    if(e.ctrlKey){ copyMask(srcLayer, l); }
    else if(e.altKey){ moveMask(srcLayer, l); }
    else { linkMask(srcLayer, l); }
    renderLayers();
    emit("doc:change");
  });
}

export function wireContextMenus(el, l, isGroup, renderLayers){
  /* Menú de la máscara: clic derecho en el escritorio, y en el móvil
     (sin Alt ni clic derecho) un segundo toque sobre la máscara ya
     elegida. */
  const maskMenu = (x, y) => {
      setActive(l.id);
      openContextMenu([
        { label: getIsolateView() === l.id ? "Volver a la vista normal" : "Ver y pintar sólo la máscara",
          onClick: () => {
            const on = toggleIsolateView(l.id); renderLayers();
            if(on) toast("Máscara a la vista: pinta en negro para ocultar y en blanco para mostrar");
          } },
        ...(getMaskTarget() === l.id ? [{ label: "Pintar la imagen (no la máscara)",
          onClick: () => { setMaskTarget(null); if(getIsolateView() !== null) setIsolateView(null); renderLayers(); } }] : []),
        { label: l.maskEnabled ? "Deshabilitar máscara de capa" : "Habilitar máscara de capa",
          onClick: () => toggleMask(l) },
        { sep: true },
        { label: "Aplicar máscara de capa", onClick: async () => {
            if(await confirmDlg("Aplicar máscara", "La máscara se funde con la capa y desaparece como objeto aparte. No se puede deshacer con un cambio posterior.", "Aplicar")){
              setMaskTarget(null);
              removeMask(l, true);
            }
          } },
        { label: "Eliminar máscara de capa", onClick: async () => {
            if(await confirmDlg("Eliminar máscara", "Se descarta la máscara y la capa vuelve a verse entera.", "Eliminar")){
              setMaskTarget(null);
              removeMask(l, false);
            }
          } }
      ], x, y);
  };
  el.addEventListener("contextmenu", e => {
    if(e.target.closest("[data-mask]")){
      e.preventDefault();
      maskMenu(e.clientX, e.clientY);
      return;
    }
    // En cualquier otro punto de la fila: copiar esta capa a otro
    // documento abierto, si hay alguno. El mismo destino que
    // arrastrarla hasta su pestaña (ver más arriba), para quien
    // prefiera un menú a un gesto de arrastre. Los grupos quedan
    // fuera por el mismo motivo que en el arrastre.
    const tabs = listTabs();
    const actions = [{ label:"Renombrar capa…", onClick: async () => {
      const name = await promptDlg("Renombrar capa", "Nombre", l.name);
      if(name === null) return;
      const before = l.name, after = name.trim().slice(0, 80) || before;
      if(after === before) return;
      l.name = after;
      record("Renombrar capa", () => { l.name = before; emit("doc:structure"); }, () => { l.name = after; emit("doc:structure"); });
      emit("doc:structure");
    }}];
    if(!isGroup && tabs.length > 1){
      actions.push({ sep:true }, ...tabs.filter(t => t !== activeTab())
        .map(t => ({ label:`Copiar capa a «${t.title}»`, onClick:() => copyLayerToTab(l, t.tabId) })));
    }
    e.preventDefault();
    setActive(l.id);
    openContextMenu(actions, e.clientX, e.clientY);
  });
  return maskMenu;   // panels.js lo usa también en el móvil (segundo toque sobre la máscara)
}
