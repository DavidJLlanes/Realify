/* ═══════════════════════════════════════════════════════════════
   HISTORIAL
   El problema real de deshacer en un editor de imagen es la memoria:
   una capa de 24 MP son 96 MB en RGBA, y cuarenta pasos de eso son
   casi cuatro gigas. Por eso hay dos clases de entrada:

   - Ligeras: guardan un objeto pequeño (opacidad, orden de capas,
     parámetros de un filtro). Cuestan bytes.
   - De píxeles: guardan el contenido de UNA capa. Cuestan mucho, así
     que se limitan aparte y las más viejas se van tirando aunque
     todavía quepan pasos ligeros.

   El resultado es que mover deslizadores no consume presupuesto y
   pintar sí, que es como debe ser.
   ═══════════════════════════════════════════════════════════════ */

import { emit } from "./bus.js";
import { doc } from "./doc.js";
import { toast } from "../ui/toast.js";

const DEFAULT_STEPS = 60;
const MAX_PIXEL_BYTES = 840 * 1024 * 1024;   // techo blando para las capturas

/* Número de pasos, configurable y compartido por deshacer y rehacer.
   Se guarda entre sesiones porque es una preferencia sobre cuánta
   memoria está uno dispuesto a gastar, no algo que apetezca repetir
   cada vez que se abre el editor. */
let maxSteps = DEFAULT_STEPS;
try{
  const v = +localStorage.getItem("realify.histlevels");
  if(v >= 5 && v <= 200) maxSteps = v;
}catch{}

export const historyLevels = () => maxSteps;

export function setHistoryLevels(n){
  maxSteps = Math.max(5, Math.min(200, Math.round(n) || DEFAULT_STEPS));
  try{ localStorage.setItem("realify.histlevels", String(maxSteps)); }catch{}
  trim();
  emit("history:change");
  return maxSteps;
}

let past = [];
let future = [];
let pixelBytes = 0;
let depth = 0;          // para agrupar operaciones anidadas

/* Una entrada de píxeles guarda DOS capturas, la de antes y la de
   después. Antes aquí se contaba una sola, así que el presupuesto de
   memoria creía ir por la mitad de lo que realmente gastaba y el techo
   efectivo era el doble del declarado. Ahora la cuenta es honesta y la
   constante de arriba dice el doble, que es lo que se venía usando de
   verdad. */
const bytesOf = e => e.kind === "pixels" ? e.w * e.h * 4 * 2 : 0;

function trim(){
  // El mismo tope para los dos lados: tantos pasos hacia atrás como
  // hacia delante. De `future` se tira por el principio, que es el
  // paso más adelantado en el tiempo y el que menos falta hace.
  while(past.length > maxSteps) drop(past.shift());
  while(future.length > maxSteps) drop(future.shift());

  /* Si nos pasamos de memoria se sacrifican capturas: ese paso deja de
     poder recorrerse. Primero las de rehacer más adelantadas —a las
     que sólo se llega volviendo sobre los pasos, así que son las menos
     probables— y sólo después las de deshacer más viejas. Antes sólo
     se miraba `past`: tras deshacer mucho, todas las capturas vivían
     en `future` sin que nadie las contase para nada. */
  let i = 0;
  while(pixelBytes > MAX_PIXEL_BYTES && i < future.length){
    if(future[i].kind === "pixels"){ drop(future[i]); future.splice(i, 1); }
    else i++;
  }
  i = 0;
  while(pixelBytes > MAX_PIXEL_BYTES && i < past.length){
    if(past[i].kind === "pixels"){ drop(past[i]); past.splice(i, 1); }
    else i++;
  }
}

function drop(e){
  if(!e) return;
  if(e.kind === "pixels"){
    pixelBytes -= bytesOf(e);
    e.before = null; e.after = null;
  }
}

function push(entry){
  past.push(entry);
  if(entry.kind === "pixels") pixelBytes += bytesOf(entry);
  for(const f of future) drop(f);
  future = [];
  trim();
  emit("history:change");
}

/* ── entradas ligeras ───────────────────────────────────────── */
export function record(label, undoFn, redoFn){
  if(depth > 0) return;
  push({ kind: "light", label, undo: undoFn, redo: redoFn, t: Date.now() });
}

