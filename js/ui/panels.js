/* ═══════════════════════════════════════════════════════════════
   PANELES
   En escritorio son una columna con secciones plegables. En móvil,
   toda la columna se convierte en una hoja que sube desde abajo y se
   arrastra con el dedo, incluido el gesto de cerrarla tirando hacia
   abajo: es el patrón que ya conoce cualquiera que use el móvil.
   La lista de capas se pinta aquí (renderLayers); el contenido de cada fila está en layer-row.js, sus clics en
   layer-row-click.js, sus gestos de arrastre y menús en layer-row-events.js y la opacidad y el modo de fusión en layer-controls.js.
   ═══════════════════════════════════════════════════════════════ */

import { on, emit } from "../core/bus.js";
import { doc } from "../core/doc.js";
import { canUndo, canRedo } from "../core/history.js";
import { getMaskTarget, clearMaskTarget, getIsolateView, setIsolateView, toggleIsolateView } from "../editor/layers/masks.js";
import { renderSnapshots, renderHistory, renderInfo } from "./panels-historial.js";
export { renderHistory, renderInfo };
import { haptic, isMobile } from "../core/device.js";
import { toggleCollapsed } from "../editor/layers/groups.js";
import { initProperties } from "./properties.js";
import { initReorder } from "./layers-reorder.js";
import { wireDragDrop, wireContextMenus } from "./layer-row-events.js";
import { rowState, rowHtml, wireFxControls, layerDepthsAndHidden } from "./layer-row.js";
import { wireRowClick } from "./layer-row-click.js";
import { wireLayerControls, syncLayerControls } from "./layer-controls.js";
import { fitAbove, fitInRect, view } from "../core/view.js";

/* ── selección múltiple de capas ─────────────────────────────────
   Aparte de `doc.activeId` —que sigue siendo "la capa sobre la que
   actúan el resto de herramientas y paneles"—: esto es sólo "cuáles
   están marcadas para Alinear/Distribuir". Un clic normal la vacía y
   dice "sólo esta"; Ctrl o Mayús la va sumando. No vive en `doc`
   porque no es parte del documento, es un estado de la interfaz. */
let multiSelect = new Set();
let layerSelectMode = false;
export const getSelectedLayerIds = () => [...multiSelect];
function setMultiSelect(ids){ multiSelect = new Set(ids); emit("layers:multiselect"); }

const panels = document.getElementById("panels");
const veil   = document.getElementById("sheetVeil");
const grip   = document.getElementById("sheetGrip");
const mBtn   = document.getElementById("mPanels");
const layerSelectModeBtn = document.getElementById("layerSelectMode");
layerSelectModeBtn?.addEventListener("click", () => {
  layerSelectMode = !layerSelectMode;
  layerSelectModeBtn.setAttribute("aria-pressed", String(layerSelectMode));
  layerSelectModeBtn.classList.toggle("on", layerSelectMode);
  layerSelectModeBtn.title = layerSelectMode ? "Selección múltiple activa · toca capas y vuelve a pulsar para terminar" : "Activar selección múltiple para agrupar capas";
  if(!layerSelectMode) setMultiSelect([]);
  renderLayers();
});

export { isMobile };

/* ── plegado de secciones ──
   En escritorio los paneles son una columna alta y pueden estar varios
   abiertos a la vez, que es lo cómodo: se ven las capas Y los mandos
   de la capa activa sin tocar nada.

   En móvil los mismos paneles van apilados dentro de una hoja corta,
   así que dos abiertos significan que el segundo asoma por debajo del
   primero: pulsar «Capas» abría también Propiedades —con los mandos
   del filtro de la capa activa— encima de la lista, que no es lo que
   se pide al pulsar «Capas». Aquí, uno abierto a la vez.

   Y sólo ése a la vista: antes seguían asomando las cabeceras de
   Histograma, Propiedades, Historial e Información, que en la hoja a
   media altura se comían el sitio y la lista de capas no llegaba a
   verse. Ahora «Capas» enseña sólo las capas; Histograma o Propiedades
   aparecen solos cuando se piden (menú Ver, botón fx de una capa). */
