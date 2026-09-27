/* ═══════════════════════════════════════════════════════════════
   DOCUMENTOS (pestañas)
   El resto de la aplicación trabaja siempre sobre `doc`, `view` y el
   historial como si sólo existiera un documento: casi cuatrocientos
   sitios leen `doc.w`, `doc.layers`, etc. Reescribirlos todos para
   que acepten «qué documento» habría sido un cambio enorme y frágil.

   En vez de eso, este módulo trata `doc`/`view`/el historial como una
   PIZARRA ÚNICA que se puede borrar y volver a escribir: cada pestaña
   guarda una foto de esos tres objetos mientras no es la activa, y al
   cambiar de pestaña se copian sus campos encima de la pizarra en
   vez de sustituirla. Como `doc` y `view` son objetos exportados con
   `const` (nunca se reasigna la propia variable, sólo sus
   propiedades), esto es válido desde fuera sin tocar un solo import
   del resto del proyecto: `doc.layers = otraCosa` funciona igual la
   escriba doc.js o este módulo.

   Con eso resuelto, cortar/copiar/pegar entre documentos sale gratis:
   el portapapeles de editor/clipboard.js ya vivía FUERA de `doc`
   (nunca se le ocurrió que hiciera falta), así que copiar en una
   pestaña y pegar en otra ya funcionaba antes de escribir esta línea.
   ═══════════════════════════════════════════════════════════════ */

import { doc, closeDoc, addLayer } from "./doc.js";
import { emit, on } from "./bus.js";
import * as history from "./history.js";
import * as snapshots from "./snapshots.js";
import { view, apply as applyView } from "../editor/view.js";
import { invalidateCompareBaseline } from "../editor/tools.js";
import { anyDialogOpen, confirmDlg } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";

const TAB_THUMB = 64;

let tabs = [];            // [{ tabId, title, thumb, snapshot }] — snapshot es null cuando es la pestaña activa
let activeTabId = null;
let nextTabId = 1;
/* Silencia el refresco automático de título/miniatura mientras
   `openAsNewTab` está a mitad de instalar un documento — ver el
   comentario junto a esa función. */
let suspended = false;

export const listTabs = () => tabs;
export const activeTab = () => tabs.find(t => t.tabId === activeTabId) || null;
export const tabCount = () => tabs.length;

/* Miniatura barata: compone directamente a tamaño de icono en vez de
   componer a resolución completa y luego reducir — con un documento
   de 24 MP y cuarenta capas, la diferencia es notarla o no notarla. */
function makeTabThumb(){
  if(!doc.open || !doc.layers.length) return null;
  const s = Math.min(TAB_THUMB / doc.w, TAB_THUMB / doc.h, 1);
  const w = Math.max(1, Math.round(doc.w * s)), h = Math.max(1, Math.round(doc.h * s));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  for(const l of doc.layers){
    if(!l.visible || l.opacity <= 0) continue;
    x.save();
    x.globalAlpha = l.opacity;
    try{ x.globalCompositeOperation = l.blend; }catch{ /* modo no soportado: se queda en normal */ }
    x.drawImage(l.canvas, 0, 0, w, h);
    x.restore();
  }
  return c.toDataURL();
}

/* Actualiza el título y la miniatura de la pestaña activa a partir del
   estado actual de `doc`. Barato de llamar a menudo salvo por el
   `toDataURL`, así que quien llame en caliente (arrastrando un
   deslizador) debe espaciarlo — ver `scheduleThumbRefresh`. */
export function refreshActiveTabMeta(){
  const t = activeTab();
  if(!t) return;
  t.title = doc.name || "Sin título";
  t.thumb = makeTabThumb();
  emit("docs:change");
}

let thumbTimer = null;
function scheduleThumbRefresh(){
  if(thumbTimer) return;
  thumbTimer = setTimeout(() => { thumbTimer = null; refreshActiveTabMeta(); }, 900);
}

function snapshotLive(){
  return {
    doc: {
      open: doc.open, w: doc.w, h: doc.h, name: doc.name, layers: doc.layers,
      activeId: doc.activeId, source: doc.source, selection: doc.selection, guides: doc.guides
    },
    view: { zoom: view.zoom, x: view.x, y: view.y, fitted: view.fitted },
    history: history.exportState(),
    snapshots: snapshots.exportState()
  };
}