/* Un cambio de ESTRUCTURA —crear, duplicar o eliminar capas— como un
   solo paso de deshacer: se guarda la lista de capas y la activa de
   antes y de después de `fn`, y deshacer/rehacer sólo vuelve a poner
   una u otra. Los objetos de capa no se copian (ninguno se destruye al
   quitarlo de la lista), pero la LISTA sí se copia cada vez que se
   restaura: `addLayer` y compañía hacen `splice` sobre `doc.layers`
   en el sitio, y si el historial compartiera ese mismo array, el
   siguiente cambio reescribiría lo que se había guardado. Devuelve lo
   que devuelva `fn`; si la lista no cambió, no graba nada. */
export function recordLayers(label, fn){
  const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
  const result = fn();
  const nextLayers = doc.layers.slice(), nextActive = doc.activeId;
  const same = prevLayers.length === nextLayers.length &&
               prevLayers.every((l, i) => l === nextLayers[i]);
  if(same) return result;
  const put = (layers, active) => {
    doc.layers = layers.slice(); doc.activeId = active;
    emit("doc:structure"); emit("doc:change");
  };
  record(label, () => put(prevLayers, prevActive), () => put(nextLayers, nextActive));
  return result;
}

/* Captura el estado ANTES de tocar la capa; se cierra con commit().
   `useMask` desvía todo el mecanismo a la máscara de la capa en vez
   de a su contenido: mismo camino de deshacer, mismo cancelar a
   mitad de gesto, sólo cambia a qué lienzo apunta. */
let pending = null;

function targetCanvas(layer, useMask){
  return useMask ? (layer.mask && layer.mask.canvas) : layer.canvas;
}

/* Los cuatro campos de objeto inteligente de una capa, en un objeto
   suelto — para poder guardar «cómo estaban antes» y restaurarlos tal
   cual con `restoreSmart`, igual que `before`/`after` hacen con los
   píxeles. `smartSource` es sólo una referencia al mismo lienzo (nunca
   se muta en el sitio, sólo se reasigna), así que copiarla aquí no
   copia píxeles de más. */
function smartSnapshot(layer){
  return { smart: layer.smart, smartSource: layer.smartSource,
           smartTransform: layer.smartTransform, smartBox: layer.smartBox };
}
function restoreSmart(layer, s){
  if(!layer || !s) return;
  layer.smart = s.smart; layer.smartSource = s.smartSource;
  layer.smartTransform = s.smartTransform; layer.smartBox = s.smartBox;
}

export function beginPixels(label, layer, useMask = false, opts = null){
  if(depth > 0 || !layer) return;
  /* Una capa de relleno o de forma (editor/layercontent.js) no guarda
     su contenido en los píxeles: los regenera enteros desde sus
     parámetros en cuanto cambian. Sin este aviso, pintar encima
     parecería funcionar un instante y luego desaparecería sin
     explicación en cuanto se tocara cualquier mando del panel de
     Propiedades —o, con un degradado o un motivo, en el instante
     mismo, porque ya se repintan solos al crearse—. La máscara de
     estas capas sí es de verdad editable a mano, así que sólo se
     bloquea pintar la capa en sí (`useMask` sigue su camino normal). */
  if(!useMask && (layer.type === "fill" || layer.type === "shape")){
    toast(`«${layer.name}» se genera desde sus propios parámetros: cámbialos en el panel de Propiedades en vez de pintar encima.`, "err");
    return;
  }
  const c = targetCanvas(layer, useMask);
  if(!c) return;                     // pintar una máscara que no existe: no-op
  // La máscara es aparte del objeto inteligente y no le afecta: sólo
  // pintar la capa misma la convierte en una capa normal (ver abajo).
  const smartBefore = useMask ? null : smartSnapshot(layer);
  /* Pintar DIRECTAMENTE los píxeles de un objeto inteligente
     contradice lo que lo hace inteligente: la próxima transformación
     volvería a partir del original guardado y se llevaría el trazo
     por delante sin avisar. Se convierte en una capa normal en el
     momento de tocarla, no antes — así sigue pudiendo escalarse o
     rotarse sin perder nitidez hasta el mismísimo instante en que
     alguien pinta encima. */
  if(!useMask && layer.smart){
    layer.smart = false; layer.smartSource = null;
    layer.smartTransform = null; layer.smartBox = null;
    toast("«" + layer.name + "» ha dejado de ser un objeto inteligente: se ha pintado directamente sobre ella");
  }
  const sparse=!!opts?.sparse,rect=sparse?clipRect(opts.rect,c.width,c.height):{x:0,y:0,w:c.width,h:c.height};
  pending = {
    kind: "pixels", label, layerId: layer.id, useMask,
    x:rect.x,y:rect.y,w:rect.w,h:rect.h,full:!sparse,
    before: snapshotRect(c,rect), smartBefore,
    after: null, smartAfter: null, t: Date.now()
  };
}

