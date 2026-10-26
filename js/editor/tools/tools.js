/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS
   Cada herramienta declara su icono, sus opciones y qué hace con el
   puntero. La barra de opciones se construye sola a partir de la
   declaración, así que añadir una herramienta nueva no obliga a
   tocar la interfaz.
   ═══════════════════════════════════════════════════════════════ */

import { emit, on } from "../../core/bus.js";
import { doc, activeLayer } from "../../core/doc.js";
import "../layers/layertree.js";
import "../../core/colorspace.js";
import "../../core/history.js";
import "../../core/view.js";
import "./grab.js";
import { scheduleOverlay, compose } from "../render/compositor.js";
import { toast } from "../../core/toast.js";
import { isText, updateText, textBounds, alignTextPatch } from "../text/text.js";
import "../text/textbox.js";
import { endEdit, isEditing, editingLayer, cursorPos as textCursorPos, place as placeEditor, focusEditor } from "../text/textedit.js";
import { charStyleAttrs, paraStyleAttrs } from "../text/textstyles.js";
import "./paint.js";
import { perspApply, perspReset, perspFill, perspClearGuides, perspAuto } from "./perspectool.js";
import { xformApply, xformResetAll, xformFlip, xformRotateBy, xformSync } from "./transformtool.js";
import "../selection/selection.js";
import "./contentmove.js";
import "../selection/pentool.js";
import "../../core/snapshots.js";
import "../layers/masks.js";
import "./rulers.js";
import "./liquify.js";
import "../../core/device.js";
import "../align.js";
import "../layers/layercontent.js";
import { setBrushOption } from "./brushes.js";
import { state, cursorPos } from "./defs/shared.js";
import { moveTool, camoveTool, liquifyTool } from "./defs/move-liquify.js";
import { panTool, zoomTool, pickerTool, compareTool, cmpOriginal, cmpActive } from "./defs/navigation.js";
import { cropTool, transformTool, perspectiveTool, ratioValue, finishAppliedTool, syncXformFields, syncPersp } from "./defs/crop-transform.js";
import { brushTool, eraserTool, exposeTool, dodgeburnTool, historyBrushTool, smudgeTool, stampGradient } from "./defs/paint.js";
import { textTool, noteStyleChange, flushStyleBurst, pushTextStyle, pullTextStyle } from "./defs/text.js";
import { fillTool, gradientTool } from "./defs/fill-gradient.js";
import { shapeTool } from "./defs/shape.js";
import { cloneTool, healTool } from "./defs/retouch.js";
import { selectRectTool, selectEllipseTool, selectLassoTool, selectWandTool, penTool } from "./defs/select.js";
import { current, registerTools } from "./tool-current.js";
export { state, setCursorPos } from "./defs/shared.js";
export { spacedSteps, addDodgeBurnLayer } from "./defs/paint.js";
export { moveKeep, clampMove, centerActiveLayerContent, resetLiquify } from "./defs/move-liquify.js";
export { invalidateCompareBaseline, setCompareBaseline } from "./defs/navigation.js";
export { applyCrop } from "./defs/crop-transform.js";
export { pushTextStyle, pullTextStyle } from "./defs/text.js";
export { current, cancelPendingTool, toolChosen, setTool } from "./tool-current.js";

const BRUSH_KEYS = { brushSymmetry: "symmetry", brushSymmetryCount: "symmetryCount", brushTexture: "texture",
  brushTextureDepth: "textureDepth", brushTextureScale: "textureScale", brushColorMode: "colorMode",
  brushGradientLength: "gradientLength" };

/** Pone un ajuste del pincel desde un comando (menú, cajón móvil). */
export function setBrushMode(key, value){
  state[key] = value;
  if(BRUSH_KEYS[key]) setBrushOption(BRUSH_KEYS[key], value);
}

/* «state.color» no guarda nada por sí mismo: es una ventana al color
   activo (frontal o fondo) según qué botón del ratón esté pintando
   ahora mismo. Así, Pincel, Bote de pintura y Cuentagotas seleccionan
   frontal/fondo solos, sin que cada uno tenga que saber que existen
   dos colores —leen y escriben «state.color» exactamente igual que
   antes de que el frontal/fondo existiera—. Formas y Degradado, en
   cambio, usan sus propias claves (fillColor, strokeColor, gradFrom,
   gradTo): sus colores tienen un rol fijo (relleno/borde, desde/hasta)
   y no deben cambiar sólo porque se pinte con el botón derecho. */
let activeColorSlot = "fg";

export function setActiveColorSlot(slot){ activeColorSlot = slot === "bg" ? "bg" : "fg"; }

export function getActiveColorSlot(){ return activeColorSlot; }

export function swapColors(){
  const t = state.fg; state.fg = state.bg; state.bg = t;
  emit("color:change");
}

