/* ═══════════════════════════════════════════════════════════════
   PANELES
   En escritorio son una columna con secciones plegables. En móvil,
   toda la columna se convierte en una hoja que sube desde abajo y se
   arrastra con el dedo, incluido el gesto de cerrarla tirando hacia
   abajo: es el patrón que ya conoce cualquiera que use el móvil.
   ═══════════════════════════════════════════════════════════════ */

import { on, emit } from "../core/bus.js";
import { doc, activeLayer, layerThumb, setActive, moveLayer } from "../core/doc.js";
import { list as historyList, jumpTo, canUndo, canRedo } from "../core/history.js";
import { record } from "../core/history.js";
import { getMaskTarget, setMaskTarget, clearMaskTarget, addMask,
         toggleMask, maskAlphaAsSelectionMask,
         getIsolateView, setIsolateView, toggleIsolateView, removeMask,
         copyMask, moveMask, linkMask } from "../editor/masks.js";
import { isAdjustLayer, adjustTypeName, openAdjustPanel } from "../editor/adjustlayers.js";
import { isFillLayer, isShapeLayer, fillKindName, SHAPE_KIND_NAME } from "../editor/layercontent.js";
import { isBlendIfActive } from "../editor/blendif.js";
import { hasSelection, commitSelection } from "../editor/selection.js";
import { confirmDlg, promptDlg } from "./dialog.js";
import { listSnapshots, getBrushSourceId, setBrushSource, restoreSnapshot,
         renameSnapshot, removeSnapshot } from "../core/snapshots.js";
import { openContextMenu } from "./menu.js";
import { haptic, isMobile } from "../core/device.js";
import { filterOf, filterAmount } from "../editor/filterlayer.js";
import { listTabs, activeTab, copyLayerToTab } from "../core/documents.js";
import { knownFilter, filterLiveCapable, openFilterEditor } from "../editor/filterregistry.js";
import { setFilterAmount, amountMode } from "../editor/filteramount.js";
import { toggleFilterEntry, setFilterEntryAmount, removeFilterEntry, moveFilterEntry } from "../editor/filterchain.js";
import { toast } from "./toast.js";
import { toggleClip, toggleCollapsed } from "../editor/groups.js";
import { hasEnabledStyle, openLayerStyles } from "../editor/layerstyles.js";
import { initProperties } from "./properties.js";
import { fitAbove, fitInRect, view } from "../editor/view.js";

/* ── selección múltiple de capas ─────────────────────────────────
   Aparte de `doc.activeId` —que sigue siendo "la capa sobre la que
   actúan el resto de herramientas y paneles"—: esto es sólo "cuáles
   están marcadas para Alinear/Distribuir". Un clic normal la vacía y
   dice "sólo esta"; Ctrl o Mayús la va sumando. No vive en `doc`
   porque no es parte del documento, es un estado de la interfaz. */
let multiSelect = new Set();
export const getSelectedLayerIds = () => [...multiSelect];
function setMultiSelect(ids){ multiSelect = new Set(ids); emit("layers:multiselect"); }

const panels = document.getElementById("panels");
const veil   = document.getElementById("sheetVeil");
const grip   = document.getElementById("sheetGrip");
const mBtn   = document.getElementById("mPanels");

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
     con dos dedos, se amplía (`__panTool`, ver editor/view.js).
   · El botón fx de una capa abre su editor ENCIMA, sin cerrar Capas.
   · Ya no hace falta volver transparente la hoja al mover un
     deslizador (lo hacía la versión en media hoja): la imagen se ve
     entera y grande todo el rato. */
