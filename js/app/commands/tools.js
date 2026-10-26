/* ═══════════════════════════════════════════════════════════════
   APP · comandos de herramientas del lienzo
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { resetLiquify, current, centerCompare, applyCrop, cancelPendingTool, applyPerspective, resetPerspective, autoPerspGuides, clearPerspGuides, fillPerspFrame, applyTransform, resetTransform, flipTransform, rotateTransform, setTool, state as toolState, reflowCrop, addDodgeBurnLayer } from "../../editor/tools/tools.js";
import { doc, activeLayer } from "../../core/doc.js";
import { xformCanStart } from "../../editor/tools/transformtool.js";
import { penFinishOpen, penToSelection, penHasPath, penToMask, penUndoPoint } from "../../editor/selection/pentool.js";
import { toast } from "../../core/toast.js";
import { emit } from "../../core/bus.js";
import { needsDoc } from "./helpers.js";

registerAll({
  "liquify.reset": { run: resetLiquify, enabled: () => doc.open && current.id === "liquify" },
  "compare.center": { run: centerCompare, enabled: () => doc.open && current.id === "compare" },
  "crop.apply":  { run: applyCrop, enabled: () => doc.open && current.id === "crop" },
  "crop.cancel": { run: cancelPendingTool, enabled: () => current.id === "crop" },
  "clone.reset": { run: async () => (await import("../../editor/tools/tools.js")).resetClone(),
                   enabled: () => current.id === "clone" },
  "clone.pickSource": { run: async () => (await import("../../editor/tools/tools.js")).pickCloneSource(),
                   enabled: () => current.id === "clone" },
  "perspective.apply": { run: applyPerspective, enabled: () => doc.open && current.id === "perspective" },
  "perspective.reset": { run: resetPerspective, enabled: () => current.id === "perspective" },
  "perspective.auto":  { run: autoPerspGuides, enabled: () => doc.open && current.id === "perspective" },
  "perspective.clear": { run: clearPerspGuides, enabled: () => current.id === "perspective" },
  "perspective.fill":  { run: fillPerspFrame,  enabled: () => current.id === "perspective" },
  "perspective.cancel": { run: cancelPendingTool, enabled: () => current.id === "perspective" },
  "transform.apply":  { run: applyTransform, enabled: () => doc.open && current.id === "transform" },
  "transform.reset":  { run: resetTransform, enabled: () => current.id === "transform" },
  "transform.cancel": { run: cancelPendingTool, enabled: () => current.id === "transform" },
  /* Esc, con Recortar/Transformación libre/Perspectiva a medias: la
     única otra vía —aparte del botón «Cancelar» de cada una— que
     también debe descartar en vez de aplicar. Genérico a propósito:
     cancelPendingTool() ya sabe volver a Mover sea cual sea la
     herramienta activa de las tres. */
  "tool.cancelPending": { run: cancelPendingTool,
    enabled: () => ["crop", "transform", "perspective"].includes(current.id) },
  "transform.flipH":  { run: () => flipTransform("h"), enabled: () => current.id === "transform" },
  "transform.flipV":  { run: () => flipTransform("v"), enabled: () => current.id === "transform" },
  "transform.rotL":   { run: () => rotateTransform(-90), enabled: () => current.id === "transform" },
  "transform.rotR":   { run: () => rotateTransform(90), enabled: () => current.id === "transform" },
  "transform.start":  { run: () => setTool("transform"), enabled: () => needsDoc() && xformCanStart() },
  "pen.start":  { run: () => setTool("pen"), enabled: needsDoc },
  "pen.close":  { run: () => { if(!penFinishOpen()) toast("No hay ningún trazado abierto que cerrar"); },
                  enabled: () => current.id === "pen" },
  "pen.toSelection": { run: () => penToSelection("new"), enabled: () => current.id === "pen" && penHasPath() },
  "pen.toMask": { run: () => { const l = activeLayer(); if(l) penToMask(l, "new"); },
                  enabled: () => current.id === "pen" && penHasPath() && !!activeLayer() },
  "pen.undoPoint": { run: () => penUndoPoint(), enabled: () => current.id === "pen" },
  "pen.cancel": { run: () => setTool("move", { auto:true }), enabled: () => current.id === "pen" },
  "crop.swap":   { run: () => {
      if(toolState.cropRatio !== "custom"){
        const ratio = toolState.cropRatio === "orig"
          ? toolState.cropRect?.w / toolState.cropRect?.h
          : toolState.cropRatio === "free" ? 1
          : (() => { const [w, h] = toolState.cropRatio.split(":").map(Number); return w / h; })();
        toolState.cropW = Math.max(1, Math.round(ratio * 1000));
        toolState.cropH = 1000;
        toolState.cropRatio = "custom";
      }
      const w = toolState.cropW; toolState.cropW = toolState.cropH; toolState.cropH = w;
      emit("tool:options");
      reflowCrop();
    }, enabled: () => current.id === "crop" },
  "dodgeburn.start":    { run: () => setTool("dodgeburn"), enabled: needsDoc },
  "brush.settings":     { run: async () => (await import("../../editor/tools/brushes.js")).openBrushPanel(), enabled: needsDoc },
  "dodgeburn.newLayer": { run: () => { addDodgeBurnLayer(); setTool("dodgeburn"); }, enabled: needsDoc },
  /* Dodge & Burn con la capa gris a la vista, en tiempo real */
  "dodgeburn.viewGray": { run: async () => {
      setTool("dodgeburn");
      const t = await import("../../editor/tools/tools.js");
      t.state.dbShowGray = !t.state.dbShowGray;
      emit("tool:options"); emit("tool:paramchange", "dbShowGray");
      toast(t.state.dbShowGray ? "Viendo la capa gris al 50 % en tiempo real" : "Vista normal");
    }, enabled: needsDoc },
  /* Pinceles especiales: activan el Pincel con el modo ya puesto (los
     ajustes siguen en su barra de opciones y en «Pinceles…"). */
  "brush.symmetric": { run: async () => {
      setTool("brush");
      const t = await import("../../editor/tools/tools.js");
      if(t.state.brushSymmetry === "none") t.setBrushMode("brushSymmetry", "horizontal");
      emit("tool:options"); toast("Pincel simétrico: elige el eje en la barra de opciones");
    }, enabled: needsDoc },
  "brush.textured": { run: async () => {
      setTool("brush");
      const t = await import("../../editor/tools/tools.js");
      if(t.state.brushTexture === "none") t.setBrushMode("brushTexture", "grain");
      emit("tool:options"); toast("Pincel con textura: grano, papel, lienzo, cristales, rayones…");
    }, enabled: needsDoc },
  "brush.gradient": { run: async () => {
      setTool("brush");
      const t = await import("../../editor/tools/tools.js");
      if(t.state.brushColorMode === "solid") t.setBrushMode("brushColorMode", "gradient");
      emit("tool:options"); toast("Pincel de degradado: del color frontal al de fondo a lo largo del trazo");
    }, enabled: needsDoc }
});