function loadSnapshot(snap){
  Object.assign(doc, snap.doc);
  Object.assign(view, snap.view);
  history.importState(snap.history);
  snapshots.importState(snap.snapshots);
}

/* Guarda el estado vivo en la pestaña activa, si hay alguna y tiene
   algo que guardar. No hace nada la primerísima vez (todavía no hay
   ninguna pestaña) ni si el documento se acaba de cerrar del todo. */
function stashActive(){
  const t = activeTab();
  if(t && doc.open) t.snapshot = snapshotLive();
}

/* Tras cambiar la pestaña activa —o cerrar la que se estaba viendo—
   hay que avisar a todo el mundo como si el documento hubiera
   cambiado de golpe: compositor, reglas, historial, barra de estado,
   herramienta activa… Es la misma batería de eventos que ya dispara
   cualquier operación estructural, más `doc:resize` —que aquí no
   cambia el tamaño de nada, pero es la que ya usan las reglas para
   recalcular su longitud y Mover/Licuar para soltar sus búferes de la
   pestaña anterior— y una invalidación explícita del original que usa
   Comparar, que vive fuera de `doc` y si no se avisara seguiría
   comparando contra los píxeles de la pestaña vieja. */
function announceSwitch(){
  invalidateCompareBaseline();
  applyView();
  emit("doc:structure");
  emit("doc:change");
  emit("doc:active");
  emit("doc:resize");
  emit("history:change");
  emit("sel:change");
  emit("docs:change");
}

function blockedByDialog(){
  if(!anyDialogOpen()) return false;
  toast("Cierra el diálogo abierto antes de cambiar de documento", "err");
  return true;
}

export function switchTo(tabId){
  if(tabId === activeTabId) return true;
  if(blockedByDialog()) return false;
  const target = tabs.find(t => t.tabId === tabId);
  if(!target || !target.snapshot) return false;
  stashActive();
  loadSnapshot(target.snapshot);
  target.snapshot = null;
  activeTabId = tabId;
  announceSwitch();
  return true;
}

export function switchByOffset(delta){
  if(!tabs.length) return;
  const i = tabs.findIndex(t => t.tabId === activeTabId);
  const j = ((i < 0 ? 0 : i) + delta + tabs.length) % tabs.length;
  switchTo(tabs[j].tabId);
}

export function switchByIndex(i){
  if(tabs[i]) switchTo(tabs[i].tabId);
}

/**
 * Ejecuta `loader` (que debe dejar el documento cargado en la `doc`
 * viva, típicamente llamando a `newDoc()` o a `openFile()`) y registra
 * el resultado como una pestaña NUEVA, dejando intacta la que hubiera
 * antes. Es el camino que usan «Abrir imagen», «Documento nuevo» y
 * «Abrir lote de uno» — cualquier cosa que deba sumarse a la sesión en
 * vez de sustituir lo que ya había abierto.
 *
 * `openFile()` no lanza si el archivo no se puede leer —avisa con un
 * toast y deja la `doc` viva tal cual estaba—, pero otros loaders
 * (`restoreProject`, por ejemplo) sí lo hacen si el archivo no es
 * válido. Cualquiera de las dos formas de fallar tiene que deshacer
 * el volcado antes de devolver el control: un archivo malo nunca debe
 * dejar la pestaña de antes con su foto guardada puesta pero sin
 * marcar como activa —esa combinación no debería darse nunca, y
 * dejarla pasar rompería a cualquiera que asuma que «la pestaña
 * activa nunca tiene foto guardada», que es justo lo que hace, por
 * ejemplo, el menú de «copiar capa a otro documento».

 * Sin archivo que falle, `doc.layers` es cómo se distingue «el loader
 * de verdad ha creado un documento» de «ha fallado en silencio y no
 * ha tocado nada»: `newDoc()` y `restoreProject()` siempre instalan
 * un array nuevo, así que si sigue siendo el mismo de antes, no ha
 * pasado nada de verdad. */
