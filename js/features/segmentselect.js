/* ═══════════════════════════════════════════════════════════════
   SELECCIONAR SUJETO / CIELO (menú Selección)
   Misma detección que los botones del panel de propiedades de la
   máscara (editor/maskadjust.js), pero sin necesitar tener ya una
   máscara: deja el resultado como SELECCIÓN activa —marching ants—,
   lista para combinar con otras selecciones o convertirse en máscara
   con «Añadir máscara desde selección», como cualquier otra.
   ═══════════════════════════════════════════════════════════════ */

import { activeLayer } from "../core/doc.js";
import { commitSelection } from "../editor/selection.js";
import { detectSubjectMask, detectSkyMask } from "../editor/maskadjust.js";
import { toast, status } from "../ui/toast.js";

function rasterLayer(){
  const l = activeLayer();
  if(!l){ toast("No hay capa activa"); return null; }
  if(l.type === "adjust"){ toast("Selecciona una capa de imagen"); return null; }
  return l;
}

export async function selectSubjectCommand(){
  const layer = rasterLayer();
  if(!layer) return;
  status("Detectando el sujeto…");
  try{
    const { mask, method } = await detectSubjectMask(layer.canvas);
    commitSelection(mask, "new");
    toast(method === "persona" ? "Sujeto seleccionado por IA" : "Sujeto seleccionado por color", "ok");
  }catch(err){
    toast("No se pudo detectar el sujeto: " + (err.message || err), "err");
  }finally{
    status("");
  }
}

export async function selectSkyCommand(){
  const layer = rasterLayer();
  if(!layer) return;
  status("Detectando el cielo…");
  try{
    const { mask } = await detectSkyMask(layer.canvas);
    if(!mask){ toast("No se ha encontrado cielo en esta foto", "err"); return; }
    commitSelection(mask, "new");
    toast("Cielo seleccionado", "ok");
  }catch(err){
    toast("No se pudo detectar el cielo: " + (err.message || err), "err");
  }finally{
    status("");
  }
}