function clipRect(r,w,h){const x=Math.max(0,Math.floor(r?.x||0)),y=Math.max(0,Math.floor(r?.y||0)),x2=Math.min(w,Math.ceil((r?.x||0)+(r?.w||w))),y2=Math.min(h,Math.ceil((r?.y||0)+(r?.h||h)));return{x,y,w:Math.max(1,x2-x),h:Math.max(1,y2-y)};}
function snapshotRect(c,r){const t=document.createElement("canvas");t.width=r.w;t.height=r.h;t.getContext("2d").drawImage(c,r.x,r.y,r.w,r.h,0,0,r.w,r.h);return t;}

/* Amplía una captura parcial ANTES de pintar el siguiente segmento.
   La zona anterior se repone desde la primera captura y las bandas
   nuevas se leen de la capa todavía intacta. */
export function expandPendingPixels(rect){
  if(!pending||pending.full)return;
  const layer=doc.layers.find(l=>l.id===pending.layerId),c=layer&&targetCanvas(layer,pending.useMask);if(!c)return;
  const r=clipRect(rect,c.width,c.height),x=Math.min(pending.x,r.x),y=Math.min(pending.y,r.y),x2=Math.max(pending.x+pending.w,r.x+r.w),y2=Math.max(pending.y+pending.h,r.y+r.h);
  if(x===pending.x&&y===pending.y&&x2===pending.x+pending.w&&y2===pending.y+pending.h)return;
  const u={x,y,w:x2-x,h:y2-y},next=snapshotRect(c,u);next.getContext("2d").drawImage(pending.before,pending.x-u.x,pending.y-u.y);
  pending.x=u.x;pending.y=u.y;pending.w=u.w;pending.h=u.h;pending.before=next;
}

export function commitPixels(){
  if(!pending) return;
  const layer = doc.layers.find(l => l.id === pending.layerId);
  const c = layer && targetCanvas(layer, pending.useMask);
  if(!c){ pending = null; return; }
  pending.after = pending.full?snapshotCanvas(c):snapshotRect(c,pending);
  pending.smartAfter = pending.smartBefore ? smartSnapshot(layer) : null;
  push(pending);
  pending = null;
}

export function cancelPixels(){ pending = null; }

/* Deshace un trazo a medias devolviendo la capa a como estaba antes
   de empezarlo, y cierra la entrada pendiente sin dejar nada en el
   historial. Hace falta cuando un segundo dedo interrumpe un trazo
   para pellizcar: sin esto, un pincel a medio camino se queda con un
   punto de pintura pegado en pantalla para siempre, porque la capa de
   dibujo temporal nunca se cierra. Para las herramientas que escriben
   directo en la capa (borrador, clonar, exponer, emborronar, mover),
   restaura los píxeles reales; para las que dibujan sobre una capa de
   trazo aparte (pincel, degradado, formas) la capa nunca llegó a
   tocarse, así que restaurar es un no-op inofensivo. */
export function abortPixels(){
  if(!pending) return;
  const layer = doc.layers.find(l => l.id === pending.layerId);
  if(layer && pending.before) restoreCanvas(layer, pending.before, pending.useMask, pending);
  if(layer) restoreSmart(layer, pending.smartBefore);
  pending = null;
}

