/* ═══════════════════════════════════════════════════════════════
   BARRA DE PESTAÑAS
   Un documento cabe en una fila siempre visible: miniatura, nombre y
   una cruz para cerrar, igual en escritorio que en móvil —sólo cambia
   el tamaño de los tiradores—, porque «cambiar de documento» debe ser
   un solo toque en cualquier pantalla, no un menú que hay que ir a
   buscar. Se oculta con una sola pestaña abierta: si sólo hay un
   documento, no hay nada que elegir y la fila sólo robaría sitio al
   lienzo, que es exactamente como se comportaba la aplicación antes
   de que existieran las pestañas.
   ═══════════════════════════════════════════════════════════════ */

import { on, emit } from "../core/bus.js";
import { doc } from "../core/doc.js";
import { listTabs, activeTab, switchTo, closeTab, moveTab, copyLayerToTab } from "../core/documents.js";
import { promptOpen } from "../io/open.js";

const app  = document.getElementById("app");
const bar  = document.getElementById("docbar");

const BLANK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";

function render(){
  const tabs = listTabs();
  app.classList.toggle("has-tabs", tabs.length > 1);
  if(tabs.length < 2){ bar.innerHTML = ""; return; }

  const active = activeTab();
  bar.innerHTML = tabs.map(t => `
    <button type="button" class="doctab${t === active ? " on" : ""}" data-tab="${t.tabId}"
            title="${escapeHtml(t.title)}" draggable="true">
      <img class="doctab-thumb" src="${t.thumb || BLANK}" alt="" draggable="false">
      <span class="doctab-name">${escapeHtml(t.title)}</span>
      <span class="doctab-close" data-close="${t.tabId}" title="Cerrar documento" aria-label="Cerrar documento">✕</span>
    </button>`).join("") +
    `<button type="button" class="doctab-add" data-add title="Abrir otra imagen…" aria-label="Abrir otra imagen">+</button>`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

export function initDocbar(){
  render();
  on("docs:change", render);

  bar.addEventListener("click", e => {
    if(e.target.closest("[data-add]")){ promptOpen(); return; }
    const close = e.target.closest("[data-close]");
    if(close){ closeTab(+close.dataset.close); return; }
    const tab = e.target.closest(".doctab");
    if(tab) switchTo(+tab.dataset.tab);
  });

  // Arrastrar una pestaña sobre otra: reordenar.
  let draggingTab = null;
  bar.addEventListener("dragstart", e => {
    const tab = e.target.closest(".doctab");
    if(!tab){ e.preventDefault(); return; }
    draggingTab = +tab.dataset.tab;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-realify-tab", String(draggingTab));
  });
  bar.addEventListener("dragover", e => {
    // También acepta que se suelte encima una CAPA arrastrada desde el
    // panel de Capas (ver panels.js): copiarla en ese documento.
    const isLayer = e.dataTransfer.types.includes("application/x-realify-layer");
    const isTab = draggingTab !== null;
    if(!isLayer && !isTab) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = isLayer ? "copy" : "move";
    const tab = e.target.closest(".doctab");
    bar.querySelectorAll(".doctab.drag-over").forEach(el => el.classList.remove("drag-over"));
    if(tab) tab.classList.add("drag-over");
  });
  bar.addEventListener("dragleave", e => {
    const tab = e.target.closest(".doctab");
    if(tab) tab.classList.remove("drag-over");
  });
  bar.addEventListener("drop", e => {
    const tab = e.target.closest(".doctab");
    bar.querySelectorAll(".doctab.drag-over").forEach(el => el.classList.remove("drag-over"));
    const layerId = e.dataTransfer.getData("application/x-realify-layer");
    if(layerId && tab){
      e.preventDefault();
      const layer = doc.layers.find(l => l.id === +layerId);
      if(layer) copyLayerToTab(layer, +tab.dataset.tab);
      return;
    }
    if(draggingTab !== null){
      e.preventDefault();
      const beforeId = tab ? +tab.dataset.tab : null;
      if(beforeId !== draggingTab) moveTab(draggingTab, beforeId === draggingTab ? null : beforeId);
    }
  });
  bar.addEventListener("dragend", () => {
    draggingTab = null;
    bar.querySelectorAll(".doctab.drag-over").forEach(el => el.classList.remove("drag-over"));
  });

  // Alt+1…Alt+9 salta directamente a la pestaña N: Ctrl/⌘+Tab y
  // Ctrl/⌘+W están reservados por el propio navegador para SUS
  // pestañas y nunca llegan a la página, así que no sirven aquí.
  addEventListener("keydown", e => {
    if(!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if(/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
    const n = +e.key;
    if(n >= 1 && n <= 9 && listTabs()[n - 1]){
      e.preventDefault();
      switchTo(listTabs()[n - 1].tabId);
    }
  });
}
