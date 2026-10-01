/* ═══════════════════════════════════════════════════════════════
   COPIAR / CORTAR / PEGAR
   Portapapeles interno, no el del sistema operativo: una imagen con
   canal alfa no tiene un formato de texto que copiar, y pedir permiso
   de portapapeles del navegador para esto sería fricción para un
   gesto que debe ser instantáneo. Vive como estado de módulo, igual
   que la selección múltiple de capas en panels.js: no es parte del
   documento ni sobrevive a recargar la página, y no tiene por qué.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer, addLayer, layerIndex } from "../core/doc.js";
import { boundsOf } from "./selection.js";
import { getMaskTarget } from "./masks.js";
import { beginPixels, commitPixels, record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { toast } from "../ui/toast.js";

/* { canvas, w, h, x, y } — canvas ya recortado a la forma exacta de
   la selección (alfa multiplicado por la máscara), x/y es la esquina
   donde vivía dentro del documento de origen, para que Pegar pueda
   devolverlo al mismo sitio si el lienzo no ha cambiado de tamaño. */
let clip = null;

export const hasClip = () => !!clip;

function selectionBox(){
  if(!doc.selection) return { x: 0, y: 0, w: doc.w, h: doc.h };
  return boundsOf(doc.selection.mask, doc.w, doc.h);
}

/* Recorta un ImageData a la forma exacta de la máscara de selección,
   multiplicando su alfa. Sin selección no hace falta: el rectángulo
   entero ya es lo que hay que copiar. */
function applyMaskAlpha(img, box){
  const mask = doc.selection.mask, mw = doc.selection.w;
  const d = img.data;
  for(let y = 0; y < box.h; y++){
    for(let x = 0; x < box.w; x++){
      const f = mask[(box.y + y) * mw + (box.x + x)] / 255;
      const i = (y * box.w + x) * 4 + 3;
      d[i] = Math.round(d[i] * f);
    }
  }
}

export function copyToClipboard(){
  if(!doc.open){ toast("No hay documento abierto"); return false; }
  const l = activeLayer();
  if(!l){ toast("No hay capa activa"); return false; }

  const box = selectionBox();
  if(!box){ toast("La selección está vacía"); return false; }

  const c = document.createElement("canvas");
  c.width = box.w; c.height = box.h;
  const cx = c.getContext("2d", { willReadFrequently: true });
  cx.drawImage(l.canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);

  if(doc.selection){
    const img = cx.getImageData(0, 0, box.w, box.h);
    applyMaskAlpha(img, box);
    cx.putImageData(img, 0, 0);
  }

  clip = { canvas: c, w: box.w, h: box.h, x: box.x, y: box.y };
  toast(doc.selection ? "Selección copiada" : "Capa copiada");
  return true;
}

/* Vacía la zona seleccionada de una capa: baja a cero el alfa de cada
   píxel en la proporción en que la máscara lo cubra, así que un borde
   difuminado se borra difuminado en vez de dejar un escalón. Es la
   mitad de «cortar» que toca píxeles, compartida con «borrar» para que
   las dos no puedan acabar comportándose distinto. */
function eraseThrough(layer, box){
  if(doc.selection){
    const img = layer.ctx.getImageData(box.x, box.y, box.w, box.h);
    const mask = doc.selection.mask, mw = doc.selection.w;
    const d = img.data;
    for(let y = 0; y < box.h; y++){
      for(let x = 0; x < box.w; x++){
        const f = mask[(box.y + y) * mw + (box.x + x)] / 255;
        const i = (y * box.w + x) * 4 + 3;
        d[i] = Math.round(d[i] * (1 - f));
      }
    }
    layer.ctx.putImageData(img, box.x, box.y);
  } else {
    layer.ctx.clearRect(0, 0, doc.w, doc.h);
  }
  layer.thumbDirty = true;
}

/* Lo mismo sobre una máscara de capa. Ahí «borrar» no puede significar
   quitar píxeles —una máscara no tiene transparencia, es una escala de
   grises—, así que significa lo que significa el negro: ocultar esa
   zona de la capa. */
function eraseMask(layer, box){
  const ctx = layer.mask.ctx;
  const img = ctx.getImageData(box.x, box.y, box.w, box.h);
  const d = img.data;
  const sel = doc.selection;
  for(let y = 0; y < box.h; y++){
    for(let x = 0; x < box.w; x++){
      const f = sel ? sel.mask[(box.y + y) * sel.w + (box.x + x)] / 255 : 1;
      const i = (y * box.w + x) * 4;
      // El dato de la máscara vive en el alfa (ver editor/masks.js)
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(d[i + 3] * (1 - f));
    }
  }
  ctx.putImageData(img, box.x, box.y);
  layer.thumbDirty = true;
}

