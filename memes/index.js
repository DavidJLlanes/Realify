/* ═══════════════════════════════════════════════════════════════
   MEMES · ENTRADA
   Abre el creador sobre la composición actual y, al aplicar:

     1. amplía el lienzo si el diseño pone barras o marcos fuera de la
        foto (las capas existentes se desplazan, no se reescalan),
     2. crea «Meme · marco» DEBAJO de todo (fondo, barras, filetes),
     3. si hay efecto de imagen, «Meme · efecto de imagen» encima de la
        foto; y si el diseño lo tiene, «Meme · degradado» sobre ella,
     4. una capa por texto, encima de todo.

   Todo es UN paso de historial: se guardan las referencias de cada
   capa (lienzo, máscara, desplazamientos) antes y después —nada se
   destruye, ampliar crea lienzos nuevos—, así que deshacer no copia
   píxeles.
   ═══════════════════════════════════════════════════════════════ */

import { doc, addLayer } from "../js/core/doc.js";
import { record } from "../js/core/history.js";
import { emit } from "../js/core/bus.js";
import { flatten } from "../js/editor/layertree.js";
import { fit as fitView } from "../js/editor/view.js";
import { toast } from "../js/ui/toast.js";
import { renderText, drawText } from "./text.js";
import { applyEffect } from "./effects.js";

function ensureStyles(){
  const href = new URL("./memes.css", import.meta.url).href;
  if(document.querySelector('link[href$="memes/memes.css"]') ||
     [...document.styleSheets].some(s => s.href === href)) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

/* Estado de la estructura del documento, sin copiar píxeles */
function capture(){
  return {
    w: doc.w, h: doc.h, active: doc.activeId, layers: doc.layers.slice(),
    parts: doc.layers.map(l => ({ l, canvas: l.canvas, ctx: l.ctx, mask: l.mask,
      shape: l.shape, smartBox: l.smartBox, smartTransform: l.smartTransform }))
  };
}
function restore(s){
  doc.w = s.w; doc.h = s.h; doc.layers = s.layers.slice(); doc.activeId = s.active;
  for(const p of s.parts){
    Object.assign(p.l, { canvas: p.canvas, ctx: p.ctx, mask: p.mask, shape: p.shape, smartBox: p.smartBox, smartTransform: p.smartTransform });
    p.l.thumbDirty = true;
  }
  doc.selection = null;
  emit("doc:resize"); emit("doc:structure"); emit("doc:change");
  fitView();
}

/* Amplía el lienzo a W×H dejando el contenido actual en (ox, oy). */
function extend(W, H, ox, oy){
  const grow = (src, fillWhite) => {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true });
    // La máscara revela la zona nueva, como una máscara recién creada.
    if(fillWhite){ x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.clearRect(ox, oy, src.width, src.height); }
    x.drawImage(src, ox, oy);
    return { canvas: c, ctx: x };
  };
  for(const l of doc.layers){
    const g = grow(l.canvas, false);
    l.canvas = g.canvas; l.ctx = g.ctx;
    if(l.mask) l.mask = grow(l.mask.canvas, true);
    if(l.type === "shape" && l.shape) l.shape = { ...l.shape, x: l.shape.x + ox, y: l.shape.y + oy };
    if(l.smart){
      if(l.smartBox) l.smartBox = { ...l.smartBox, x: l.smartBox.x + ox, y: l.smartBox.y + oy };
      if(l.smartTransform) l.smartTransform = { ...l.smartTransform, tx: l.smartTransform.tx + ox, ty: l.smartTransform.ty + oy };
    }
    l.thumbDirty = true;
  }
  doc.w = W; doc.h = H; doc.selection = null;
}

export async function openMemeCreator(){
  if(!doc.open){ toast("No hay documento abierto", "err"); return; }
  await ensureStyles();
  const { openMemeEditor } = await import("./ui.js");
  const photo = flatten();
  openMemeEditor({
    photo,
    onAccept: async (state, L) => {
      // Lo lento (efecto, textos) se calcula antes de tocar el documento.
      const effect = state.effect !== "none" && state.effectAmount > 0
        ? await applyEffect(photo, photo.width, photo.height, state.effect, state.effectAmount, 1) : null;
      const texts = state.texts.map(t => ({ t, r: renderText(t, L.W, L.H, 1) })).filter(x => x.r);

      const before = capture();
      if(L.W !== doc.w || L.H !== doc.h) extend(L.W, L.H, L.img.x, L.img.y);
      const top = () => doc.layers.length;
      if(L.under){
        const l = addLayer({ name: "Meme · marco", above: 0 });
        L.under(l.ctx); l.thumbDirty = true;
      }
      if(effect){
        const l = addLayer({ name: "Meme · efecto de imagen", above: top() });
        l.ctx.drawImage(effect, L.img.x, L.img.y); l.thumbDirty = true;
      }
      if(L.over){
        const l = addLayer({ name: "Meme · degradado", above: top() });
        l.ctx.save(); l.ctx.translate(L.img.x, L.img.y); L.over(l.ctx); l.ctx.restore(); l.thumbDirty = true;
      }
      for(const { t, r } of texts){
        const l = addLayer({ name: `Meme · ${String(t.text).replace(/\s+/g, " ").trim().slice(0, 28)}`, above: top() });
        drawText(l.ctx, t, r); l.thumbDirty = true;
      }
      const after = capture();
      record("Crear meme", () => restore(before), () => restore(after));
      emit("doc:resize"); emit("doc:structure"); emit("doc:change");
      fitView();
      toast(L.W !== before.w || L.H !== before.h ? `Meme creado · lienzo ampliado a ${L.W} × ${L.H}` : "Meme creado", "ok");
    }
  });
}
