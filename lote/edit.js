/* ═══════════════════════════════════════════════════════════════
   LOTE · COPIAR UNA EDICIÓN A OTRAS FOTOS
   Una «edición» es la pila de capas que hay ENCIMA de la foto base del
   documento de referencia, con todo lo que la hace reeditable:

     · capas de ajuste      → mismo tipo y valores;
     · capas de filtro      → misma receta (`filters`), recalculada sobre
                              la capa que quede debajo en cada foto;
     · textos               → mismo texto y estilo, en proporción;
     · otras capas de imagen (marcas de agua, logos, stickers) → sus
                              píxeles, colocados en proporción;
   y de cada capa su visibilidad, opacidad, modo de fusión, «fusionar
   si», recorte y estilos. NO se copian las máscaras (están pintadas
   para una foto concreta) ni recortes, giros o cambios de tamaño.

   Opcional: «Igualar exposición» añade debajo de la edición una capa
   de ajuste «Exposición» que lleva el brillo medio de cada foto al de
   la de referencia.
   ═══════════════════════════════════════════════════════════════ */

import { doc, makeLayer } from "../js/core/doc.js";
import { record } from "../js/core/history.js";
import { emit } from "../js/core/bus.js";
import { renderFilter, scaleParams, knownFilter } from "../js/editor/filterregistry.js";
import { applyAdjustLayer, adjustTypeName } from "../js/editor/adjustlayers.js";
import { renderTextLayer } from "../js/editor/text.js";

const clone = v => v == null ? v : structuredClone(v);
const KIND_NAME = { adjust: "Ajuste", filter: "Filtro", text: "Texto", overlay: "Imagen" };
export const kindName = k => KIND_NAME[k] || k;

/* Brillo medio (media geométrica de la luminancia lineal) */
export function logAverage(canvas){
  const s = 64, c = document.createElement("canvas"); c.width = s; c.height = s;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(canvas, 0, 0, s, s);
  const d = x.getImageData(0, 0, s, s).data;
  let sum = 0, n = 0;
  for(let i = 0; i < d.length; i += 4){
    if(d[i + 3] < 128) continue;
    const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    sum += Math.log(lin(d[i]) * .2126 + lin(d[i + 1]) * .7152 + lin(d[i + 2]) * .0722 + 1e-4); n++;
  }
  return n ? Math.exp(sum / n) : .18;
}
/** Pasos de exposición que hay que dar para igualar `canvas` a la referencia. */
export const evToMatch = (refAvg, canvas, strength = 1) =>
  Math.max(-3, Math.min(3, Math.log2(refAvg / logAverage(canvas)) * strength));