export function openOnlyPanel(id){
  const solo = isMobile();
  panels.classList.toggle("solo", solo);
  document.querySelectorAll(".panel").forEach(p => {
    p.classList.toggle("closed", p.id !== id);
    p.classList.toggle("solo-on", solo && p.id === id);
  });
  syncFsTop();
  if(fsOn()) requestAnimationFrame(() => { measureRows(); fsFit(); });
}

export function initPanels(){
  document.querySelectorAll(".panel").forEach(p => {
    const head = p.querySelector(".panel-head");
    head.addEventListener("click", e => {
      if(e.target.closest("button")) return;   // los iconos de la cabecera no pliegan
      if(panels.classList.contains("solo") && p.classList.contains("solo-on")) return;   // móvil: el único panel no se pliega
      const opening = p.classList.contains("closed");
      if(isMobile() && opening) openOnlyPanel(p.id);
      else p.classList.toggle("closed");
    });
  });
  // Propiedades nace abierto en el HTML (ver index.html) porque en
  // escritorio conviene; en móvil se cierra de salida.
  if(isMobile()) openOnlyPanel("panel-layers");

  mBtn.addEventListener("click", () => toggleSheet());
  veil.addEventListener("click", () => toggleSheet(false));
  initGrip();
  initFsTop();

  renderLayers();
  renderSnapshots();
  renderHistory();
  wireLayerControls();
  initProperties();
}

/* Abre (si estaba plegado) y desplaza a la vista el panel de
   Propiedades: lo que antes hacía doble clic para abrir un diálogo
   modal, ahora sólo necesita asegurarse de que el panel —que ya
   muestra los mandos en vivo en cuanto la capa está activa— se vea. */
function revealProperties(){
  const panel = document.getElementById("panel-props");
  if(!panel) return;
  // En móvil, abrirlo implica cerrar Capas: son la misma hoja y no
  // caben los dos. En escritorio basta con desplegarlo si estaba
  // plegado, porque conviven sin estorbarse.
  if(isMobile()) openOnlyPanel("panel-props");
  else panel.classList.remove("closed");
  panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  /* Un parpadeo corto del borde: en escritorio este panel suele estar
     YA abierto y a la vista, así que sin esto pulsar «fx» no parecía
     hacer nada aunque hubiera llevado el foco justo donde debía. */
  panel.classList.remove("flash");
  void panel.offsetWidth;            // reinicia la animación si se repite el clic
  panel.classList.add("flash");
  setTimeout(() => panel.classList.remove("flash"), 1000);
}

/* ── Hoja del móvil (vertical): media altura, alta y la imagen encima ──
   Antes la hoja ocupaba el 82 % de la pantalla y tapaba la imagen: al
   mover la opacidad de una capa no se veía el resultado. Ahora se abre
   a media altura y la imagen se encaja en el hueco libre de encima; el
   asa la sube a alta (entonces la vista vuelve a como estaba) o la
   cierra. Al cerrarla, la vista vuelve a como estaba, salvo que se haya
   hecho zoom o se haya movido la imagen mientras tanto. */
const SHEET = "(max-width:900px) and (orientation:portrait)";
const sheetMode = () => matchMedia(SHEET).matches;
let lifted = null;          // { restore, set: vista que se puso }
function liftImage(){
  if(!panels.classList.contains("open") || !panels.classList.contains("half") || !sheetMode()){ dropImage(); return; }
  const r = fitAbove(panels.getBoundingClientRect().top);
  lifted = { restore: lifted ? lifted.restore : r, set: { zoom: view.zoom, x: view.x, y: view.y } };
}
function dropImage(){
  if(!lifted) return;
  const { restore, set } = lifted; lifted = null;
  if(view.zoom === set.zoom && view.x === set.x && view.y === set.y) restore();
}
panels.addEventListener("transitionend", e => {
  if(e.target === panels && (e.propertyName === "transform" || e.propertyName === "height")) liftImage();
});
/* Al pasar a escritorio vuelven a verse todos los paneles. */
matchMedia("(max-width:900px)").addEventListener?.("change", e => {
  if(!e.matches && fsOn()) setFullscreen(false);
  if(!e.matches){ panels.classList.remove("solo"); document.querySelectorAll(".panel.solo-on").forEach(p => p.classList.remove("solo-on")); }
  else openOnlyPanel("panel-layers");
});
matchMedia(SHEET).addEventListener?.("change", () => {
  if(!sheetMode()){ panels.classList.remove("half", "peek"); dropImage(); }
  else liftImage();
});

