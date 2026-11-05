/* ═══════════════════════════════════════════════════════════════
   AI-KIT · IMAGEN VISIBLE
   Lo que se VE (la imagen compuesta de todas las capas), en un lienzo legible. Las funciones de IA analizan esto y no la
   capa activa: tras difuminar, por ejemplo, la activa es la capa nueva, casi transparente.
   Entradas: ninguna (lee el documento abierto). Salida: lienzo 2D legible, o null si no hay imagen (avisa con un toast).
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../../core/doc.js";
import { toast } from "../../core/toast.js";

export async function visibleImage(){
  if(!doc.open || !activeLayer()){ toast("Abre una imagen primero"); return null; }
  const { flatten } = await import("../../editor/layers/layertree.js");
  const c = flatten();
  // flatten puede dejar el lienzo en la GPU: una copia legible
  const r = document.createElement("canvas"); r.width = c.width; r.height = c.height;
  r.getContext("2d", { willReadFrequently: true }).drawImage(c, 0, 0);
  return r;
}