export function resetColors(){
  state.fg = "#ffffff"; state.bg = "#000000";
  emit("color:change");
}

Object.defineProperty(state, "color", {
  enumerable: true,
  get(){ return state[activeColorSlot]; },
  set(v){ state[activeColorSlot] = v; emit("color:change"); }
});

export const TOOLS = [moveTool, panTool, zoomTool, cropTool, brushTool, eraserTool, textTool, fillTool, gradientTool, shapeTool, cloneTool, exposeTool, dodgeburnTool, historyBrushTool, smudgeTool, transformTool, perspectiveTool, healTool, camoveTool, selectRectTool, selectEllipseTool, selectLassoTool, selectWandTool, penTool, pickerTool, liquifyTool, compareTool];

function strokeDab(ctx, a, b, scale){
  const r = state.size / 2 * (scale || 1);
  const step = Math.max(1, r * 0.18);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(dist / step));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for(let i = 0; i <= n; i++){
    const t = n === 0 ? 0 : i / n;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    ctx.fillStyle = state.hardness >= 99
      ? state.color
      : stampGradient(ctx, x, y, r, state.color, state.hardness);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();
}

export const getCursorPos = () => cursorPos;

export function resetClone(){
  state.cloneSrc = null;
  state.cloneOffset = null;
  state.clonePick = false;
  toast("Origen de clonado olvidado");
}

export function pickCloneSource(){
  state.clonePick = true;
  toast("Toca o haz clic en el punto que quieres copiar");
}

/* Cada pestaña guarda su propio «antes» (documents.js lo mete en la
   instantánea de la pestaña y lo devuelve al volver a ella): cambiar de
   pestaña ya no lo pierde ni lo vuelve a capturar sobre lo editado. */
export const getCompareBaseline = () => cmpOriginal;

/* Comparison is drawn into the viewport overlay. Request its refresh
   after composition without allocating or altering the export canvas. */
on("compositor:done", () => {
  if(cmpActive) cmpApply();
});

function cmpApply(){
  // The viewport-sized overlay works with both tiled and normal views.
  // Never flatten the document on every comparison/zoom frame.
  scheduleOverlay();
}

export function centerCompare(){
  state.cmpSplit = 0.5;
  if(cmpActive) compose();
}

/* Al cambiar la proporción, el rectángulo se reencaja conservando el
   centro, que al cambiar de formato desconcierta mucho menos que
   anclar una esquina. */
export function reflowCrop(){
  const r = state.cropRect;
  const ar = ratioValue();
  if(!r || !ar) return;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  let w = r.w, h = w / ar;
  if(h > doc.h){ h = doc.h; w = h * ar; }
  if(w > doc.w){ w = doc.w; h = w / ar; }
  state.cropRect = {
    w, h,
    x: Math.max(0, Math.min(doc.w - w, cx - w / 2)),
    y: Math.max(0, Math.min(doc.h - h, cy - h / 2))
  };
  scheduleOverlay();
}

export async function applyPerspective(){
  if(await perspApply()){
    resetPerspState();
    finishAppliedTool();
  }
}

export function resetPerspective(){
  resetPerspState();
  perspReset();
  emit("tool:options");
}

export function clearPerspGuides(){ perspClearGuides(); }

export function autoPerspGuides(){ return perspAuto(); }

/* «Rellenar» cambia la escala por su cuenta, así que hay que devolver
   el valor al estado o el deslizador se quedaría diciendo otra cosa. */
export function fillPerspFrame(){
  state.perspScale = perspFill();
  emit("tool:options");
}

function resetPerspState(){
  state.perspVert = 0; state.perspHorz = 0;
  state.perspRot = 0;  state.perspScale = 100;
}

export function applyTransform(){
  if(xformApply()) finishAppliedTool();
}

export function resetTransform(){
  xformResetAll();
  syncXformFields();
}

export function rotateTransform(deg){
  xformRotateBy(deg);
  syncXformFields();
}

export function flipTransform(axis){
  xformFlip(axis);
  syncXformFields();
}

/* Cuando se cambia una opción con una capa de texto activa, el cambio
   se aplica a esa capa al momento. Es lo que hace cualquier editor y
   evita el paso extra de «aplicar». */