export async function openAsNewTab(loader){
  if(blockedByDialog()) return false;
  const prevLayers = doc.layers;
  const prevTab = activeTab();
  stashActive();
  const rollback = () => { if(prevTab && prevTab.snapshot){ loadSnapshot(prevTab.snapshot); prevTab.snapshot = null; } };
  let created = false;
  /* `loader` —normalmente `newDoc()` u `openFile()`— dispara sus
     propios «doc:structure»/«doc:change» EN CUANTO instala el
     documento, que es antes de que esta función haya podido apuntar
     `activeTabId` a la pestaña nueva todavía inexistente: si el
     refresco automático de más abajo reaccionara a esos eventos,
     escribiría el nombre y la miniatura del documento que se está
     cargando encima de la pestaña VIEJA, que sigue siendo la activa
     un instante más. Se silencia mientras tanto; el propio
     `refreshActiveTabMeta()` de aquí abajo lo hace en el momento
     correcto, ya con la pestaña nueva puesta. */
  suspended = true;
  try{
    await loader();
    created = doc.open && doc.layers !== prevLayers;
  }finally{
    suspended = false;
    if(!created) rollback();
  }
  if(!created) return false;
  const tabId = nextTabId++;
  tabs.push({ tabId, title: doc.name, thumb: null });
  activeTabId = tabId;
  refreshActiveTabMeta();
  return true;
}

/* Cierra una pestaña por su id. Si es la activa, se activa la vecina
   más cercana (o se vuelve al estado «sin documento» si era la
   última); si no lo es, sólo desaparece su foto guardada sin tocar
   nada de lo que se está viendo ahora mismo. */
export async function closeTab(tabId, { confirm = true } = {}){
  if(blockedByDialog()) return false;
  const idx = tabs.findIndex(t => t.tabId === tabId);
  if(idx < 0) return false;
  if(confirm && !(await confirmDlg("Cerrar documento",
       "Se perderá lo que no hayas exportado.", "Cerrar"))) return false;

  const wasActive = tabId === activeTabId;
  tabs.splice(idx, 1);

  if(!wasActive){ emit("docs:change"); return true; }

  if(tabs.length){
    const next = tabs[Math.min(idx, tabs.length - 1)];
    loadSnapshot(next.snapshot);
    next.snapshot = null;
    activeTabId = next.tabId;
    announceSwitch();
  } else {
    activeTabId = null;
    closeDoc();
    history.importState(null);
    snapshots.importState(null);
    emit("docs:change");
  }
  return true;
}

export const closeActiveTab = (opts) => activeTabId !== null && closeTab(activeTabId, opts);

/* Reordena arrastrando una pestaña sobre otra. */
export function moveTab(tabId, beforeTabId){
  const i = tabs.findIndex(t => t.tabId === tabId);
  if(i < 0) return;
  const [t] = tabs.splice(i, 1);
  const j = beforeTabId === null ? tabs.length : tabs.findIndex(x => x.tabId === beforeTabId);
  tabs.splice(j < 0 ? tabs.length : j, 0, t);
  emit("docs:change");
}

/* ── copiar una capa a otro documento ─────────────────────────────
   Se recorta un lienzo con el contenido de la capa MIENTRAS su
   documento sigue siendo el vivo, se cambia a la pestaña destino (que
   pasa a ser la viva) y ahí se inserta como una capa normal — el
   mismo camino que pegar una imagen. Nunca hay dos documentos «vivos»
   a la vez, así que no hace falta ningún cuidado especial con qué
   array de capas pertenece a quién. */
export function copyLayerToTab(layer, targetTabId){
  if(!layer || targetTabId === activeTabId) return false;
  const target = tabs.find(t => t.tabId === targetTabId);
  if(!target) return false;

  const snap = document.createElement("canvas");
  snap.width = layer.canvas.width; snap.height = layer.canvas.height;
  snap.getContext("2d").drawImage(layer.canvas, 0, 0);
  const name = layer.name;
  const opacity = layer.opacity, blend = layer.blend;

  if(!switchTo(targetTabId)) return false;

  const l = addLayer({ name });
  const s = Math.min(doc.w / snap.width, doc.h / snap.height, 1);
  const w = snap.width * s, h = snap.height * s;
  l.ctx.drawImage(snap, (doc.w - w) / 2, (doc.h - h) / 2, w, h);
  l.opacity = opacity; l.blend = blend;
  l.thumbDirty = true;
  emit("doc:structure"); emit("doc:change");
  toast(`«${name}» copiada a ${target.title}`, "ok");
  return true;
}

/* Repinta la miniatura/nombre de la pestaña activa cuando cambia algo
   de verdad, con un margen para no recalcular en cada fotograma de
   una vista previa en vivo. */
on("doc:structure", () => { if(!suspended && activeTabId !== null) refreshActiveTabMeta(); });
on("doc:change", () => { if(!suspended && activeTabId !== null) scheduleThumbRefresh(); });