/* Caja con contenido (alfa > 0) de una capa de imagen */
function contentBox(canvas){
  const w = canvas.width, h = canvas.height, d = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  const st = Math.max(1, Math.floor(Math.sqrt(w * h / 1e6)));
  for(let y = 0; y < h; y += st) for(let x = 0; x < w; x += st) if(d[(y * w + x) * 4 + 3] > 8){ if(x < x0) x0 = x; if(y < y0) y0 = y; if(x > x1) x1 = x; if(y > y1) y1 = y; }
  if(x1 < 0) return null;
  x0 = Math.max(0, x0 - st); y0 = Math.max(0, y0 - st); x1 = Math.min(w - 1, x1 + st); y1 = Math.min(h - 1, y1 + st);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** La edición del documento abierto (la foto de referencia). */
export function captureEdit(){
  const base = doc.layers[0];
  const items = [];
  for(const l of doc.layers.slice(1)){
    if(l.type === "group") continue;                 // los grupos no se copian; sus capas sí
    const kind = l.type === "adjust" ? "adjust" : l.type === "text" && l.text ? "text" : l.filters?.length ? "filter" : "overlay";
    const it = {
      kind, name: l.name, on: l.visible !== false, hasMask: !!l.mask,
      props: { visible: l.visible !== false, opacity: l.opacity ?? 1, blend: l.blend || "source-over", blendIf: clone(l.blendIf || null), clipped: !!l.clipped, styles: clone(l.styles || null) }
    };
    if(kind === "adjust"){ it.adjustType = l.adjustType; it.adjustParams = clone(l.adjustParams); it.detail = adjustTypeName(l.adjustType); }
    else if(kind === "filter"){ it.filters = clone(l.filters); it.detail = l.filters.map(f => f.name || f.id).join(" → "); }
    else if(kind === "text"){ it.text = clone(l.text); it.detail = String(l.text.content || "").split("\n")[0].slice(0, 30); }
    else {
      const box = contentBox(l.canvas);
      if(!box) continue;
      const c = document.createElement("canvas"); c.width = box.w; c.height = box.h;
      c.getContext("2d").drawImage(l.canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      it.pixels = c; it.box = box; it.detail = `${box.w} × ${box.h} px`;
    }
    items.push(it);
  }
  return { name: doc.name || "Foto", w: doc.w, h: doc.h, items, refAvg: logAverage(base?.canvas || doc.layers[0].canvas) };
}

/* Cadena de filtros sobre un lienzo (lo mismo que editor/filterchain.js
   pero sin paso de historial ni aviso: aquí va todo en uno). */
async function runChain(filters, src, isFinal){
  for(const e of filters){
    if(e.enabled === false || !knownFilter(e.id)) continue;
    const t = Math.max(0, Math.min(100, e.amount ?? 100)) / 100;
    if(t <= 0) continue;
    const scaled = scaleParams(e.id, e.params, t);
    const out = await renderFilter(e.id, src, scaled || e.params, isFinal);
    if(!out) continue;
    if(scaled || t >= .995) src = out;
    else {
      const m = document.createElement("canvas"); m.width = src.width; m.height = src.height;
      const x = m.getContext("2d"); x.drawImage(src, 0, 0); x.globalAlpha = t; x.drawImage(out, 0, 0); src = m;
    }
  }
  return src;
}

/* Texto escalado a otra foto: posición en proporción, tamaños por la escala menor */
function scaledText(t, sx, sy){
  const s = Math.min(sx, sy), o = clone(t);
  for(const k of ["x", "boxX"]) if(Number.isFinite(o[k])) o[k] *= sx;
  for(const k of ["y", "boxY"]) if(Number.isFinite(o[k])) o[k] *= sy;
  for(const k of ["size", "strokeWidth", "shadowBlur", "shadowX", "shadowY", "boxW", "boxH", "letterSpacing", "padding"]) if(Number.isFinite(o[k])) o[k] *= s;
  return o;
}
function drawOverlay(ctx, it, W, H, edit){
  const sx = W / edit.w, sy = H / edit.h, s = Math.min(sx, sy);
  const cx = (it.box.x + it.box.w / 2) * sx, cy = (it.box.y + it.box.h / 2) * sy;
  const w = it.box.w * s, h = it.box.h * s;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(it.pixels, cx - w / 2, cy - h / 2, w, h);
}

/** Aplica la edición al documento ABIERTO, encima de sus capas.
    Devuelve las capas añadidas. `record: false` no anota historial
    (para exportar y deshacer en seguida). */
export async function applyEdit(edit, { expo = false, expoStrength = 1, record: rec = true } = {}){
  const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
  const W = doc.w, H = doc.h, sx = W / edit.w, sy = H / edit.h, added = [];
  const layers = doc.layers.slice();
  if(expo){
    const { flatten } = await import("../js/editor/layertree.js");
    const ev = evToMatch(edit.refAvg, flatten(), expoStrength);
    if(Math.abs(ev) >= .02){
      const l = makeLayer({ name: `Igualar exposición (${ev > 0 ? "+" : ""}${ev.toFixed(2).replace(".", ",")} EV)`, type: "adjust" });
      l.adjustType = "exposure"; l.adjustParams = { ev: Math.round(ev * 100) / 100 };
      layers.push(l); added.push(l);
    }
  }
  for(const it of edit.items){
    if(!it.on) continue;
    const l = makeLayer({ name: it.name, type: it.kind === "adjust" ? "adjust" : it.kind === "text" ? "text" : "raster" });
    Object.assign(l, { visible: it.props.visible, opacity: it.props.opacity, blend: it.props.blend, blendIf: clone(it.props.blendIf), clipped: it.props.clipped, styles: clone(it.props.styles) });
    if(it.kind === "adjust"){ l.adjustType = it.adjustType; l.adjustParams = clone(it.adjustParams); }
    else if(it.kind === "text"){ l.text = scaledText(it.text, sx, sy); renderTextLayer(l); }
    else if(it.kind === "overlay") drawOverlay(l.ctx, it, W, H, edit);
    else if(it.kind === "filter"){
      l.filters = clone(it.filters);
      // Como una capa de filtro normal: se calcula sobre la capa de debajo
      const below = layers[layers.length - 1];
      if(below?.canvas){
        const out = await runChain(l.filters, below.canvas, true);
        l.ctx.drawImage(out, 0, 0, W, H);
      }
    }
    l.thumbDirty = true;
    layers.push(l); added.push(l);
  }
  doc.layers = layers;
  if(added.length) doc.activeId = added[added.length - 1].id;
  const nextLayers = doc.layers.slice(), nextActive = doc.activeId;
  if(rec){
    const put = (ls, a) => { doc.layers = ls.slice(); doc.activeId = a; emit("doc:structure"); emit("doc:change"); };
    record("Aplicar edición de otra foto", () => put(prevLayers, prevActive), () => put(nextLayers, nextActive));
  }
  emit("doc:structure"); emit("doc:change");
  return { added, undo(){ doc.layers = prevLayers.slice(); doc.activeId = prevActive; emit("doc:structure"); emit("doc:change"); } };
}

/** Vista previa aproximada (sin tocar ningún documento) sobre un lienzo
    pequeño: mismos ajustes, filtros, textos e imágenes, compuestos a
    mano. El resultado final lo hace `applyEdit` con el motor de verdad. */
export async function previewEdit(edit, src, { expo = false, expoStrength = 1 } = {}){
  const W = src.width, H = src.height, sx = W / edit.w, sy = H / edit.h;
  const comp = document.createElement("canvas"); comp.width = W; comp.height = H;
  const cx = comp.getContext("2d", { willReadFrequently: true });
  cx.drawImage(src, 0, 0);
  const adjust = (type, params, opacity) => {
    const img = cx.getImageData(0, 0, W, H), before = opacity < 1 ? new Uint8ClampedArray(img.data) : null;
    applyAdjustLayer({ adjustType: type, adjustParams: params }, img.data, W, H);
    if(before) for(let i = 0; i < img.data.length; i++) img.data[i] = before[i] + (img.data[i] - before[i]) * opacity;
    cx.putImageData(img, 0, 0);
  };
  if(expo){ const ev = evToMatch(edit.refAvg, src, expoStrength); if(Math.abs(ev) >= .02) adjust("exposure", { ev }, 1); }
  let below = comp;
  for(const it of edit.items){
    if(!it.on || !it.props.visible) continue;
    if(it.kind === "adjust"){ adjust(it.adjustType, it.adjustParams, it.props.opacity); below = comp; continue; }
    let layer = null;
    if(it.kind === "filter"){
      const snap = document.createElement("canvas"); snap.width = W; snap.height = H; snap.getContext("2d").drawImage(below, 0, 0);
      layer = await runChain(it.filters, snap, false);
    } else if(it.kind === "text"){
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      renderTextLayer({ canvas: c, ctx: c.getContext("2d"), text: scaledText(it.text, sx, sy) });
      layer = c;
    } else {
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      drawOverlay(c.getContext("2d"), it, W, H, edit); layer = c;
    }
    cx.save(); cx.globalAlpha = it.props.opacity; cx.globalCompositeOperation = it.props.blend || "source-over";
    cx.drawImage(layer, 0, 0, W, H); cx.restore();
    below = layer;
  }
  return comp;
}