on("tool:paramchange", key => {
  if(BRUSH_KEYS[key]){
    setBrushOption(BRUSH_KEYS[key], state[key]);
    scheduleOverlay();
  }
  if(key === "dbShowGray") scheduleOverlay();
  if(current.id === "crop"){
    if(key === "cropRatio" || key === "cropW" || key === "cropH") reflowCrop();
    else if(key === "cropGuide") scheduleOverlay();
  }
  if(current.id === "perspective" && key.startsWith("persp")){
    syncPersp();
    return;
  }
  if(current.id === "transform" && key.startsWith("xf")){
    // No se llama a syncXformFields() aquí: si el propio campo que se
    // acaba de teclear se reconstruyera ahora mismo, perdería el foco
    // a media cifra. La barra ya tiene el valor que el usuario quiere
    // ver —es el suyo—; sólo hace falta que el motor lo recoja.
    xformSync({
      xfMode: state.xfMode, xfProportional: state.xfProportional,
      xfW: state.xfW, xfH: state.xfH,
      xfAngle: state.xfAngle, xfSkewX: state.xfSkewX, xfSkewY: state.xfSkewY
    });
    return;
  }
  if(current.id !== "text") return;
  const l = activeLayer();
  if(!isText(l)) return;

  /* «Trazado» sólo decide qué hace el próximo arrastre en hueco: no es
     un atributo de la capa, así que no hay nada que aplicar ni que
     deshacer. */
  if(key === "textPathMode") return;

  /* El kerning manual no es un campo plano del texto sino un valor
     por hueco de cursor —ver `textKerning` en el array de opciones—,
     así que no pasa por pushTextStyle: se escribe directo en
     `layer.text.kerning`, indexado por la misma posición que usa
     `textarea.selectionStart` (y que sobrevive al reajuste de línea,
     ver wrapLine() en text.js). Cero borra la entrada entera en vez
     de dejar un cero explícito, que ensuciaría el mapa sin motivo. */
  if(key === "textKerning"){
    const cp = textCursorPos();
    if(isEditing() && cp && cp.start === cp.end){
      noteStyleChange(l);
      const kerning = { ...(l.text.kerning || {}) };
      if(state.textKerning) kerning[cp.start] = state.textKerning;
      else delete kerning[cp.start];
      updateText(l, { kerning });
      placeEditor(true);
      focusEditor();
    }
    return;
  }

  /* Un estilo de carácter o de párrafo es un «sello»: aplicarlo copia
     sus valores sobre la capa activa ahora mismo (ver textstyles.js),
     como un solo paso de historial —no una ráfaga— porque elegirlo en
     el desplegable es un gesto discreto, no un arrastre. */
  if(key === "charStyle"){
    const attrs = state.charStyle && charStyleAttrs(state.charStyle);
    if(attrs){ noteStyleChange(l); updateText(l, attrs); flushStyleBurst(); }
    return;
  }
  if(key === "paraStyle"){
    const attrs = state.paraStyle && paraStyleAttrs(state.paraStyle);
    if(attrs){ noteStyleChange(l); updateText(l, attrs); flushStyleBurst(); }
    return;
  }

  /* Al encender el marco se toma la medida de lo que el texto ocupa
     ahora mismo: pasar a párrafo no debería recolocar nada de golpe,
     sólo poner un marco alrededor de lo que ya había. */
  if(key === "textBoxed" && state.textBoxed){
    const b = textBounds(l);
    state.textBoxW = Math.max(40, Math.round(b.w) + Math.round(state.fontSize * 0.6));
    state.textBoxH = Math.max(24, Math.round(b.h) + Math.round(state.fontSize * 0.6));
  }
  noteStyleChange(l);
  /* Alinear un texto de punto no lo mueve: se recoloca su ancla para
     que el bloque se quede donde estaba (ver alignTextPatch). */
  if(key === "align") updateText(l, alignTextPatch(l, state.align));
  pushTextStyle(l);
  /* Si se está escribiendo, el cuadro de edición tiene que seguir al
     cambio —otra tipografía o otro cuerpo lo dejan descuadrado sobre
     el texto— y el foco tiene que volver al textarea, o el resto de lo
     que se teclee acaba en el control de la barra que se acaba de
     tocar. */
  if(isEditing()){ placeEditor(true); focusEditor(); }
});

on("doc:active", () => {
  // Cambiar de capa mientras se escribe cierra la edición: seguir con
  // un cuadro abierto sobre una capa que ya no es la activa es la vía
  // rápida a escribir en la capa equivocada.
  if(isEditing() && editingLayer() !== activeLayer()) endEdit();
  if(current.id !== "text") return;
  const l = activeLayer();
  if(isText(l)) pullTextStyle(l);
});

/* El campo de kerning muestra lo que YA tiene el hueco donde esté el
   cursor ahora mismo —ver textedit.js, que dispara esto en cada tecla
   y cada clic dentro del cuadro de edición—, no lo último que se haya
   tecleado en otro sitio. */
on("text:cursor", () => {
  const l = editingLayer();
  if(!isText(l)) return;
  const cp = textCursorPos();
  state.textKerning = (cp && cp.start === cp.end && l.text.kerning) ? (l.text.kerning[cp.start] || 0) : 0;
  if(current.id === "text") emit("tool:options");
});

registerTools(TOOLS);

on("doc:new", () => {
  if(current && current.activate) current.activate();
});
