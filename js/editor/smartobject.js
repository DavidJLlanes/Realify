/* ═══════════════════════════════════════════════════════════════
   OBJETOS INTELIGENTES
   Convertir una capa guarda su lienzo actual íntegro en
   `smartSource` y fija `smartBox` (el rectángulo de contenido sobre
   el que se miden sus transformaciones, ver editor/transformtool.js).
   A partir de ahí, escalar o rotar con Transformación libre no
   vuelve a tocar ese original: cada ajuste remuestrea desde él, así
   que encoger al 30 % y volver al 100 % después no dejó ninguna
   huella por el camino. Pintar directamente sobre la capa SÍ la
   convierte de vuelta en una normal —ver el aviso en
   core/history.js#beginPixels—, y «Rasterizar» hace lo mismo a
   propósito, por si el usuario quiere volver a pintarla sin más
   rodeos.
   ═══════════════════════════════════════════════════════════════ */

import { activeLayer } from "../core/doc.js";
import { contentBounds } from "./align.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { toast } from "../ui/toast.js";

export function canConvertToSmart(layer){
  return !!(layer && !layer.smart && layer.type !== "adjust" && layer.type !== "group" && !layer.locked);
}

function snapshot(canvas){
  const c = document.createElement("canvas");
  c.width = canvas.width; c.height = canvas.height;
  c.getContext("2d").drawImage(canvas, 0, 0);
  return c;
}

function smartSnapshot(layer){
  return { smart: layer.smart, smartSource: layer.smartSource,
           smartTransform: layer.smartTransform, smartBox: layer.smartBox };
}

function putSmart(layer, s){
  layer.smart = s.smart; layer.smartSource = s.smartSource;
  layer.smartTransform = s.smartTransform; layer.smartBox = s.smartBox;
  emit("doc:structure"); emit("doc:change");
}

export function convertToSmart(layer = activeLayer()){
  if(!canConvertToSmart(layer)) return false;
  const before = smartSnapshot(layer);
  const box = contentBounds(layer) || { x: 0, y: 0, w: layer.canvas.width, h: layer.canvas.height };
  const after = { smart: true, smartSource: snapshot(layer.canvas), smartTransform: null, smartBox: box };

  putSmart(layer, after);
  record("Convertir en objeto inteligente", () => putSmart(layer, before), () => putSmart(layer, after));
  toast("«" + layer.name + "» convertida en objeto inteligente", "ok");
  return true;
}

export function rasterizeSmart(layer = activeLayer()){
  if(!layer || !layer.smart) return false;
  const before = smartSnapshot(layer);
  const after = { smart: false, smartSource: null, smartTransform: null, smartBox: null };

  putSmart(layer, after);
  record("Rasterizar objeto inteligente", () => putSmart(layer, before), () => putSmart(layer, after));
  toast("«" + layer.name + "» rasterizada", "ok");
  return true;
}