export function toggleSheet(v){
  const open = v === undefined ? !panels.classList.contains("open") : v;
  const wasOpen = panels.classList.contains("open");
  // Móvil (cualquier orientación): pantalla completa, ver setFullscreen.
  if(isMobile()){ setFullscreen(open); if(open && !wasOpen) openOnlyPanel("panel-layers"); return; }
  if(open && !wasOpen && sheetMode()) panels.classList.add("half");
  if(!open){ panels.classList.remove("half", "peek"); dropImage(); }
  /* El botón que abre esta hoja se llama «Capas», así que al abrirla
     eso es lo que tiene que haber delante —aunque la última vez se
     dejara abierto Propiedades desde el botón «fx» de una capa—. */
  if(open && isMobile()) openOnlyPanel("panel-layers");
  panels.classList.toggle("open", open);
  veil.classList.toggle("on", open);
  mBtn.classList.toggle("on", open);
  panels.style.transform = "";
}

/* Arrastre de la hoja. Se sigue el dedo en tiempo real (cambiando su
   alto) y al soltar decide por velocidad o por distancia entre tres
   posiciones: alta, media o cerrada. Es lo que hace que un gesto se
   sienta bien y no como un botón con animación. */
function initGrip(){
  let start = null;
  grip.addEventListener("pointerdown", e => {
    start = { y: e.clientY, t: performance.now(), h: panels.getBoundingClientRect().height };
    grip.setPointerCapture(e.pointerId);
    panels.style.transition = "none";
  });
  grip.addEventListener("pointermove", e => {
    if(!start) return;
    const dy = e.clientY - start.y;
    const h = Math.max(0, Math.min(innerHeight * .9, start.h - dy));
    panels.style.height = panels.style.maxHeight = h + "px";
  });
  const end = e => {
    if(!start) return;
    const dy = e.clientY - start.y, dt = performance.now() - start.t;
    const v = dy / Math.max(dt, 1), h = start.h - dy, vh = innerHeight;
    const HALF = vh * .46, FULL = vh * .82;
    panels.style.transition = "";
    panels.style.height = panels.style.maxHeight = "";
    haptic(8);
    start = null;
    if(v > .5 || h < HALF * .55){ toggleSheet(false); return; }
    const full = v < -.5 || h > (HALF + FULL) / 2;
    panels.classList.toggle("half", !full);
    if(full) dropImage();
    // Si el alto no cambia (se soltó donde estaba), no habrá transitionend
    requestAnimationFrame(() => requestAnimationFrame(liftImage));
  };
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
}

/* ── Capas a pantalla completa (móvil) ──────────────────────────────
   Como el revelado RAW y los demás editores a pantalla completa: fuera
   todas las barras de la app, la imagen lo más grande posible en el
   hueco libre y, abajo (a la derecha en horizontal), los mandos de la
   capa —nueva, duplicar, eliminar, opacidad, fusión— y una lista de la
   que sólo se ven DOS capas a la vez, desplazable. Arriba, una barra con
   cerrar, el título y deshacer/rehacer.
   · Tocar la imagen no pinta ni selecciona nada: sólo se desplaza y,
     con dos dedos, se amplía (`__panTool`, ver core/view.js).
   · El botón fx de una capa abre su editor ENCIMA, sin cerrar Capas.
   · Ya no hace falta volver transparente la hoja al mover un
     deslizador (lo hacía la versión en media hoja): la imagen se ve
     entera y grande todo el rato. */
