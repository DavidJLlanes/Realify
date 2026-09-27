/* ═══════════════════════════════════════════════════════════════
   CADENA DE FILTROS
   Una capa de filtro puede llevar más de una entrada encadenada
   («blur → nitidez → viñeta», todas sobre la misma capa): cada una
   con su interruptor (`enabled`) y su porcentaje (`amount`), en el
   orden en que se aplicaron. A diferencia del deslizador de una sola
   entrada (filteramount.js, que sigue existiendo para el caso de un
   único filtro), aquí CUALQUIER cambio —apagar una, mover el
   porcentaje, quitarla, reordenarla— recalcula la cadena ENTERA desde
   la capa de debajo: no hay forma de "recalcular sólo la del medio"
   sin rehacer lo que depende de ella, así que no se intenta.
   ═══════════════════════════════════════════════════════════════ */

import { emit } from "../core/bus.js";
import { record } from "../core/history.js";
import { COARSE } from "../core/device.js";
import { status } from "../ui/toast.js";
import { filterBase } from "./filterlayer.js";
import { renderFilter, scaleParams, knownFilter } from "./filterregistry.js";

const PREVIEW_LIMIT = COARSE ? 3e5 : 8e5;

const snapshot = canvas => {
  const c = document.createElement("canvas");
  c.width = canvas.width; c.height = canvas.height;
  c.getContext("2d").drawImage(canvas, 0, 0);
  return c;
};
function proxyOf(src){
  const w = src.width, h = src.height;
  if(w * h <= PREVIEW_LIMIT) return src;
  const k = Math.sqrt(PREVIEW_LIMIT / (w * h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
function writeInto(layer, canvas){
  const x = layer.ctx;
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = "copy";
  x.imageSmoothingQuality = "high";
  x.drawImage(canvas, 0, 0, layer.canvas.width, layer.canvas.height);
  x.restore();
  layer.thumbDirty = true;
}
const dataOf = c => c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);

function mixCanvas(baseC, fullC, t){
  const out = document.createElement("canvas");
  out.width = baseC.width; out.height = baseC.height;
  const bd = dataOf(baseC), fd = dataOf(fullC);
  const b = bd.data, f = fd.data;
  for(let i = 0; i < b.length; i += 4){
    b[i]   += (f[i]   - b[i])   * t;
    b[i+1] += (f[i+1] - b[i+1]) * t;
    b[i+2] += (f[i+2] - b[i+2]) * t;
    b[i+3]  = f[i+3];
  }
  out.getContext("2d").putImageData(bd, 0, 0);
  return out;
}

/* Corre toda la cadena, en orden, sobre `src`: las entradas apagadas
   se saltan tal cual (ni gastan tiempo ni cambian nada), las que no
   tienen mandos de intensidad (invertir, blanco y negro en receta…)
   se resuelven como mezcla con su resultado a tope, igual que en el
   deslizador de una sola entrada. Si el motor de una entrada ya no
   está disponible (una LUT que no se volvió a cargar, por ejemplo),
   ese eslabón se salta en vez de tirar toda la cadena — mejor un
   filtro que no hace nada que una capa que revienta al recomponer. */
async function runChain(filters, src, isFinal){
  for(const entry of filters){
    if(entry.enabled === false) continue;
    if(!knownFilter(entry.id)) continue;
    const t = Math.max(0, Math.min(100, entry.amount ?? 100)) / 100;
    if(t <= 0) continue;
    const scaled = scaleParams(entry.id, entry.params, t);
    if(scaled){
      const out = await renderFilter(entry.id, src, scaled, isFinal);
      if(out) src = out;
    } else {
      const full = await renderFilter(entry.id, src, entry.params, isFinal);
      if(full) src = t >= 0.995 ? full : mixCanvas(src, full, t);
    }
  }
  return src;
}

const tickets = new WeakMap();
const pendingPreview = new WeakMap();
const busy = new WeakSet();

/**
 * Recalcula `layer.filters` entero sobre `filterBase(layer)` y deja el
 * resultado en `layer.canvas`. `preview`: copia reducida, sin paso de
 * historial —para arrastrar un deslizador viendo el resultado en
 * directo—; la llamada final (preview:false) es la que de verdad
 * compromete el cambio.
 *
 * `filtersBefore`, si se pasa, es una copia de `layer.filters` tomada
 * ANTES de la mutación que motivó esta llamada: como el interruptor,
 * el porcentaje o el orden se cambian mutando el array de la propia
 * capa (no sustituyéndolo), un simple snapshot de píxeles no basta
 * para deshacer — sin este argumento el paso de historial devolvería
 * los píxeles de antes pero dejaría el interruptor o el porcentaje ya
 * cambiados, desincronizados de lo que se ve. */
export async function recomputeChain(layer, { preview = false, label = "Cadena de filtros", filtersBefore = null } = {}){
  const base = filterBase(layer);
  if(!base) return false;
  if(!layer.filters || !layer.filters.length) return true;   // nada que recalcular: se deja la capa tal cual

  if(preview && busy.has(layer)){ pendingPreview.set(layer, true); return true; }
  busy.add(layer);
  const ticket = (tickets.get(layer) || 0) + 1;
  tickets.set(layer, ticket);

  try{
    const beforePixels = preview ? null : snapshot(layer.canvas);
    const src = preview ? proxyOf(base.canvas) : base.canvas;
    if(!preview) status("Recalculando filtros…");
    const out = await runChain(layer.filters, src, !preview);
    if(tickets.get(layer) !== ticket) return true;   // llegó otra petición más nueva

    writeInto(layer, out);
    emit("doc:change");

    if(!preview){
      const afterPixels = snapshot(layer.canvas);
      const afterFilters = structuredClone(layer.filters);
      const put = (pixels, filters) => {
        writeInto(layer, pixels);
        layer.filters = structuredClone(filters);
        emit("doc:structure"); emit("doc:change");
      };
      record(label,
        () => put(beforePixels, filtersBefore ?? afterFilters),
        () => put(afterPixels, afterFilters));
      status("");
      emit("doc:structure");
    }
    return true;
  }catch(err){
    console.error("[filterchain]", err);
    status("");
    return false;
  }finally{
    busy.delete(layer);
    if(pendingPreview.get(layer)){
      pendingPreview.delete(layer);
      if(tickets.get(layer) === ticket) recomputeChain(layer, { preview: true });
    }
  }
}

/* Las mutaciones de la cadena: cada una guarda una copia de
   `layer.filters` ANTES de tocarlo y se la pasa a `recomputeChain`
   para que el paso de historial revierta el array entero, no sólo los
   píxeles (ver el comentario de arriba). */
export async function toggleFilterEntry(layer, index){
  const f = layer.filters?.[index];
  if(!f) return false;
  const filtersBefore = structuredClone(layer.filters);
  f.enabled = f.enabled === false;
  return recomputeChain(layer, { filtersBefore, label: (f.enabled ? "Activar " : "Desactivar ") + (f.name || f.id) });
}

export async function setFilterEntryAmount(layer, index, amount, { preview = false } = {}){
  const f = layer.filters?.[index];
  if(!f) return false;
  const filtersBefore = preview ? null : structuredClone(layer.filters);
  f.amount = Math.max(0, Math.min(100, Math.round(amount)));
  return recomputeChain(layer, { preview, filtersBefore, label: `${f.name || f.id} · ${f.amount} %` });
}

export async function removeFilterEntry(layer, index){
  if(!layer.filters || !layer.filters[index]) return false;
  const filtersBefore = structuredClone(layer.filters);
  const removed = layer.filters[index];
  layer.filters = layer.filters.filter((_, i) => i !== index);
  if(!layer.filters.length){
    // No queda nada que recalcular: los píxeles actuales se quedan
    // como están (ya son el resultado del último filtro que había),
    // simplemente deja de haber una receta detrás de ellos.
    const afterFilters = [];
    record("Quitar " + (removed.name || removed.id),
      () => { layer.filters = structuredClone(filtersBefore); emit("doc:structure"); emit("doc:change"); },
      () => { layer.filters = structuredClone(afterFilters);  emit("doc:structure"); emit("doc:change"); });
    emit("doc:structure"); emit("doc:change");
    return true;
  }
  return recomputeChain(layer, { filtersBefore, label: "Quitar " + (removed.name || removed.id) });
}

export async function moveFilterEntry(layer, index, delta){
  const list = layer.filters;
  if(!list) return false;
  const j = index + delta;
  if(j < 0 || j >= list.length) return false;
  const filtersBefore = structuredClone(list);
  const [it] = list.splice(index, 1);
  list.splice(j, 0, it);
  return recomputeChain(layer, { filtersBefore, label: "Reordenar filtros" });
}
