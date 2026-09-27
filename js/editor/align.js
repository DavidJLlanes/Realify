/* ═══════════════════════════════════════════════════════════════
   ALINEAR Y DISTRIBUIR CAPAS
   «Contenido» de una capa no es su lienzo entero —que siempre mide lo
   mismo que el documento, según el diseño de esta app— sino el
   rectángulo más ajustado alrededor de sus píxeles con algo de alfa.
   Alinear «a la izquierda» de verdad tiene que mirar dónde empieza lo
   que se ve, no dónde empieza el lienzo invisible que lo contiene.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";

/* Caja ajustada a los píxeles con alfa > 0. Recorre el canal alfa
   entero una vez; para capas del tamaño del documento eso es del
   mismo orden que cualquier otra operación de la aplicación que ya
   hace un `getImageData` completo (el histograma, los ajustes…). */
export function contentBounds(layer){
  const w = layer.canvas.width, h = layer.canvas.height;
  const d = layer.ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for(let y = 0; y < h; y++){
    const row = y * w * 4;
    for(let x = 0; x < w; x++){
      if(d[row + x*4 + 3] > 0){
        if(x < x0) x0 = x; if(x > x1) x1 = x;
        if(y < y0) y0 = y; if(y > y1) y1 = y;
      }
    }
  }
  if(x1 < x0) return null;    // capa completamente transparente
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* Bordes y centro de cada capa visible —salvo la que se está
   moviendo—, como candidatos de ajuste: es lo que hace que arrastrar
   una capa la enganche contra otra ya puesta, no sólo contra las
   guías y los bordes del documento. Se recorta a `contentBounds`, no
   al lienzo entero de la capa —esa es la caja que el ojo reconoce
   como «dónde está» esa capa—, y se ignoran los grupos y las capas de
   ajuste, que no tienen píxeles propios que envolver. */
export function otherLayersEdgeCandidates(layers, excludeId){
  const x = [], y = [];
  for(const l of layers){
    if(l.id === excludeId || !l.visible || l.type === "group" || l.type === "adjust") continue;
    const b = contentBounds(l);
    if(!b) continue;
    x.push(b.x, b.x + b.w / 2, b.x + b.w);
    y.push(b.y, b.y + b.h / 2, b.y + b.h);
  }
  return { x, y };
}

function unionOf(boxes){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for(const b of boxes){
    if(b.x < x0) x0 = b.x; if(b.x + b.w > x1) x1 = b.x + b.w;
    if(b.y < y0) y0 = b.y; if(b.y + b.h > y1) y1 = b.y + b.h;
  }
  return { x:x0, y:y0, w:x1-x0, h:y1-y0 };
}

/* Cuánto hay que mover una caja para alinearla contra una referencia,
   según el modo. Función pura —sin capas ni lienzos— para poder
   comprobar la geometría con números sueltos. */
export function alignOffset(box, ref, mode){
  switch(mode){
    case "left":    return { dx: ref.x - box.x, dy: 0 };
    case "right":   return { dx: (ref.x + ref.w) - (box.x + box.w), dy: 0 };
    case "centerH": return { dx: (ref.x + ref.w/2) - (box.x + box.w/2), dy: 0 };
    case "top":     return { dx: 0, dy: ref.y - box.y };
    case "bottom":  return { dx: 0, dy: (ref.y + ref.h) - (box.y + box.h) };
    case "centerV": return { dx: 0, dy: (ref.y + ref.h/2) - (box.y + box.h/2) };
    default:        return { dx: 0, dy: 0 };
  }
}

/* Desplazamientos para repartir N cajas a espacio igual entre la
   primera y la última (que se quedan fijas), ordenadas por el centro
   de cada una a lo largo del eje. Hace falta al menos 3 para que
   "distribuir" signifique algo —con 2 no hay nada intermedio que
   mover—. Devuelve un array de {dx,dy} en el mismo orden que se pasó
   `boxes`, no en el orden ordenado. */
export function distributeOffsets(boxes, axis){
  const n = boxes.length;
  if(n < 3) return boxes.map(() => ({ dx:0, dy:0 }));
  const center = b => axis === "h" ? b.x + b.w/2 : b.y + b.h/2;
  const order = boxes.map((b, i) => i).sort((i, j) => center(boxes[i]) - center(boxes[j]));

  const first = center(boxes[order[0]]), last = center(boxes[order[n-1]]);
  const step = (last - first) / (n - 1);

  const out = boxes.map(() => ({ dx:0, dy:0 }));
  for(let k = 1; k < n - 1; k++){
    const idx = order[k];
    const target = first + step * k;
    const delta = target - center(boxes[idx]);
    out[idx] = axis === "h" ? { dx: delta, dy: 0 } : { dx: 0, dy: delta };
  }
  return out;
}

/* ── aplicar a capas de verdad ────────────────────────────────── */
function shiftLayer(layer, dx, dy){
  if(Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
  const snap = document.createElement("canvas");
  snap.width = layer.canvas.width; snap.height = layer.canvas.height;
  snap.getContext("2d").drawImage(layer.canvas, 0, 0);
  layer.ctx.save();
  layer.ctx.globalCompositeOperation = "copy";
  layer.ctx.clearRect(0, 0, doc.w, doc.h);
  layer.ctx.drawImage(snap, Math.round(dx), Math.round(dy));
  layer.ctx.restore();
  layer.thumbDirty = true;
  return snap;
}

function boundsFor(layer){ return contentBounds(layer) || { x:0, y:0, w:layer.canvas.width, h:layer.canvas.height }; }

export function alignLayers(ids, mode){
  const layers = ids.map(id => doc.layers.find(l => l.id === id)).filter(Boolean);
  if(!layers.length) return;

  const boxes = layers.map(boundsFor);
  const ref = layers.length === 1 ? { x:0, y:0, w:doc.w, h:doc.h } : unionOf(boxes);

  // No hace falta `batch()` aquí: nada dentro de este bucle llama a
  // `record()` por su cuenta —`shiftLayer` sólo mueve píxeles y
  // devuelve la instantánea de antes—, así que ya sale un único paso
  // de historial de forma natural, el que arma `recordShift` al final.
  const before = [];
  layers.forEach((l, i) => {
    const { dx, dy } = alignOffset(boxes[i], ref, mode);
    const snap = shiftLayer(l, dx, dy);
    if(snap) before.push({ id: l.id, snap });
  });
  recordShift("Alinear capas", before);
}

export function distributeLayers(ids, axis){
  const layers = ids.map(id => doc.layers.find(l => l.id === id)).filter(Boolean);
  if(layers.length < 3) return;

  const boxes = layers.map(boundsFor);
  const offs = distributeOffsets(boxes, axis);

  const before = [];
  layers.forEach((l, i) => {
    const snap = shiftLayer(l, offs[i].dx, offs[i].dy);
    if(snap) before.push({ id: l.id, snap });
  });
  recordShift("Distribuir capas", before);
}

/* Un solo paso de historial para todas las capas movidas a la vez:
   deshacer "Alinear capas" las devuelve todas juntas, no una a una. */
function recordShift(label, snaps){
  if(!snaps.length) return;
  const after = snaps.map(({ id }) => {
    const l = doc.layers.find(x => x.id === id);
    const c = document.createElement("canvas");
    c.width = l.canvas.width; c.height = l.canvas.height;
    c.getContext("2d").drawImage(l.canvas, 0, 0);
    return { id, snap: c };
  });
  const restore = list => {
    for(const { id, snap } of list){
      const l = doc.layers.find(x => x.id === id);
      if(!l) continue;
      l.ctx.save(); l.ctx.globalCompositeOperation = "copy";
      l.ctx.drawImage(snap, 0, 0); l.ctx.restore();
      l.thumbDirty = true;
    }
    emit("doc:structure"); emit("doc:change");
  };
  record(label, () => restore(snaps), () => restore(after));
  emit("doc:structure"); emit("doc:change");
}