function snapshotCanvas(c){
  const t = document.createElement("canvas");
  t.width = c.width; t.height = c.height;
  t.getContext("2d").drawImage(c, 0, 0);
  return t;
}

function restoreCanvas(layer, snap, useMask = false, entry = null){
  if(!layer || !snap) return;
  const c = useMask ? (layer.mask && layer.mask.canvas) : layer.canvas;
  if(!c) return;
  const full=!entry||entry.full!==false;
  if(full&&(c.width !== snap.width || c.height !== snap.height)){
    c.width = snap.width; c.height = snap.height;
  }
  const x = useMask ? layer.mask.ctx : layer.ctx;
  x.save();
  x.globalCompositeOperation = full ? "copy" : "source-over";
  x.globalAlpha = 1;
  if(!full)x.clearRect(entry.x,entry.y,entry.w,entry.h);
  x.drawImage(snap, full?0:entry.x, full?0:entry.y);
  x.restore();
  layer.thumbDirty = true;
}

/* Agrupa varias operaciones en un solo paso de deshacer. */
export function batch(label, fn){
  if(depth > 0){ fn(); return; }
  depth++;
  let undoData = null;
  try{
    undoData = fn();
  } finally {
    depth--;
  }
  return undoData;
}

/* ── deshacer y rehacer ─────────────────────────────────────── */
export function undo(){
  const e = past.pop();
  if(!e) return false;
  applyReverse(e);
  future.push(e);
  trim();               // rehacer tiene el mismo tope que deshacer
  emit("history:change");
  emit("doc:change");
  return true;
}

export function redo(){
  const e = future.pop();
  if(!e) return false;
  applyForward(e);
  past.push(e);
  emit("history:change");
  emit("doc:change");
  return true;
}

function applyReverse(e){
  if(e.kind === "light"){ e.undo(); return; }
  const layer = doc.layers.find(l => l.id === e.layerId);
  if(!e.before){
    // Su captura se liberó por presión de memoria
    emit("history:lost", e);
    return;
  }
  restoreCanvas(layer, e.before, e.useMask, e);
  restoreSmart(layer, e.smartBefore);
  emit("doc:structure");
}

function applyForward(e){
  if(e.kind === "light"){ e.redo(); return; }
  const layer = doc.layers.find(l => l.id === e.layerId);
  restoreCanvas(layer, e.after, e.useMask, e);
  restoreSmart(layer, e.smartAfter);
  emit("doc:structure");
}

export function canUndo(){ return past.length > 0; }
export function canRedo(){ return future.length > 0; }

export function list(){
  return {
    past: past.map(e => ({ label: e.label, kind: e.kind })),
    future: future.map(e => ({ label: e.label, kind: e.kind })),
    bytes: pixelBytes,
    levels: maxSteps
  };
}

/* Salta a un punto concreto del historial desde el panel. */
export function jumpTo(index){
  // index es la posición en `past`; -1 significa el estado inicial
  while(past.length - 1 > index && undo()){ /* atrás */ }
  while(past.length - 1 < index && redo()){ /* adelante */ }
}

export function clear(){
  for(const e of past) drop(e);
  for(const e of future) drop(e);
  past = []; future = []; pixelBytes = 0; pending = null;
  emit("history:change");
}

/* ── varios historiales a la vez (documentos con pestañas) ─────
   Cada documento tiene su propio pasado y futuro; este módulo sigue
   trabajando sobre un único juego de variables a la vez —el del
   documento que se está viendo—, y core/documents.js es quien pide
   sacarlo o meterlo entero al cambiar de pestaña. `pending` (un trazo
   a medio pintar) se queda fuera a propósito: cambiar de documento en
   mitad de una pincelada es tan raro que no vale la pena arrastrar su
   estado de un lado a otro, y como sólo se consulta por el id de capa
   que estaba pintando, simplemente deja de encontrar nada en el
   documento nuevo y no hace nada. */
export function exportState(){
  return { past, future, pixelBytes };
}

export function importState(s){
  past = (s && s.past) || [];
  future = (s && s.future) || [];
  pixelBytes = (s && s.pixelBytes) || 0;
  emit("history:change");
}
