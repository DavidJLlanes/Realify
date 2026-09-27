/* ═══════════════════════════════════════════════════════════════
   INSTANTÁNEAS
   El historial normal (core/history.js) es una cinta de pasos que se
   recorre de uno en uno y que, bajo presión de memoria, va soltando
   las capturas más viejas —perfecto para deshacer la última
   pincelada, no para volver con seguridad a «antes del retoque»
   después de cuarenta pasos—. Una instantánea es otra cosa: una copia
   COMPLETA del documento (todas las capas, con sus píxeles, máscaras
   y demás), con nombre, que vive aparte de esa cinta y no se suelta
   nunca sola —sólo si el usuario la borra a propósito—. Volver a
   ella es un único paso de historial, no un recorrido de cuarenta.

   El pincel de historial (editor/historybrush.js) pinta desde la
   instantánea marcada como «origen» aquí — nunca desde un punto
   suelto de la cinta de deshacer, que podría haberse soltado de la
   memoria en cualquier momento.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "./doc.js";
import { record } from "./history.js";
import { emit } from "./bus.js";
import { toast } from "../ui/toast.js";

let snapshots = [];
let seq = 0;
let brushSourceId = null;

function cloneCanvas(c){
  const out = document.createElement("canvas");
  out.width = c.width; out.height = c.height;
  out.getContext("2d", { colorSpace:"srgb" }).drawImage(c, 0, 0);
  return out;
}

/* Copia profunda de los datos de una capa. Antes se hacía con
   JSON.stringify/parse, que convierte en `{}` cualquier lienzo o imagen
   que no sean los tres de arriba: el motivo de una capa de relleno
   (`fill.patternImg`) llegaba roto y al restaurar la instantánea
   `createPattern` fallaba en cuanto se tocaba el relleno. Aquí un
   lienzo se copia (se puede pintar encima, no debe compartirse) y una
   imagen o un ImageBitmap se comparten tal cual (nadie los modifica
   en el sitio, sólo se sustituyen). */
function cloneValue(v, seen){
  if(v === null || typeof v !== "object") return typeof v === "function" ? undefined : v;
  if(v instanceof HTMLCanvasElement) return cloneCanvas(v);
  if(v instanceof CanvasRenderingContext2D) return undefined;
  if(v instanceof HTMLImageElement || (typeof ImageBitmap !== "undefined" && v instanceof ImageBitmap)) return v;
  if(ArrayBuffer.isView(v)) return v.slice();
  if(seen.has(v)) return seen.get(v);
  const out = Array.isArray(v) ? [] : {};
  seen.set(v, out);
  for(const k of Object.keys(v)){
    const c = cloneValue(v[k], seen);
    if(c !== undefined) out[k] = c;
  }
  return out;
}

/* Clona una capa entera sin arrastrar ni un lienzo compartido con la
   que sigue viva en `doc.layers`. `canvas`/`ctx`, `mask` y
   `smartSource` se tratan aparte porque el contexto hay que crearlo
   con sus opciones; el resto pasa por `cloneValue`, que no tiene que
   enumerar campo a campo cada vez que el modelo de capa crece. */
function cloneLayer(l){
  const canvas = cloneCanvas(l.canvas);
  const ctx = canvas.getContext("2d", { willReadFrequently:true, colorSpace:"srgb" });
  let mask = null;
  if(l.mask){
    const mc = cloneCanvas(l.mask.canvas);
    mask = { canvas: mc, ctx: mc.getContext("2d", { willReadFrequently:true, colorSpace:"srgb" }) };
  }
  let smartSource = null;
  if(l.smartSource) smartSource = cloneCanvas(l.smartSource);
  const { canvas:_c, ctx:_x, mask:_m, smartSource:_s, _fxFull:_f, ...rest } = l;
  const plain = cloneValue(rest, new Map());
  return { ...plain, canvas, ctx, mask, smartSource };
}

export function listSnapshots(){ return snapshots; }