const fsTop = document.createElement("header");
fsTop.id = "layersTop";
fsTop.innerHTML = `<button type="button" data-lt="back" aria-label="Cerrar">✕</button>
  <b id="layersTopTitle">Capas</b>
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
    import("../editor/tools.js").then(m => { window.__panTool = !!m.current?.pan; });
    const r = fsRestore; fsRestore = null;
    requestAnimationFrame(() => r?.());
  }
}

/* ── panel de capas ── */
const layerList = document.getElementById("layerList");

/* Profundidad de anidamiento de cada capa (0 = nivel superior) y qué
   ids quedan ocultos en el panel porque alguno de sus grupos
   ancestros está plegado. Plegar no afecta al lienzo, sólo a esta
   lista: la capa sigue componiéndose con normalidad. */
function layerDepthsAndHidden(){
  const byId = new Map(doc.layers.map(l => [l.id, l]));
  const depth = new Map();
  const depthOf = l => {
    if(depth.has(l.id)) return depth.get(l.id);
    // `byId.get` puede no encontrar nada si `groupId` apunta a una capa
    // que ya no existe: se trata como nivel superior en vez de romper.
    const parent = l.groupId != null ? byId.get(l.groupId) : null;
    const d = parent ? 1 + depthOf(parent) : 0;
    depth.set(l.id, d);
    return d;
  };
  for(const l of doc.layers) depthOf(l);
  const hidden = new Set();
  for(const l of doc.layers){
    let p = l.groupId;
    while(p != null){
      const g = byId.get(p);
      if(!g) break;
      if(g.collapsed){ hidden.add(l.id); break; }
      p = g.groupId;
    }
  }
  return { depth, hidden };
}

/* Los `<input type=range>` dentro de una fila de capa viven bajo un
   contenedor arrastrable. En algunos navegadores el arrastre HTML de la fila
   gana al control nativo; en iOS, además, el gesto puede interpretarse como
   desplazamiento de la hoja. Controlamos el gesto directamente con Pointer
   Events: una sola ruta para ratón, lápiz y dedo, con captura hasta soltar.
   El evento `input` nativo se conserva para teclado y lectores de pantalla. */
function wireLayerRangeDrag(range, { start, preview, commit }){
  let pointerId = null;
  const setFromPointer = event => {
    const box = range.getBoundingClientRect();
    if(box.width <= 0) return;
    const min = Number(range.min || 0), max = Number(range.max || 100);
    const step = Number(range.step || 1) || 1;
    const ratio = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    const value = Math.round((min + (max - min) * ratio) / step) * step;
    range.value = String(Math.max(min, Math.min(max, value)));
    preview(+range.value);
  };
  const finish = event => {
    if(event.pointerId !== pointerId) return;
    setFromPointer(event);
    if(range.hasPointerCapture?.(pointerId)) range.releasePointerCapture(pointerId);
    pointerId = null;
    commit();
  };
  range.addEventListener("pointerdown", event => {
    if(event.button !== 0 && event.pointerType !== "touch") return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    start();
    range.focus({ preventScroll:true });
    range.setPointerCapture?.(pointerId);
    setFromPointer(event);
  });
  range.addEventListener("pointermove", event => {
    if(event.pointerId === pointerId) setFromPointer(event);
  });
  range.addEventListener("pointerup", finish);
  range.addEventListener("pointercancel", finish);
}

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
    const maskOn = l.mask && getMaskTarget() === l.id;
    // Foco en la imagen: la capa está activa y no hay foco de pintura
    // puesto en su máscara. El equivalente a los corchetes blancos de
    // Photoshop alrededor de la miniatura que se está editando.
    const imgOn = l.id === doc.activeId && getMaskTarget() !== l.id;
    if(multiSelect.has(l.id)) el.classList.add("multi");
    const fxEntry = filterOf(l);
    const fxChained = (l.filters?.length || 0) > 1;
    // El diálogo completo (con todos sus deslizadores propios) sólo
    // sabe recalcular su vista previa a partir de la capa de debajo,
    // así que sólo tiene sentido reabrirlo cuando la capa lleva UN
    // filtro — con más de uno encadenado, el ajuste fino se hace con
    // el interruptor y el porcentaje de cada fila (ver `.fxchain`
    // más abajo), no reabriendo ningún panel.
    const fxEditable = !!(fxEntry && knownFilter(fxEntry.id) && i > 0 && l.type !== "text" && !isAdjustLayer(l) && !isGroup && !fxChained);
    /* Efectos que no se pueden recalcular (herramientas de IA, efectos
       de Fotografía): también llevan porcentaje, como mezcla con la
       capa de debajo, siempre que sea del mismo tamaño. */
    const fxBase = fxEntry && !fxEditable && !fxChained && i > 0 ? doc.layers[i - 1] : null;
    const fxMixOnly = !!(fxBase && l.type !== "text" && !isAdjustLayer(l) && !isGroup && fxBase.canvas && l.canvas &&
      fxBase.canvas.width === l.canvas.width && fxBase.canvas.height === l.canvas.height);
    const fxSlider = fxEditable || fxMixOnly;
    const fxAmt = fxSlider ? filterAmount(l) : 100;
    const fxMode = fxMixOnly ? "mix" : fxEditable ? amountMode(l) : "scale";
    const styled = hasEnabledStyle(l.styles);
    const maskLabel = isGroup ? "grupo" : "capa";
    const maskHtml = l.mask
      ? `<div class="thumb mask-thumb${maskOn ? " on" : ""}${l.maskEnabled ? "" : " off"}"
          title="Máscara de ${maskLabel} — clic: pintarla (negro oculta, blanco muestra) · doble clic: propiedades · Mayús+clic: activar o desactivar · Ctrl+clic: cargar como selección · Alt+clic: ver y pintar sólo la máscara · clic derecho: más opciones"
          data-mask="1">⬚</div>`
      : `<button type="button" class="thumb add-mask" data-add-mask="1"
          title="Añadir máscara de ${maskLabel}${isGroup ? "" : " — Alt+clic: máscara negra u ocultar selección"}"
          aria-label="Añadir máscara de ${maskLabel}">+</button>`;
    el.innerHTML =
      `<button class="eye" title="Mostrar u ocultar" aria-label="Mostrar u ocultar capa">
         ${l.visible
           ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>'
           : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M17 17A10 10 0 0 1 12 19C5 19 1 12 1 12a18 18 0 0 1 5-5m4-2h1c7 0 11 7 11 7a18 18 0 0 1-2 3M1 1l22 22"/></svg>'}
       </button>
       ${isGroup ? `<button type="button" class="caret${l.collapsed ? "" : " open"}" data-caret="1"
              title="${l.collapsed ? "Desplegar grupo" : "Plegar grupo"}"
              aria-label="Plegar o desplegar grupo">›</button>` : ""}
       ${isGroup
          ? `<div class="thumb group-thumb${imgOn ? " on" : ""}" data-img="1" title="Grupo de capas">▤</div>`
          : isAdjustLayer(l)
          ? `<div class="thumb adjust-thumb${imgOn ? " on" : ""}" data-img="1" title="Capa de ajuste">◐</div>`
          : `<div class="thumb${imgOn ? " on" : ""}" data-img="1" style="background-image:url(${layerThumb(l)})"></div>`}
       ${maskHtml}
       <div class="meta">
         <div class="name">${escapeHtml(l.name)}</div>
         <div class="sub">${Math.round(l.opacity * 100)}%${l.filters.length ? " · " + l.filters.length + " filtro" + (l.filters.length > 1 ? "s" : "") : ""}</div>
       </div>
       ${l.type === "text" ? '<span class="fx" title="Capa de texto">T</span>' : ""}
       ${isAdjustLayer(l) ? `<button type="button" class="fx editable" data-open-fx="adjust"
           title="${escapeHtml(adjustTypeName(l.adjustType))} — abrir sus mandos">adj</button>` : ""}
       ${isFillLayer(l) ? `<span class="fx" title="Capa de relleno: ${escapeHtml(fillKindName(l.fill?.kind))}">rel</span>` : ""}
       ${isShapeLayer(l) ? `<span class="fx" title="Capa de forma: ${escapeHtml(SHAPE_KIND_NAME[l.shape?.kind] || "")}, editable con la herramienta Formas (U)">forma</span>` : ""}
       ${l.smart ? '<span class="fx smart-badge" title="Objeto inteligente: Transformación libre remuestrea siempre desde el original guardado, sin perder nitidez">obj</span>' : ""}
       ${l.dodgeBurn ? '<span class="fx" title="Capa gris de Dodge &amp; Burn — la herramienta sigue pintando aquí mientras esté activa">D&amp;B</span>' : ""}
       ${l.clipped ? '<span class="fx clip-badge" title="Recortada a la capa de abajo — Alt+clic en la miniatura para quitarlo">⌐</span>' : ""}
       ${isBlendIfActive(l.blendIf) ? '<span class="fx" title="Fusionar si activo: parte de esta capa (o de lo que tiene debajo) queda oculta por brillo, sin ninguna máscara pintada">FSi</span>' : ""}
       ${styled ? `<span class="fx style-badge editable" title="Estilos de capa activos — doble clic: editar">✦</span>` : ""}
       ${l.filters.length ? (fxEditable
           ? `<button type="button" class="fx editable" data-open-fx="filter" title="${escapeHtml(
               l.filters.map(f => f.name || f.id).join(" · "))} — abrir el panel del filtro">fx</button>`
           : `<span class="fx" title="${escapeHtml(l.filters.map(f => f.name || f.id).join(" · "))}${
               fxChained ? " — " + l.filters.length + " filtros encadenados" : ""}">fx${
               fxChained ? "·" + l.filters.length : ""}</span>`) : ""}
       ${fxSlider ? `<div class="fxrow" title="${fxMixOnly
           ? "Aplicación del efecto: mezcla el resultado con el original de la capa de debajo (100 % = el efecto entero, 0 % = el original), sin volver a calcularlo"
           : fxMode === "mix"
           ? "Aplicación del filtro: este filtro no tiene mandos de intensidad, así que el porcentaje mezcla el resultado con el original"
           : "Aplicación del filtro: vuelve a calcularlo con sus valores escalados a este porcentaje (no es la opacidad)"}">
           <span class="fxlab">${fxMode === "mix" ? "mezcla" : "filtro"}</span>
           <input type="range" class="fxamt" min="0" max="100" step="1" value="${fxAmt}" aria-label="Porcentaje de aplicación del filtro">
           <span class="mono fxval">${fxAmt}%</span>
         </div>` : ""}
       ${fxChained ? `<div class="fxchain">${l.filters.map((f, fi) => `
           <div class="fxchain-row" data-idx="${fi}">
             <input type="checkbox" class="fxc-on" ${f.enabled === false ? "" : "checked"}
               aria-label="Activar o desactivar ${escapeHtml(f.name || f.id)}">
             <span class="fxc-name" title="${escapeHtml(f.name || f.id)}">${escapeHtml(f.name || f.id)}</span>
             <input type="range" class="fxc-amt" min="0" max="100" step="1" value="${f.amount ?? 100}"
               aria-label="Porcentaje de ${escapeHtml(f.name || f.id)}">
             <span class="mono fxc-val">${f.amount ?? 100}%</span>
             <button type="button" class="fxc-up icon" title="Subir en la cadena" ${fi === 0 ? "disabled" : ""}>↑</button>
             <button type="button" class="fxc-down icon" title="Bajar en la cadena" ${fi === l.filters.length - 1 ? "disabled" : ""}>↓</button>
             <button type="button" class="fxc-remove icon" title="Quitar del encadenado">✕</button>
           </div>`).join("")}</div>` : ""}`;

    if(isGroup){
      el.querySelector("[data-caret]").addEventListener("click", e => {
        e.stopPropagation();
        toggleCollapsed(l.id);
      });
    }

    if(fxSlider){
      const row = el.querySelector(".fxrow");
      const range = row.querySelector(".fxamt");
      const val = row.querySelector(".fxval");
      // Ni el clic ni el arrastre sobre el deslizador deben seleccionar
      // la fila (que la vuelve a pintar y mata el gesto a medias).
      ["pointerdown", "click", "dblclick", "mousedown", "touchstart"].forEach(ev =>
        row.addEventListener(ev, e => e.stopPropagation(), { passive: ev === "touchstart" }));
      /* Toda la fila es `draggable="true"` (para reordenar/copiar la
         capa arrastrándola) y eso compite con el arrastre NATIVO del
         propio círculo del deslizador: aunque el `dragstart` de la
         fila ya evita empezar un arrastre de capa cuando el objetivo
         es un <input> (más abajo), el navegador sigue de fondo
         evaluando si el gesto ES un arrastre de elemento durante los
         primeros píxeles de movimiento, y esa evaluación le roba
         seguimiento fino al círculo justo al empezar a mover el ratón
         —se nota como que "no responde bien" al arrastrar—. Puesto
         explícitamente en `false`, el navegador ni se plantea la duda:
         el gesto es, desde el primer píxel, el propio del <input>. */
      row.draggable = false;
      let startAmt = fxAmt, committed = null;
      const preview = amount => {
        val.textContent = amount + "%";
        setFilterAmount(l, amount, { preview: true });
      };
      const commit = () => {
        const amount = +range.value;
        if(committed === amount || (amount === filterAmount(l) && amount === startAmt)) return;
        committed = amount;
        setFilterAmount(l, amount, { preview: false });
      };
      wireLayerRangeDrag(range, {
        start: () => { startAmt = filterAmount(l); committed = null; }, preview, commit
      });
      range.addEventListener("input", () => {
        preview(+range.value);
      });
      range.addEventListener("change", commit);
      // Doble clic en el deslizador: vuelve al 100 %
      range.addEventListener("dblclick", () => { range.value = 100; val.textContent = "100%"; setFilterAmount(l, 100); });
    }

    if(fxChained){
      const chain = el.querySelector(".fxchain");
      // Igual que en `.fxrow`: nada de lo que pasa dentro de la
      // cadena debe seleccionar la fila entera ni repintar el panel a
      // medio gesto, y tampoco debe competir con el arrastre nativo
      // de sus propios deslizadores (ver el comentario de `.fxrow`).
      ["pointerdown", "click", "dblclick", "mousedown", "touchstart"].forEach(ev =>
        chain.addEventListener(ev, e => e.stopPropagation(), { passive: ev === "touchstart" }));
      chain.draggable = false;

      chain.querySelectorAll(".fxchain-row").forEach(row => {
        const idx = +row.dataset.idx;
        const onBox = row.querySelector(".fxc-on");
        const range = row.querySelector(".fxc-amt");
        const val = row.querySelector(".fxc-val");

        onBox.addEventListener("change", () => toggleFilterEntry(l, idx));

        let startAmt = +range.value, committed = null;
        const preview = amount => {
          val.textContent = amount + "%";
          setFilterEntryAmount(l, idx, amount, { preview: true });
        };
        const commit = () => {
          const amount = +range.value;
          if(committed === amount || amount === startAmt) return;
          committed = amount;
          setFilterEntryAmount(l, idx, amount, { preview: false });
        };
        wireLayerRangeDrag(range, {
          start: () => { startAmt = l.filters[idx]?.amount ?? 100; committed = null; }, preview, commit
        });
        range.addEventListener("input", () => {
          preview(+range.value);
        });
        range.addEventListener("change", commit);
        range.addEventListener("dblclick", () => {
          range.value = 100; val.textContent = "100%";
          setFilterEntryAmount(l, idx, 100);
        });

        row.querySelector(".fxc-up").addEventListener("click", () => moveFilterEntry(l, idx, -1));
        row.querySelector(".fxc-down").addEventListener("click", () => moveFilterEntry(l, idx, 1));
        row.querySelector(".fxc-remove").addEventListener("click", () => removeFilterEntry(l, idx));
      });
    }

    el.addEventListener("dblclick", e => {
      if(e.target.closest("[data-mask]")){ setActive(l.id); revealProperties(); return; }
      if(e.target.closest(".style-badge")){
        setActive(l.id);
        openLayerStyles(l);
        return;
      }
      // «fx» y «adj» ya no están aquí: abren su panel con un solo clic
      // desde el manejador de `click` (ver más abajo).
      if(isAdjustLayer(l) && !e.target.closest(".eye") && !e.target.closest("[data-open-fx]")){
        setActive(l.id); revealProperties();
      }
    });
    // Toda la fila se puede arrastrar, con dos payloads distintos
    // según de dónde se agarre: desde la miniatura de máscara, copiar
    // o mover esa máscara a otra capa (abajo); desde cualquier otro
    // punto, soltarla sobre una PESTAÑA de la barra de documentos
    // (ui/docbar.js) copia la capa entera a ese otro documento — el
    // mismo gesto de «arrastrar a otra ventana» de cualquier editor,
    // adaptado a pestañas porque aquí no hay ventanas de verdad.
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
      if(isGroup) return;
      const tabs = listTabs();
      if(tabs.length < 2) return;
      e.preventDefault();
      setActive(l.id);
      const here = activeTab();
      openContextMenu(
        tabs.filter(t => t !== here)
            .map(t => ({ label: `Copiar capa a «${t.title}»`, onClick: () => copyLayerToTab(l, t.tabId) })),
        e.clientX, e.clientY
      );
    });
    el.addEventListener("click", e => {
      /* Insignia «fx» / «adj»: abre el panel del propio efecto con UN
         clic —o un toque en móvil—, que es lo que se espera de un
         botón que lleva escrito el nombre del filtro. Antes pedía
         doble clic y, encima, sólo desplazaba el panel de Propiedades
         a la vista sin abrir nada del filtro. */
      const fxBtn = e.target.closest("[data-open-fx]");
      if(fxBtn){
        e.stopPropagation();
        setActive(l.id);
        /* Móvil y escritorio piden cosas distintas aquí.

           En ESCRITORIO, los filtros con editor en vivo (Brillo y
           contraste, Niveles, Curvas…) y las capas de ajuste ya tienen
           sus mandos a la vista en el panel de Propiedades, al lado —
           ver ui/properties.js—: abrir encima un diálogo con los
           mismos deslizadores era la «ventana duplicada» que sobraba.
           Basta con llevar el foco a ese panel.

           En MÓVIL no hay «al lado»: Propiedades y Capas son la misma
           hoja, que además tapa la foto. Aquí lo útil es cerrar la
           hoja y abrir el panel del efecto, que sube como una hoja
           corta dejando la foto a la vista mientras se ajusta. Sin la
           hoja de capas delante ya no hay nada duplicado. */
        // Móvil: el editor del efecto se abre ENCIMA de Capas, sin cerrarla.
        const mob = isMobile();
        if(fxBtn.dataset.openFx === "adjust"){
          if(mob) openAdjustPanel(l); else revealProperties();
        } else if(!fxEntry || (filterLiveCapable(fxEntry.id) && !mob)){
          revealProperties();
        } else {
          openFilterEditor(l, fxEntry);
        }
        return;
      }
      if(e.target.closest(".eye")){
        const was = l.visible;
        l.visible = !was;
        record(was ? "Ocultar capa" : "Mostrar capa",
               () => { l.visible = was;  emit("doc:structure"); emit("doc:change"); },
               () => { l.visible = !was; emit("doc:structure"); emit("doc:change"); });
        emit("doc:structure"); emit("doc:change");
        return;
      }
      if(e.target.closest("[data-mask]")){
        setActive(l.id);
        if(e.shiftKey){
          // Mayús+clic: activar/desactivar sin entrar a pintarla,
          // igual que tachar la miniatura en Photoshop.
          toggleMask(l);
        } else if(e.ctrlKey || e.metaKey){
          // Ctrl/Cmd+clic: las zonas blancas de la máscara pasan a ser
          // la selección activa, tal cual el canal alfa que ya guardan.
          const alpha = maskAlphaAsSelectionMask(l.mask, doc.w, doc.h);
          commitSelection(alpha, "new");
        } else if(e.altKey){
          // Alt+clic: el lienzo enseña sólo la máscara en gris, y se
          // pinta sobre ella, hasta que se repite el gesto.
          const on = toggleIsolateView(l.id);
          toast(on ? "Máscara a la vista: pinta en negro para ocultar y en blanco para mostrar · Alt+clic de nuevo para volver" : "Vista normal");
        } else if(isMobile() && getMaskTarget() === l.id){
          // Móvil: segundo toque sobre la máscara ya elegida → su menú
          // (ver sólo la máscara, volver a la imagen, aplicar…).
          const r = e.target.closest("[data-mask]").getBoundingClientRect();
          // Tras este mismo clic (el «clic fuera» del menú lo cerraría)
          setTimeout(() => maskMenu(r.left, r.bottom), 0);
          return;
        } else {
          // Un segundo clic sobre la misma máscara vuelve a pintar la
          // capa; es el mismo gesto que alternar entre las dos
          // miniaturas en cualquier editor con capas.
          setMaskTarget(getMaskTarget() === l.id ? null : l.id);
          if(getMaskTarget() === null && getIsolateView() === l.id) setIsolateView(null);
        }
        renderLayers();
        return;
      }
      if(e.target.closest("[data-add-mask]")){
        // Máscara blanca (revela todo) o desde la selección; con Alt,
        // la variante opuesta de Photoshop —negra, u ocultar la
        // selección en vez de descubrirla—. Añadirla deja el destino
        // de pintura puesto para poder empezar a pintarla ya mismo.
        setActive(l.id);
        addMask(l, hasSelection(), e.altKey);
        setMaskTarget(l.id);
        renderLayers();
        return;
      }
      if(e.target.closest("[data-img]") && e.altKey && !isAdjustLayer(l)){
        // Alt+clic en la miniatura: «recortar a la capa de abajo», el
        // mismo gesto que Photoshop entre dos filas de capas —aquí,
        // más fácil de acertar, directamente sobre la miniatura—.
        setActive(l.id);
        const now = toggleClip(l.id);
        toast(now ? "Recortada a la capa de abajo" : "Recorte quitado");
        renderLayers();
        return;
      }
      if(e.target.closest("[data-img]") && !e.ctrlKey && !e.metaKey && !e.shiftKey){
        // Clic en la miniatura de la imagen: el foco vuelve a ella
        // aunque la máscara de esta misma capa lo tuviera puesto (y se
        // sale de la vista de sólo la máscara).
        setActive(l.id);
        setMaskTarget(null);
        if(getIsolateView() !== null) setIsolateView(null);
        renderLayers();
        return;
      }
      if(e.ctrlKey || e.metaKey){
        const s = new Set(multiSelect);
        s.has(l.id) ? s.delete(l.id) : s.add(l.id);
        setMultiSelect(s);
        setActive(l.id);
        renderLayers();
        return;
      }
      if(e.shiftKey && multiSelect.size){
        // Rango contiguo entre la última marcada y ésta, en el orden
        // en que aparecen en el panel (de arriba abajo).
        const ids = doc.layers.map(x => x.id).slice().reverse();
        const last = [...multiSelect][multiSelect.size - 1];
        const a = ids.indexOf(last), b = ids.indexOf(l.id);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setMultiSelect(ids.slice(lo, hi + 1));
        setActive(l.id);
        renderLayers();
        return;
      }
      setMultiSelect([l.id]);
      setActive(l.id);
    });
    layerList.appendChild(el);
  }
  syncLayerControls();
}

function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

const opacityEl = document.getElementById("layerOpacity");
const opacityVal = document.getElementById("layerOpacityVal");
const blendEl = document.getElementById("layerBlend");

function wireLayerControls(){
  let before = null;
  opacityEl.addEventListener("pointerdown", () => {
    const l = activeLayer(); before = l ? l.opacity : null;
  });
  opacityEl.addEventListener("input", () => {
    const l = activeLayer();
    if(!l) return;
    // Con el teclado (flechas, Inicio/Fin) no hay `pointerdown`: sin
    // esto `before` seguía a null y el cambio no llegaba al historial.
    if(before === null) before = l.opacity;
    l.opacity = +opacityEl.value / 100;
    opacityVal.textContent = opacityEl.value + "%";
    emit("doc:change");
  });
  const commitOpacity = () => {
    const l = activeLayer();
    if(!l || before === null) return;
    const from = before, to = l.opacity;
    before = null;
    if(Math.abs(from - to) < 1e-6) return;
    record("Opacidad",
      () => { l.opacity = from; emit("doc:structure"); emit("doc:change"); },
      () => { l.opacity = to;   emit("doc:structure"); emit("doc:change"); });
    emit("doc:structure");
  };
  opacityEl.addEventListener("pointerup", commitOpacity);
  opacityEl.addEventListener("change", commitOpacity);
  opacityEl.addEventListener("blur", commitOpacity);

  blendEl.addEventListener("change", () => {
    const l = activeLayer();
    if(!l) return;
    const from = l.blend, to = blendEl.value;
    l.blend = to;
    record("Modo de fusión",
      () => { l.blend = from; syncLayerControls(); emit("doc:change"); },
      () => { l.blend = to;   syncLayerControls(); emit("doc:change"); });
    emit("doc:change");
  });
}

function syncLayerControls(){
  const l = activeLayer();
  const on = !!l;
  opacityEl.disabled = blendEl.disabled = !on;
  if(!on) return;
  opacityEl.value = Math.round(l.opacity * 100);
  opacityVal.textContent = opacityEl.value + "%";
  blendEl.value = l.blend;
}

/* ── instantáneas ──
   Encima del historial paso a paso, en el mismo panel: copias
   completas y con nombre del documento, que no se sueltan solas de
   la memoria como sí hace el historial normal bajo presión —ver
   core/snapshots.js—. El círculo de la izquierda marca cuál es el
   origen del Pincel de historial. */
const snapshotEl = document.getElementById("snapshotList");

export function renderSnapshots(){
  const list = listSnapshots();
  const sourceId = getBrushSourceId();
  snapshotEl.innerHTML = "";
  for(const s of list){
    const row = document.createElement("div");
    row.className = "snap-row";
    row.innerHTML = `
      <button type="button" class="snap-src${s.id === sourceId ? " on" : ""}"
        title="${s.id === sourceId ? "Origen del pincel de historial" : "Usar como origen del pincel de historial"}"
        aria-label="Origen del pincel de historial">●</button>
      <button type="button" class="snap-name" title="Clic: volver a esta instantánea · Doble clic: renombrar">
        ${escapeHtml(s.name)}</button>
      <button type="button" class="snap-remove icon" title="Eliminar instantánea" aria-label="Eliminar instantánea">✕</button>`;
    row.querySelector(".snap-src").addEventListener("click", () => { setBrushSource(s.id); });
    row.querySelector(".snap-name").addEventListener("click", () => { restoreSnapshot(s.id); });
    row.querySelector(".snap-name").addEventListener("dblclick", async e => {
      e.stopPropagation();
      const name = await promptDlg("Renombrar instantánea", "Nombre", s.name);
      if(name) renameSnapshot(s.id, name);
    });
    row.querySelector(".snap-remove").addEventListener("click", async () => {
      if(await confirmDlg("Eliminar instantánea", `Se borra «${s.name}». No afecta al historial de deshacer.`, "Eliminar")){
        removeSnapshot(s.id);
      }
    });
    snapshotEl.appendChild(row);
  }
}

/* ── panel de historial ── */
const historyEl = document.getElementById("historyList");

export function renderHistory(){
  const h = historyList();
  historyEl.innerHTML = "";
  const mk = (label, i, cls) => {
    const b = document.createElement("button");
    b.className = "hitem " + cls;
    b.innerHTML = `<span class="n">${i}</span><span>${escapeHtml(label)}</span>`;
    b.addEventListener("click", () => jumpTo(i));
    return b;
  };
  h.past.forEach((e, i) =>
    historyEl.appendChild(mk(e.label, i, i === h.past.length - 1 ? "now" : "")));
  h.future.slice().reverse().forEach((e, i) =>
    historyEl.appendChild(mk(e.label, h.past.length + i, "future")));
  if(!h.past.length && !h.future.length){
    historyEl.innerHTML = '<p class="hint" style="margin:0">Sin cambios todavía.</p>';
  }
  historyEl.scrollTop = historyEl.scrollHeight;
}

/* ── información ── */
const infoBody = document.getElementById("infoBody");
export function renderInfo(){
  if(!doc.open){ infoBody.textContent = "Sin documento."; return; }
  const l = activeLayer();
  const mp = (doc.w * doc.h / 1e6).toFixed(1);
  const mem = (doc.layers.length * doc.w * doc.h * 4 / 1048576).toFixed(0);
  infoBody.innerHTML =
    `<div class="field"><label>Documento</label><span class="mono">${doc.w} × ${doc.h}</span></div>
     <div class="field"><label>Megapíxeles</label><span class="mono">${mp} MP</span></div>
     <div class="field"><label>Capas</label><span class="mono">${doc.layers.length}</span></div>
     <div class="field"><label>Memoria</label><span class="mono">~${mem} MB</span></div>
     ${l ? `<div class="field"><label>Activa</label><span>${escapeHtml(l.name)}</span></div>` : ""}
     ${doc.source ? `<div class="field"><label>Origen</label><span class="mono">${doc.source.w} × ${doc.source.h}</span></div>` : ""}`;
}

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