const fsTop = document.createElement("header");
fsTop.id = "layersTop";
fsTop.innerHTML = `<button type="button" data-lt="back" aria-label="Cerrar">✕</button>
  <b id="layersTopTitle">Capas</b>
  <button type="button" data-lt-layer data-cmd="layer.up" aria-label="Subir capa">↑</button>
  <button type="button" data-lt-layer data-cmd="layer.down" aria-label="Bajar capa">↓</button>
  <button type="button" data-lt-layer data-cmd="layer.add" aria-label="Nueva capa">＋</button>
  <button type="button" data-lt-layer data-cmd="layer.duplicate" aria-label="Duplicar capa">⧉</button>
  <button type="button" data-lt-layer data-cmd="layer.remove" aria-label="Eliminar capa">🗑</button>
  <button type="button" data-cmd="edit.undo" aria-label="Deshacer">↶</button>
  <button type="button" data-cmd="edit.redo" aria-label="Rehacer">↷</button>`;
const fsOn = () => document.body.classList.contains("layers-fs");
let fsRestore = null, fsRO = null;

function initFsTop(){
  document.body.appendChild(fsTop);
  fsTop.querySelector('[data-lt="back"]').addEventListener("click", () => {
    // Desde Propiedades, Histograma… se vuelve a Capas; desde Capas, se cierra.
    const cur = document.querySelector(".panel.solo-on");
    if(cur && cur.id !== "panel-layers") openOnlyPanel("panel-layers");
    else toggleSheet(false);
  });
  const sync = () => {
    fsTop.querySelector('[data-cmd="edit.undo"]').disabled = !canUndo();
    fsTop.querySelector('[data-cmd="edit.redo"]').disabled = !canRedo();
  };
  on("history:change", sync); sync();
  on("doc:structure", () => { if(fsOn()) requestAnimationFrame(measureRows); });
  addEventListener("resize", () => { if(fsOn()) requestAnimationFrame(fsFit); });
}
function syncFsTop(){
  const cur = document.querySelector(".panel.solo-on");
  const title = cur?.querySelector(".panel-head h3")?.textContent?.trim() || "Capas";
  const t = fsTop.querySelector("#layersTopTitle"); if(t) t.textContent = title;
  const back = fsTop.querySelector('[data-lt="back"]');
  fsTop.classList.toggle("on-layers", !cur || cur.id === "panel-layers");
  if(back){
    const sub = cur && cur.id !== "panel-layers";
    back.textContent = sub ? "‹" : "✕";
    back.setAttribute("aria-label", sub ? "Volver a Capas" : "Cerrar");
  }
}
/* Alto de una fila de la lista, para dejar a la vista exactamente dos. */
function measureRows(){
  const rows = layerList.querySelectorAll(".layer");
  if(!rows.length) return;
  const h = rows[1] ? rows[1].offsetTop - rows[0].offsetTop : rows[0].offsetHeight;
  if(h > 0) panels.style.setProperty("--layer-row", h + "px");
}
/* La imagen, encajada en el hueco que dejan la barra y los mandos. */
function fsFit(){
  if(!fsOn()) return;
  const top = fsTop.getBoundingClientRect().bottom, pr = panels.getBoundingClientRect();
  const side = pr.top < top + 4;       // horizontal: mandos a la derecha
  const r = fitInRect(side ? { top, right: pr.left } : { top, bottom: pr.top });
  if(!fsRestore) fsRestore = r;
}
/* «Ajustar» con Capas abiertas (doble toque en la imagen): en el hueco
   libre, no en toda la pantalla, que deja media foto bajo los mandos. */
window.__fitView = () => { if(!fsOn()) return false; fsFit(); return true; };
function setFullscreen(open){
  const was = fsOn();
  if(open === was){ if(open) requestAnimationFrame(fsFit); return; }
  document.body.classList.toggle("layers-fs", open);
  panels.classList.toggle("open", open);
  panels.classList.remove("half", "peek");
  mBtn.classList.toggle("on", open);
  veil.classList.remove("on");
  if(open){
    // Tocar la imagen sólo desplaza y amplía (nada de pintar sin querer).
    window.__panTool = true;
    fsRO = new ResizeObserver(() => requestAnimationFrame(fsFit));
    fsRO.observe(panels);
    requestAnimationFrame(() => requestAnimationFrame(() => { measureRows(); fsFit(); }));
  } else {
    fsRO?.disconnect(); fsRO = null;
    import("../editor/tools/tools.js").then(m => { window.__panTool = !!m.current?.pan; });
    const r = fsRestore; fsRestore = null;
    requestAnimationFrame(() => r?.());
  }
}

