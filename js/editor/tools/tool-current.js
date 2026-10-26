/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · La herramienta activa y cómo se cambia (setTool). Recibe la lista de herramientas con registerTools al arrancar, para que las herramientas puedan llamar a setTool sin importar el registro.
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { emit } from "../../core/bus.js";
import { isEditing, endEdit } from "../text/textedit.js";
import { doc } from "../../core/doc.js";

/* ═══ herramienta activa ═══ */
let toolList = [];

export function registerTools(list){ toolList = list; current = list[0]; }

export let current = null;

/* Sólo la usan los botones/atajo «Cancelar» de Recortar, Transformación
   libre y Perspectiva (ver tools.js más arriba y commands en main.js):
   fuerza que el deactivate() de esas tres tire de verdad el cambio
   pendiente en vez de aplicarlo, que es lo que hacen por defecto al
   cambiar a CUALQUIER otra herramienta (ver el comentario en cada
   deactivate()). */
export let forceDiscard = false;

export function cancelPendingTool(){
  forceDiscard = true;
  setTool("move", { auto:true });
  forceDiscard = false;
}

/* ¿La herramienta activa la ha elegido el usuario, o es la de
   partida? Siempre hay una activa —«Mover» al arrancar y como destino
   al terminar Recortar/Perspectiva/Transformar o al cancelar—, pero
   esa no es una elección: el «?» de la barra de opciones abre en ese
   caso la guía general en vez de la ayuda de «Mover». Las vueltas
   automáticas pasan `{ auto:true }`. */
let chosen = false;

export const toolChosen = () => chosen;

const STROKE_TOOLS = new Set(["fill","gradient","shape","pen","picker","select-rect","select-ellipse","select-lasso","select-wand"]);

export function setTool(id, { auto = false } = {}){
  const t = toolList.find(x => x.id === id);
  if(!t) return;
  if(t === current){
    // Elegir a mano la misma que ya estaba puesta por defecto sí
    // cuenta como elección: sólo cambia a qué ayuda lleva el «?».
    if(!auto && !chosen){ chosen = true; emit("tool:options"); }
    return;
  }
  chosen = !auto;
  if(isEditing()) endEdit();
  if(current && current.deactivate) current.deactivate();
  current = t;
  window.__panTool = !!t.pan;
  /* Herramientas que trazan o seleccionan con un dedo (pincel, borrador,
     clonar, degradado, lazo…): con zoom, un dedo debe seguir trazando y
     son DOS dedos los que desplazan la vista (ver handlePointerDown). */
  window.__strokeTool = t.cursor === "none" || STROKE_TOOLS.has(t.id);
  if(t.activate && doc.open) t.activate();
  emit("tool:change", t);
  emit("tool:options");
}