/* Comprobaciones comunes a cortar y borrar: sin esto, cada uno se
   inventaría sus propios mensajes para los mismos casos. */
function targetLayer(){
  if(!doc.open) return null;
  const l = activeLayer();
  if(!l){ toast("No hay capa activa"); return null; }
  if(l.locked){ toast("La capa está bloqueada"); return null; }
  if(l.type === "text"){
    toast("Rasteriza el texto para borrar una parte de él");
    return null;
  }
  if(l.type === "adjust"){ toast("Una capa de ajuste no tiene píxeles"); return null; }
  return l;
}

export function cutToClipboard(){
  const l = targetLayer();
  if(!l) return false;

  const box = selectionBox();
  if(!box){ toast("La selección está vacía"); return false; }
  if(!copyToClipboard()) return false;

  beginPixels("Cortar", l);
  eraseThrough(l, box);
  commitPixels();
  emit("doc:structure"); emit("doc:change");
  toast("Cortado");
  return true;
}

/* Borrar lo seleccionado, sin pasar por el portapapeles: lo que hace
   la tecla Suprimir. Con la máscara de la capa en edición, se aplica
   sobre la máscara y no sobre los píxeles —que es lo que se está
   mirando en ese momento, y borrar lo de debajo sería una sorpresa
   destructiva. */
export function deleteSelection(){
  const l = targetLayer();
  if(!l) return false;
  if(!doc.selection){ toast("No hay nada seleccionado"); return false; }

  const box = selectionBox();
  if(!box){ toast("La selección está vacía"); return false; }

  const onMask = getMaskTarget() === l.id && !!l.mask;
  beginPixels(onMask ? "Borrar en la máscara" : "Borrar", l, onMask);
  if(onMask) eraseMask(l, box);
  else eraseThrough(l, box);
  commitPixels();
  emit("doc:structure"); emit("doc:change");
  return true;
}

/* Selección rectangular sin difuminar sobre el área recién pegada,
   igual que hace Photoshop: nadie pega para dejar el resultado sin
   marcar, y así queda listo para moverlo con la herramienta Mover
   sin tener que volver a seleccionarlo a mano. */
function rectMask(box){
  const m = new Uint8ClampedArray(doc.w * doc.h);
  for(let y = 0; y < box.h; y++){
    const row = (box.y + y) * doc.w;
    for(let x = 0; x < box.w; x++) m[row + box.x + x] = 255;
  }
  return m;
}

export function pasteFromClipboard(){
  if(!doc.open){ toast("No hay documento abierto"); return false; }
  if(!clip){ toast("El portapapeles está vacío"); return false; }

  let x = clip.x, y = clip.y;
  const fits = x + clip.w <= doc.w && y + clip.h <= doc.h && x >= 0 && y >= 0;
  if(!fits){
    x = Math.round((doc.w - clip.w) / 2);
    y = Math.round((doc.h - clip.h) / 2);
  }
  x = Math.max(0, Math.min(doc.w - clip.w, x));
  y = Math.max(0, Math.min(doc.h - clip.h, y));
  const box = { x, y, w: Math.min(clip.w, doc.w), h: Math.min(clip.h, doc.h) };

  const l = addLayer({ name: "Pegado" });
  const idx = layerIndex(l.id);
  l.ctx.drawImage(clip.canvas, x, y);
  l.thumbDirty = true;

  const selBefore = doc.selection;
  const selAfter = { mask: rectMask(box), w: doc.w, h: doc.h };
  doc.selection = selAfter;

  const removeAndRestore = () => {
    const i = doc.layers.findIndex(o => o.id === l.id);
    if(i >= 0) doc.layers.splice(i, 1);
    if(doc.activeId === l.id){
      const fallback = doc.layers[i] || doc.layers[i - 1] || doc.layers[doc.layers.length - 1];
      doc.activeId = fallback ? fallback.id : null;
    }
    doc.selection = selBefore;
    emit("doc:structure"); emit("doc:change"); emit("sel:change");
  };
  const reinsertAndSelect = () => {
    doc.layers.splice(idx, 0, l);
    doc.activeId = l.id;
    doc.selection = selAfter;
    emit("doc:structure"); emit("doc:change"); emit("sel:change");
  };

  record("Pegar", removeAndRestore, reinsertAndSelect);
  emit("doc:structure"); emit("doc:change"); emit("sel:change");
  toast("Pegado");
  return true;
}