/* ── panel de capas ── */
const layerList = document.getElementById("layerList");
initReorder(layerList);


export function renderLayers(){
  if(!doc.open){ layerList.innerHTML = ""; clearMaskTarget(); return; }
  layerList.innerHTML = "";
  const { depth, hidden } = layerDepthsAndHidden();
  // De arriba a abajo, como en cualquier editor: la capa superior
  // aparece la primera de la lista.
  for(let i = doc.layers.length - 1; i >= 0; i--){
    const l = doc.layers[i];
    if(hidden.has(l.id)) continue;
    const isGroup = l.type === "group";
    const el = document.createElement("div");
    el.className = "layer" + (l.id === doc.activeId ? " on" : "") +
                   (l.visible ? "" : " hidden-layer") +
                   (getIsolateView() === l.id ? " isolating" : "") +
                   (isGroup ? " layer-group" : "");
    el.dataset.id = l.id;
    el.style.marginLeft = (depth.get(l.id) || 0) * 20 + "px";
    if(multiSelect.has(l.id)) el.classList.add("multi");
    const s = rowState(l, i), { fxEntry } = s;
    el.innerHTML = rowHtml(l, s);

    if(isGroup){
      el.querySelector("[data-caret]").addEventListener("click", e => {
        e.stopPropagation();
        toggleCollapsed(l.id);
      });
    }

    wireFxControls(el, l, s);

    // Toda la fila se puede arrastrar, con dos payloads distintos
    // según de dónde se agarre: desde la miniatura de máscara, copiar
    // o mover esa máscara a otra capa (abajo); desde cualquier otro
    // punto, soltarla sobre una PESTAÑA de la barra de documentos
    // (ui/docbar.js) copia la capa entera a ese otro documento — el
    // mismo gesto de «arrastrar a otra ventana» de cualquier editor,
    // adaptado a pestañas porque aquí no hay ventanas de verdad.
    wireDragDrop(el, l, isGroup, renderLayers);
    const maskMenu = wireContextMenus(el, l, isGroup, renderLayers);
    wireRowClick(el, l, { fxEntry, maskMenu, render: renderLayers, reveal: revealProperties,
      multi: () => multiSelect, setMulti: setMultiSelect, selectMode: () => layerSelectMode });
    layerList.appendChild(el);
  }
  syncLayerControls();
}



/* ── instantáneas ──
   Encima del historial paso a paso, en el mismo panel: copias
   completas y con nombre del documento, que no se sueltan solas de
   la memoria como sí hace el historial normal bajo presión —ver
   core/snapshots.js—. El círculo de la izquierda marca cuál es el
   origen del Pincel de historial. */
on("doc:structure", () => {
  // Si alguna capa marcada ha desaparecido (se borró, se combinó…),
  // que no se quede un id fantasma en la selección múltiple.
  const vivos = new Set(doc.layers.map(l => l.id));
  if([...multiSelect].some(id => !vivos.has(id))) multiSelect = new Set([...multiSelect].filter(id => vivos.has(id)));
  if(getIsolateView() !== null && !vivos.has(getIsolateView())) toggleIsolateView(getIsolateView());
  renderLayers(); renderInfo();
});
on("doc:active",    () => {
  if(getMaskTarget() !== null && getMaskTarget() !== doc.activeId) clearMaskTarget();
  // Ver sólo la máscara es de la capa activa: al cambiar de capa, vista normal
  if(getIsolateView() !== null && getIsolateView() !== doc.activeId) setIsolateView(null);
  renderLayers(); renderInfo();
});
on("doc:resize",    renderInfo);
on("history:change", renderHistory);
on("snapshots:change", renderSnapshots);
on("mask:target", renderLayers);
on("mask:isolate", renderLayers);