export function takeSnapshot(name){
  if(!doc.open) return null;
  const snap = {
    id: ++seq,
    name: (name || "").trim() || `Instantánea ${snapshots.length + 1}`,
    layers: doc.layers.map(cloneLayer),
    activeId: doc.activeId,
    w: doc.w, h: doc.h,
    t: Date.now()
  };
  snapshots = [...snapshots, snap];
  if(brushSourceId === null) brushSourceId = snap.id;
  emit("snapshots:change");
  toast("Instantánea «" + snap.name + "» guardada", "ok");
  return snap;
}

export function renameSnapshot(id, name){
  const s = snapshots.find(x => x.id === id);
  if(!s || !name || !name.trim()) return false;
  s.name = name.trim();
  emit("snapshots:change");
  return true;
}

export function removeSnapshot(id){
  const had = snapshots.some(x => x.id === id);
  snapshots = snapshots.filter(x => x.id !== id);
  if(brushSourceId === id) brushSourceId = snapshots[0]?.id ?? null;
  emit("snapshots:change");
  return had;
}

/* Reemplaza TODO `doc.layers` por lo que había en la instantánea, en
   un solo paso de deshacer — igual patrón que «Combinar visibles» o
   «Agrupar capas»: capturar antes/después una sola vez y reutilizar
   esas mismas referencias en las dos direcciones es seguro aquí
   porque, mientras `doc.layers` no apunte a ellas, nada las toca.
   Si desde la instantánea se ha girado, recortado o redimensionado el
   documento, también se devuelve su tamaño: es justo después de esas
   operaciones cuando más se echa de menos poder volver atrás. La
   selección se descarta en ese caso porque sus coordenadas ya no
   encajarían, igual que al recortar. */
export function restoreSnapshot(id){
  const snap = snapshots.find(x => x.id === id);
  if(!snap || !doc.open) return false;
  const before = { layers: doc.layers.slice(), active: doc.activeId,
                   w: doc.w, h: doc.h, selection: doc.selection };
  const resized = snap.w !== doc.w || snap.h !== doc.h;
  const after = { layers: snap.layers.map(cloneLayer), active: snap.activeId,
                  w: snap.w, h: snap.h, selection: resized ? null : doc.selection };
  const put = st => {
    const sizeChanged = st.w !== doc.w || st.h !== doc.h;
    doc.layers = st.layers.slice(); doc.activeId = st.active;
    doc.w = st.w; doc.h = st.h; doc.selection = st.selection;
    if(sizeChanged) emit("doc:resize");
    emit("doc:structure"); emit("doc:change");
  };
  put(after);
  record(`Volver a «${snap.name}»`, () => put(before), () => put(after));
  toast("Vuelta a «" + snap.name + "»", "ok");
  return true;
}

export function getBrushSourceId(){ return brushSourceId; }
export function getBrushSource(){ return snapshots.find(x => x.id === brushSourceId) || null; }
export function setBrushSource(id){
  if(!snapshots.some(x => x.id === id)) return;
  brushSourceId = id;
  emit("snapshots:change");
}

/* Capa correspondiente, DENTRO de la instantánea origen del pincel de
   historial, a la capa activa de ahora mismo — por id, no por
   posición: si se han reordenado capas desde entonces, el pincel
   sigue sabiendo de cuál pintar. Null si esa capa ni existía todavía
   cuando se tomó la instantánea. */
export function brushSourceLayerFor(layerId){
  const snap = getBrushSource();
  if(!snap) return null;
  return snap.layers.find(l => l.id === layerId) || null;
}

/* Al cerrar el documento (nuevo archivo, cerrar pestaña…) las
   instantáneas de uno no tienen sentido para el que viene después. */
export function clearSnapshots(){
  snapshots = [];
  brushSourceId = null;
  emit("snapshots:change");
}

/* Un documento por pestaña, cada uno con sus propias instantáneas —
   mismo mecanismo que el historial de deshacer (core/history.js): al
   cambiar de pestaña, core/documents.js saca esta «pizarra» entera y
   mete la de la pestaña a la que se va. */
export function exportState(){ return { snapshots, brushSourceId }; }
export function importState(s){
  snapshots = (s && s.snapshots) || [];
  brushSourceId = (s && s.brushSourceId) ?? null;
  emit("snapshots:change");
}
