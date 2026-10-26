/* ═══════════════════════════════════════════════════════════════
   APP · comandos de Capa y texto
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { centerActiveLayerContent, setTool, state as toolState } from "../../editor/tools/tools.js";
import { recordLayers, record } from "../../core/history.js";
import { addLayer, activeLayer, duplicateLayer, removeLayer, doc, mergeDown } from "../../core/doc.js";
import { duplicateGroup, removeGroupAndContents, moveLayerOrGroup, groupLayers, ungroupLayers } from "../../editor/layers/groups.js";
import { promptDlg, dialog } from "../../ui/kit/dialog.js";
import { emit } from "../../core/bus.js";
import { toast } from "../../core/toast.js";
import { convertToSmart, canConvertToSmart, rasterizeSmart } from "../../editor/layers/smartobject.js";
import { canRasterize, addFillLayer, pickPatternImage, rasterizeLayer } from "../../editor/layers/layercontent.js";
import { getSelectedLayerIds } from "../../ui/panels.js";
import { mergeVisible, flattenImage } from "../../editor/imageops.js";
import { openLayerStyles } from "../../editor/layers/layerstyles.js";
import { createTextLayer, isText, rasterizeText, updateText } from "../../editor/text/text.js";
import { startEdit, isEditing, endEdit } from "../../editor/text/textedit.js";
import { alignLayers, distributeLayers } from "../../editor/align.js";
import { addMask, setMaskTarget, removeMask, invertMaskLayer, toggleMask, getMaskTarget } from "../../editor/layers/masks.js";
import { hasSelection } from "../../editor/selection/selection.js";
import { maskLevels, maskCurves, maskBlur, maskProperties } from "../../editor/layers/maskadjust.js";
import { adjustTypeIds, adjustTypeName, addAdjustmentLayer, openAdjustPanel, isAdjustLayer } from "../../editor/layers/adjustlayers.js";
import { blendIfDefault, blendIfEligible } from "../../editor/layers/blendif.js";
import { saveCharStyle, saveParaStyle } from "../../editor/text/textstyles.js";
import { needsDoc, photoTool, selOrActive, needsSelOrActive } from "./helpers.js";

registerAll({
  "layer.maskText": { run: async () => (await import("../../features/textselect.js")).maskByTextCommand(), enabled: needsDoc },
  "layer.centerContent": { run: centerActiveLayerContent, enabled: needsDoc },
  "layer.add":       { run: () => recordLayers("Nueva capa", () => addLayer()), enabled: needsDoc },
  "layer.duplicate": { run: () => {
                         const l = activeLayer();
                         if(l && l.type === "group") duplicateGroup(l.id);
                         else recordLayers("Duplicar capa", () => duplicateLayer());
                       }, enabled: needsDoc },
  "layer.rename": { run: async () => {
                       const l = activeLayer(); if(!l) return;
                       const name = await promptDlg("Renombrar capa", "Nombre", l.name);
                       if(name === null) return;
                       const before = l.name, after = name.trim().slice(0, 80) || before;
                       if(after === before) return;
                       l.name = after;
                       record("Renombrar capa", () => { l.name = before; emit("doc:structure"); }, () => { l.name = after; emit("doc:structure"); });
                       emit("doc:structure");
                     }, enabled: needsDoc },
  "layer.remove":    { run: () => {
                         const l = activeLayer();
                         if(l && l.type === "group"){
                           if(!removeGroupAndContents(l.id)) toast("Debe quedar al menos una capa");
                           return;
                         }
                         if(!recordLayers("Eliminar capa", () => removeLayer())) toast("Debe quedar al menos una capa");
                       }, enabled: () => doc.open && doc.layers.length > 1 },
  "layer.up":        { run: () => moveLayerOrGroup(doc.activeId, 1), enabled: needsDoc },
  "layer.down":      { run: () => moveLayerOrGroup(doc.activeId, -1), enabled: needsDoc },
  "layer.transform": { run: photoTool("transformLayer"), enabled: needsDoc },
  "layer.convertSmart": { run: () => convertToSmart(), enabled: () => canConvertToSmart(activeLayer()) },
  "layer.rasterizeSmart": { run: () => rasterizeSmart(), enabled: () => !!activeLayer()?.smart },
  "layer.gradientMask": { run: photoTool("gradientLayerMask"), enabled: needsDoc },
  "layer.watermark": { run: photoTool("watermark"), enabled: needsDoc },
  "layer.mergeDown": { run: () => {
                         // La capa de ABAJO es la que recibe los píxeles: si es de
                         // relleno o de forma, «combinar» pintaría directamente sobre
                         // su lienzo sin tocar `fill`/`shape`, y el próximo ajuste en
                         // el panel de Propiedades lo borraría todo sin avisar —el
                         // mismo motivo que ya bloquean los pinceles, ver
                         // requirePaintable() en editor/tools/tools.js—.
                         const i = doc.layers.findIndex(l => l.id === doc.activeId);
                         const below = i > 0 ? doc.layers[i - 1] : null;
                         if(below && (!below.visible || below.opacity !== 1 || below.blend !== "source-over" || below.clipped || below.mask || below.maskRef || below.styles || below.blendIf)){
                           toast(`«${below.name}» tiene máscara, opacidad, fusión o efectos propios; aplícales una composición segura antes de combinar.`, "err");
                           return;
                         }
                         const top = i >= 0 ? doc.layers[i] : null;
                         if(top && below && top.groupId !== below.groupId){
                           toast("No se pueden combinar capas de grupos distintos; desagrupa o elige una capa del mismo grupo.", "err");
                           return;
                         }
                         if(top && (top.clipped || top.styles || top.blendIf)){
                           toast(`«${top.name}» tiene recorte, estilos o Fusionar si; aplícalos antes de combinar.`, "err");
                           return;
                         }
                         if(below && (canRasterize(below))){
                           toast(`«${below.name}» es una capa de relleno o de forma: rasterízala primero (menú Capa) para poder combinar sobre ella.`, "err");
                           return;
                         }
                         if(!below){ toast("No hay capa debajo"); return; }
                         // La de abajo recibe los píxeles de la de arriba: para
                         // poder deshacer hay que guardar su contenido de antes y
                         // de después, además de la lista de capas.
                         const copyOf = c => { const o = document.createElement("canvas");
                           o.width = c.width; o.height = c.height;
                           o.getContext("2d").drawImage(c, 0, 0); return o; };
                         const pixBefore = copyOf(below.canvas), fxBefore = structuredClone(below.filters || []);
                         const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
                         if(!mergeDown()){ toast("No hay capa debajo"); return; }
                         const pixAfter = copyOf(below.canvas), fxAfter = structuredClone(below.filters || []);
                         const nextLayers = doc.layers.slice(), nextActive = doc.activeId;
                         const put = (pix, layers, active, fx) => {
                           below.filters = structuredClone(fx); below._fxFull = null;
                           const x = below.ctx;
                           x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
                           x.globalCompositeOperation = "copy";
                           x.drawImage(pix, 0, 0); x.restore();
                           below.thumbDirty = true;
                           doc.layers = layers.slice(); doc.activeId = active;
                           emit("doc:structure"); emit("doc:change");
                         };
                         record("Combinar hacia abajo",
                           () => put(pixBefore, prevLayers, prevActive, fxBefore),
                           () => put(pixAfter, nextLayers, nextActive, fxAfter));
                       },
                       enabled: () => { const l = activeLayer(); return needsDoc() && l && l.type !== "group" && l.type !== "adjust"; } },
  "layer.mergeSelected": { run: () => {
                         const ids = getSelectedLayerIds();
                         if(ids.length < 2){ toast("Selecciona al menos dos capas para combinarlas.", "err"); return; }
                         const selected = ids.map(id => ({ id, i: doc.layers.findIndex(l => l.id === id) }))
                           .filter(x => x.i >= 0).sort((a, b) => a.i - b.i);
                         if(selected.length < 2){ toast("Selecciona al menos dos capas para combinarlas.", "err"); return; }
                         for(let k = 1; k < selected.length; k++){
                           if(selected[k].i !== selected[k - 1].i + 1){
                             toast("Sólo se pueden combinar capas seleccionadas contiguas.", "err");
                             return;
                           }
                         }
                         const layers = selected.map(x => doc.layers[x.i]);
                         if(layers.some(l => l.type === "group" || l.type === "adjust")){
                           toast("Los grupos y las capas de ajuste no se pueden combinar directamente.", "err");
                           return;
                         }
                         const groupId = layers[0].groupId ?? null;
                         if(layers.some(l => (l.groupId ?? null) !== groupId)){
                           toast("Las capas seleccionadas deben pertenecer al mismo grupo.", "err");
                           return;
                         }
                         // Todas salvo la superior actuarán en algún momento como
                         // capa receptora. Deben ser neutras para que una capa de
                         // arriba no herede su opacidad, fusión, máscara o efectos.
                         for(const l of layers.slice(0, -1)){
                           if(!l.visible || l.opacity !== 1 || l.blend !== "source-over" || l.clipped || l.mask || l.maskRef || l.styles || l.blendIf){
                             toast(`«${l.name}» tiene máscara, opacidad, fusión o efectos propios; aplícalos antes de combinar la selección.`, "err");
                             return;
                           }
                           if(canRasterize(l)){
                             toast(`«${l.name}» es una capa de relleno o de forma: rasterízala primero.`, "err");
                             return;
                           }
                         }
                         for(const l of layers.slice(1)){
                           if(l.clipped || l.styles || l.blendIf){
                             toast(`«${l.name}» tiene recorte, estilos o Fusionar si; aplícalos antes de combinar.`, "err");
                             return;
                           }
                         }
                         const copyOf = c => { const o = document.createElement("canvas");
                           o.width = c.width; o.height = c.height; o.getContext("2d").drawImage(c, 0, 0); return o; };
                         const beforePixels = new Map(layers.map(l => [l.id, copyOf(l.canvas)])), fxBefore = structuredClone(layers[0].filters || []);
                         const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
                         for(let k = layers.length - 1; k > 0; k--){
                           if(!mergeDown(layers[k].id)){
                             toast("No se pudieron combinar las capas seleccionadas.", "err");
                             return;
                           }
                         }
                         const bottom = layers[0], afterPixel = copyOf(bottom.canvas), fxAfter = structuredClone(bottom.filters || []);
                         const nextLayers = doc.layers.slice(), nextActive = doc.activeId;
                         const restoreCanvas = (layer, pix) => {
                           const x = layer.ctx; x.save(); x.setTransform(1,0,0,1,0,0);
                           x.globalCompositeOperation = "copy"; x.drawImage(pix,0,0); x.restore(); layer.thumbDirty = true;
                         };
                         record("Combinar capas seleccionadas",
                           () => {
                             for(const l of layers) restoreCanvas(l, beforePixels.get(l.id));
                             bottom.filters = structuredClone(fxBefore); bottom._fxFull = null;
                             doc.layers = prevLayers.slice(); doc.activeId = prevActive;
                             emit("doc:structure"); emit("doc:change");
                           },
                           () => {
                             restoreCanvas(bottom, afterPixel);
                             bottom.filters = structuredClone(fxAfter); bottom._fxFull = null;
                             doc.layers = nextLayers.slice(); doc.activeId = nextActive;
                             emit("doc:structure"); emit("doc:change");
                           });
                       },
                       enabled: () => doc.open && getSelectedLayerIds().length >= 2 },
  "layer.mergeVisible": { run: mergeVisible,
                          enabled: () => doc.open && doc.layers.filter(l => l.groupId == null && l.visible).length > 1 },
  "layer.flatten":   { run: flattenImage, enabled: () => doc.open && doc.layers.length > 1 },
  "layer.group":     { run: () => {
                         const ids = getSelectedLayerIds();
                         groupLayers(ids.length ? ids : (doc.activeId !== null ? [doc.activeId] : []));
                       }, enabled: () => doc.open && (getSelectedLayerIds().length > 0 || doc.activeId !== null) },
  "layer.ungroup":   { run: () => { const l = activeLayer();
                         if(!l || l.type !== "group" || !ungroupLayers(l.id)) toast("Selecciona un grupo para desagruparlo");
                       }, enabled: () => { const l = activeLayer(); return !!l && l.type === "group"; } },
  "layer.styles":    { run: () => { const l = activeLayer(); if(l) openLayerStyles(l); }, enabled: needsDoc },
  "layer.text":      { run: () => { setTool("text"); const l = createTextLayer(); startEdit(l, true); },
                       enabled: needsDoc },
  "layer.editText":  { run: () => { const l = activeLayer();
                                    // Texto que ya existe: todo seleccionado, pero NO nuevo —con
                                    // `isNew` Esc lo borraba entero y aceptar anotaba otro «Añadir texto».
                                    if(isText(l)){ setTool("text"); startEdit(l, true, false); } },
                       enabled: () => isText(activeLayer()) },
  "layer.rasterizeText": { run: () => { if(isEditing()) endEdit(); rasterizeText(activeLayer()); },
                       enabled: () => isText(activeLayer()) },
  /* Creador de memes a pantalla completa (plugins/memes/). */
  "layer.meme":      { run: async () => (await import("../../../plugins/memes/index.js")).openMemeCreator(),
                       enabled: needsDoc },
  "layer.stickers":  { run: async () => (await import("../../../plugins/stickers/index.js")).openStickers(),
                       enabled: needsDoc },
  "layer.alignLeft":    { run: () => alignLayers(selOrActive(), "left"),    enabled: needsSelOrActive },
  "layer.alignCenterH":  { run: () => alignLayers(selOrActive(), "centerH"), enabled: needsSelOrActive },
  "layer.alignRight":    { run: () => alignLayers(selOrActive(), "right"),   enabled: needsSelOrActive },
  "layer.alignTop":      { run: () => alignLayers(selOrActive(), "top"),     enabled: needsSelOrActive },
  "layer.alignCenterV":  { run: () => alignLayers(selOrActive(), "centerV"), enabled: needsSelOrActive },
  "layer.alignBottom":   { run: () => alignLayers(selOrActive(), "bottom"),  enabled: needsSelOrActive },
  "layer.distributeH":   { run: () => distributeLayers(getSelectedLayerIds(), "h"),
                           enabled: () => doc.open && getSelectedLayerIds().length >= 3 },
  "layer.distributeV":   { run: () => distributeLayers(getSelectedLayerIds(), "v"),
                           enabled: () => doc.open && getSelectedLayerIds().length >= 3 },
  "layer.maskFromSel": { run: () => { addMask(activeLayer(), true); setMaskTarget(doc.activeId); },
                          enabled: () => doc.open && activeLayer() && !activeLayer().mask && hasSelection() },
  "layer.maskFromSelInvert": { run: () => { addMask(activeLayer(), true, true); setMaskTarget(doc.activeId); },
                          enabled: () => doc.open && activeLayer() && !activeLayer().mask && hasSelection() },
  "layer.maskReveal":  { run: () => { addMask(activeLayer(), false); setMaskTarget(doc.activeId); },
                          enabled: () => doc.open && activeLayer() && !activeLayer().mask },
  "layer.maskHide":    { run: () => { addMask(activeLayer(), false, true); setMaskTarget(doc.activeId); },
                          enabled: () => doc.open && activeLayer() && !activeLayer().mask },
  "layer.maskDepth":   { run: async () => (await import("../../features/depthzones.js")).maskByDepthCommand(),
                          enabled: () => doc.open && !!activeLayer() },
  "layer.maskRemove":  { run: () => { setMaskTarget(null); removeMask(activeLayer(), false); },
                          enabled: () => doc.open && activeLayer() && activeLayer().mask },
  "layer.maskApply":   { run: () => { setMaskTarget(null); removeMask(activeLayer(), true); },
                          enabled: () => doc.open && activeLayer() && activeLayer().mask },
  "layer.maskInvert":  { run: () => invertMaskLayer(activeLayer()),
                          enabled: () => doc.open && activeLayer() && activeLayer().mask },
  "layer.maskToggle":  { run: () => toggleMask(activeLayer()),
                          enabled: () => doc.open && activeLayer() && activeLayer().mask },
  "layer.maskEdit":    { run: () => {
      const l = activeLayer();
      if(!l || !l.mask) return;
      setMaskTarget(getMaskTarget() === l.id ? null : l.id);
    }, enabled: () => doc.open && activeLayer() && activeLayer().mask },
  "layer.maskLevels":     { run: () => maskLevels(activeLayer()),
                            enabled: () => doc.open && activeLayer() && activeLayer().mask },
  "layer.maskCurves":     { run: () => maskCurves(activeLayer()),
                            enabled: () => doc.open && activeLayer() && activeLayer().mask },
  "layer.maskBlur":       { run: () => maskBlur(activeLayer()),
                            enabled: () => doc.open && activeLayer() && activeLayer().mask },
  "layer.maskProperties": { run: () => maskProperties(activeLayer()),
                            enabled: () => doc.open && activeLayer() && activeLayer().mask },
  "layer.maskRefineEdge": { run: async () => (await import("../../editor/selection/refineedge.js")).refineEdge({ type:"mask", layer: activeLayer() }),
                            enabled: () => doc.open && activeLayer() && activeLayer().mask },
  "layer.addAdjust": { run: async () => {
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px";
      let picked = null;
      const res = await dialog({
        title: "Nueva capa de ajuste", body: wrap,
        buttons: [{ label:"Cancelar", value:null }],
        onOpen(body, { close }){
          for(const id of adjustTypeIds()){
            const b = document.createElement("button");
            b.textContent = adjustTypeName(id);
            b.addEventListener("click", () => { picked = id; close("go"); });
            body.appendChild(b);
          }
        }
      });
      if(res !== "go" || !picked) return;
      const l = addAdjustmentLayer(picked);
      if(l) await openAdjustPanel(l);
    }, enabled: needsDoc },
  /* Sin diálogo modal ni «abrir panel» aparte: crear la capa ya la
     deja activa, y el panel de Propiedades reacciona solo a ese
     cambio (ver ui/properties.js) — la misma filosofía que ya tienen
     las capas de ajuste desde el panel en vivo, sin el paso extra del
     diálogo que sólo usa la vía de menú clásica. */
  "layer.addFillColor":    { run: () => addFillLayer("color"),    enabled: needsDoc },
  "layer.addFillGradient": { run: () => addFillLayer("gradient"), enabled: needsDoc },
  "layer.addFillPattern":  { run: async () => {
      const img = await pickPatternImage();
      if(!img) return;
      addFillLayer("pattern", img);
    }, enabled: needsDoc },
  "layer.rasterizeFillShape": { run: () => rasterizeLayer(activeLayer()),
    enabled: () => canRasterize(activeLayer()) },
  /* Deja `blendIf` en sus valores por defecto —sin ningún efecto
     todavía, ver blendif.js— sólo para que aparezca la sección
     «Fusionar si» en el panel de Propiedades; el propio panel es
     quien de verdad arma los deslizadores. Repetir el comando con la
     sección ya abierta no hace nada raro: sigue habiendo lo mismo
     que editar. */
  "layer.blendIf": { run: () => {
      const l = activeLayer();
      if(l && !l.blendIf){ l.blendIf = blendIfDefault(); emit("doc:structure"); }
    }, enabled: () => blendIfEligible(activeLayer()) },
  "layer.editAdjust": { run: () => { const l = activeLayer(); if(isAdjustLayer(l)) openAdjustPanel(l); },
                        enabled: () => isAdjustLayer(activeLayer()) },
  "text.removePath": { run: () => {
      const l = activeLayer();
      if(!isText(l) || !l.text.path) return;
      const before = l.text.path;
      updateText(l, { path: null });
      record("Quitar trazado de texto",
        () => updateText(l, { path: before }),
        () => updateText(l, { path: null }));
    }, enabled: () => isText(activeLayer()) && !!activeLayer().text.path },
  "text.saveCharStyle": { run: async () => {
      const l = activeLayer();
      if(!isText(l)) return;
      const name = await promptDlg("Guardar estilo de carácter", "Nombre", toolState.charStyle || "");
      if(!name || !name.trim()) return;
      saveCharStyle(name.trim(), l.text);
      toolState.charStyle = name.trim();
      emit("tool:options");
      toast(`Estilo de carácter «${name.trim()}» guardado`, "ok");
    }, enabled: () => isText(activeLayer()) },
  "text.saveParaStyle": { run: async () => {
      const l = activeLayer();
      if(!isText(l)) return;
      const name = await promptDlg("Guardar estilo de párrafo", "Nombre", toolState.paraStyle || "");
      if(!name || !name.trim()) return;
      saveParaStyle(name.trim(), l.text);
      toolState.paraStyle = name.trim();
      emit("tool:options");
      toast(`Estilo de párrafo «${name.trim()}» guardado`, "ok");
    }, enabled: () => isText(activeLayer()) }
});
