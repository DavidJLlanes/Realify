/* ═══════════════════════════════════════════════════════════════
   ARRANQUE
   Aquí se registran los comandos y se cablean los gestos del lienzo.
   Todo lo demás vive en su módulo y se comunica por el bus.
   ═══════════════════════════════════════════════════════════════ */

import { installColorSpace } from "./core/colorspace.js";
import { initLandscapeNotice } from "./ui/landscape.js";
import { installKeyboardFit } from "./ui/keyboard.js";
import { on, emit } from "./core/bus.js";
import { doc, newDoc, addLayer, duplicateLayer, removeLayer,
         mergeDown, activeLayer } from "./core/doc.js";
import { undo, redo, canUndo, canRedo, clear as clearHistory,
         historyLevels, setHistoryLevels, list as historyList, record, recordLayers } from "./core/history.js";
import { takeSnapshot, clearSnapshots } from "./core/snapshots.js";
import { view, fit, zoomIn, zoomOut, zoom100, apply as applyView, toImage,
         handlePointerDown, handlePointerMove, handlePointerUp,
         handleDoubleTap, edgeAutoScroll, panBy } from "./editor/view.js";
import { compose, scheduleCompose } from "./editor/compositor.js";
import { TOOLS, setTool, current, state as toolState,
         applyCrop, setCursorPos, reflowCrop,
         applyPerspective, resetPerspective, clearPerspGuides,
         fillPerspFrame, resetLiquify, centerCompare,
         centerActiveLayerContent, setActiveColorSlot,
         resetColors, swapColors,
         applyTransform, resetTransform, flipTransform,
         addDodgeBurnLayer, cancelPendingTool } from "./editor/tools.js";
import { xformCanStart } from "./editor/transformtool.js";
import { rotateLeft, rotateRight, rotate180, flipH, flipV,
         resizeDialog, canvasSizeDialog, contentAwareScaleDialog, flattenImage, mergeVisible } from "./editor/imageops.js";
import { selectAll, selectNone, invertSelection, featherSelection,
         hasSelection } from "./editor/selection.js";
import { addMask, removeMask, toggleMask, invertMaskLayer,
         setMaskTarget, getMaskTarget } from "./editor/masks.js";
import { maskLevels, maskCurves, maskBlur, maskProperties } from "./editor/maskadjust.js";
import { addAdjustmentLayer, openAdjustPanel, isAdjustLayer,
         adjustTypeIds, adjustTypeName } from "./editor/adjustlayers.js";
import { addFillLayer, pickPatternImage, canRasterize, rasterizeLayer } from "./editor/layercontent.js";
import { blendIfEligible, blendIfDefault } from "./editor/blendif.js";
import { initRulers, guidesVisible, setGuidesVisible,
         rulersVisible, setRulersVisible, clearGuides,
         gridVisible, setGridVisible, snapToGridEnabled, setSnapToGrid,
         gridConfig, setGridConfig } from "./editor/rulers.js";
import "./editor/selection-overlay.js";
import "./core/viewport-lock.js";
import { initColorSwatch } from "./ui/colorswatch.js";
import { registerAll, bind, run } from "./ui/commands.js";
import { initMenu } from "./ui/menu.js";
import { initPanels, toggleSheet, renderLayers, renderHistory,
         renderInfo, isMobile, getSelectedLayerIds } from "./ui/panels.js";
import { alignLayers, distributeLayers } from "./editor/align.js";
import { runContentAwareFill } from "./editor/fillcontent.js";
import { renderOptions } from "./ui/optionsbar.js";
import { initOpen, promptOpen, promptCamera, promptLoadStack, promptPasteImage, revertToOriginal, promptStartBatch, pickNow } from "./io/open.js";
import { exportDialog, quickPng } from "./io/export.js?v=82";
import { initProjects, saveProject, promptOpenProject, openRecentProject } from "./io/project.js";
import { dialog, confirmDlg, anyDialogOpen, promptDlg } from "./ui/dialog.js";
import { toast, status } from "./ui/toast.js";
import { isText, createTextLayer, rasterizeText, updateText } from "./editor/text.js";
import { saveCharStyle, saveParaStyle } from "./editor/textstyles.js";
import { copyToClipboard, cutToClipboard, pasteFromClipboard, hasClip,
         deleteSelection } from "./editor/clipboard.js";
import { startEdit, endEdit, isEditing } from "./editor/textedit.js";
import { initPWA, promptInstall, resumeAfterUpdate } from "./pwa.js";
import { initMobileBar } from "./ui/mobilebar.js";
import { initToolDrawer } from "./ui/tooldrawer.js";
import { haptic } from "./core/device.js";
import { maybeShowOnboarding } from "./ui/onboarding.js";
import { initDocbar } from "./ui/docbar.js";
import { openAsNewTab, closeActiveTab, closeAllTabs } from "./core/documents.js";
import { groupLayers, ungroupLayers, removeGroupAndContents, duplicateGroup,
         moveLayerOrGroup } from "./editor/groups.js";
import { openLayerStyles } from "./editor/layerstyles.js";
import { convertToSmart, rasterizeSmart, canConvertToSmart } from "./editor/smartobject.js";
import { penFinishOpen, penToSelection, penToMask, penUndoPoint, penHasPath } from "./editor/pentool.js";

// Espacio de color del documento (P3 en fotos de gama amplia): antes de
// que se cree ningún lienzo de documento. Ver core/colorspace.js.
installColorSpace();

const stage = document.getElementById("stage");
const empty = document.getElementById("empty");
const panels = document.getElementById("panels");

/* ═══ comandos ═══ */
const needsDoc = () => doc.open;
/* La capa cuya máscara está en edición ahora mismo, o null: el mismo
   "¿a qué tiene el foco puesto el usuario?" que decide si Ctrl+I,
   Ctrl+L o Ctrl+M actúan sobre la máscara o sobre la capa, igual que
   en Photoshop. */
const maskInFocus = () => {
  const l = activeLayer();
  return (l && l.mask && getMaskTarget() === l.id) ? l : null;
};
/* Alinear una sola capa es "contra el lienzo", así que basta con la
   activa aunque no haya marcado nada a propósito; con dos o más
   marcadas, es "unas contra otras". */
const selOrActive = () => getSelectedLayerIds().length >= 2 ? getSelectedLayerIds()
                          : doc.activeId !== null ? [doc.activeId] : [];
const needsSelOrActive = () => doc.open && selOrActive().length >= 1;
const photoTool = name => async () => (await import("./features/photo-tools.js"))[name]();

registerAll({
  "file.open":      () => promptOpen(),
  "file.openFiles": () => import("./io/open.js").then(m => m.promptOpenFiles()),
  "file.camera":    () => promptCamera(),
  "file.openStack": () => promptLoadStack(),
  "file.pasteImage": () => promptPasteImage(),
  "file.openProject": () => promptOpenProject(),
  "file.openRecent": () => openRecentProject(),
  "file.saveProject": { run: saveProject, enabled: needsDoc },
  "file.new":       () => newDialog(),
  "file.export":    { run: exportDialog, enabled: needsDoc },
  "file.exportAs":  { run: async () => (await import("./io/professional-export.js")).professionalExport(), enabled: needsDoc },
  "file.exportPng": { run: quickPng, enabled: needsDoc },
  "file.socialPreview": { run: photoTool("socialPreview"), enabled: needsDoc },
  /* Misma edición en varias fotos (lote/) */
  "file.batchEdit":  { run: async () => (await import("../lote/index.js")).openBatchEdit(), enabled: needsDoc },
  "file.startBatch": () => promptStartBatch(),
  "ai.tapSelect":   { run: async () => (await import("./features/samtools.js")).openSamTool("select"), enabled: needsDoc },
  "ai.magicErase":  { run: async () => (await import("./features/samtools.js")).openSamTool("erase"), enabled: needsDoc },
  "ai.faceBlur":    { run: async () => (await import("./features/facetools.js")).openFaceBlur(), enabled: needsDoc },
  "ai.faceRetouch": { run: async () => (await import("./features/facetools.js")).openFaceRetouch(), enabled: needsDoc },
  "ai.lowLight":    { run: async () => (await import("./ai/zerodce.js")).aiLowLight(), enabled: needsDoc },
  "ai.faceRestore": { run: async () => (await import("./features/facetools.js")).openFaceRestore(), enabled: needsDoc },
  "ai.redEye":      { run: async () => (await import("./features/facetools.js")).fixRedEyes(), enabled: needsDoc },
  "ai.smartCrop":   { run: async () => (await import("./features/smartcrop.js")).openSmartCrop(), enabled: needsDoc },
  "ai.faceCrop":    { run: async () => (await import("./features/facetools.js")).faceCrop(), enabled: needsDoc },
  "ai.depthBlur":   { run: async () => (await import("./features/depthtools.js")).openDepthBlur(), enabled: needsDoc },
  "ai.depthFog":    { run: async () => (await import("./features/depthtools.js")).openDepthFog(), enabled: needsDoc },
  "ai.photo3d":     { run: async () => (await import("./features/depthtools.js")).openPhoto3D(), enabled: needsDoc },
  "ai.upscale":     { run: async () => (await import("./features/aitools.js")).aiUpscale(), enabled: needsDoc },
  "ai.colorize":    { run: async () => (await import("./features/aitools.js")).aiColorize(), enabled: needsDoc },
  "ai.expand":      { run: async () => (await import("./features/aitools.js")).aiExpand(), enabled: needsDoc },
  "actions.open":   { run: async () => (await import("./features/actions.js")).openActions() },
  "file.exportGif":  { run: async () => (await import("./io/gifexport.js")).exportGif(), enabled: needsDoc },
  "file.contactSheet": { run: async () => (await import("../hojacontactos/index.js")).openContacts() },
  "image.beforeAfter": { run: async () => (await import("../comparar/index.js")).openCompare(), enabled: needsDoc },
  "an.palette":     { run: async () => (await import("./features/palette.js")).colorPalette(), enabled: needsDoc },
  "an.eyedropper":  { run: async () => (await import("./features/palette.js")).screenEyedropper() },
  "file.revert":    { run: revertToOriginal, enabled: () => doc.open && !!doc.source?.file },
  /* Cierra la pestaña activa (core/documents.js): activa la vecina si
     queda alguna, o vuelve al estado «sin documento» si era la
     última — lo mismo que hacía este comando antes de que existieran
     las pestañas, ahora con el resto de la sesión intacto. */
  "file.close":     { run: closeActiveTab, enabled: needsDoc },
  "file.closeAll":  { run: () => closeAllTabs(), enabled: needsDoc },

  "edit.undo": { run: () => { if(!undo()) toast("Nada que deshacer"); }, enabled: canUndo },
  "edit.redo": { run: () => { if(!redo()) toast("Nada que rehacer"); }, enabled: canRedo },
  "edit.levels": { run: async () => {
    const h = historyList();
    const mb = (h.bytes / 1048576).toFixed(0);
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <p class="hint" style="margin:0 0 10px">Cuántos pasos se pueden recorrer hacia
        atrás <b>y hacia delante</b>. El mismo número para deshacer y para rehacer:
        todo lo que se deshace se puede volver a hacer.</p>
      <div class="field"><label>Pasos</label>
        <input type="range" id="hlR" class="grow" min="5" max="200" step="5" value="${historyLevels()}">
        <span class="unit mono" id="hlV" style="min-width:34px;text-align:right">${historyLevels()}</span></div>
      <p class="hint" style="margin:10px 0 0">Cada paso que toca píxeles guarda dos
        copias de la capa, la de antes y la de después, así que subir esto cuesta
        memoria en imágenes grandes. Ahora mismo el historial ocupa
        <b>${mb} MB</b>; si se pasa del techo, los pasos más lejanos se van soltando
        solos y dejan de poder recorrerse.</p>`;
    const r = wrap.querySelector("#hlR"), v = wrap.querySelector("#hlV");
    r.addEventListener("input", () => { v.textContent = r.value; });
    const res = await dialog({
      title: "Niveles de historial", body: wrap,
      buttons: [{ label:"Cancelar", value:null },
                { label:"Aceptar", primary:true, value:"go" }]
    });
    if(res !== "go") return;
    const n = setHistoryLevels(+r.value);
    renderHistory();
    toast(`${n} pasos de deshacer y rehacer`, "ok");
  }},
  "edit.clearHistory": { run: () => { clearHistory(); toast("Historial vaciado"); }, enabled: needsDoc },

  "edit.copy":  { run: copyToClipboard,  enabled: needsDoc },
  "edit.cut":   { run: cutToClipboard,   enabled: () => doc.open && !(activeLayer() || {}).locked },
  "edit.paste": { run: pasteFromClipboard, enabled: () => doc.open && hasClip() },
  /* Suprimir. Pide selección a propósito: sin ella, la tecla vaciaría
     la capa entera de un toque accidental, y para eso ya está el
     comando de borrar capa, que se pulsa aposta. */
  "edit.clear": { run: deleteSelection,
                  enabled: () => doc.open && !!doc.selection &&
                    !!activeLayer() && !activeLayer().locked },

  "image.resize": { run: resizeDialog, enabled: needsDoc },
  "image.canvasSize": { run: canvasSizeDialog, enabled: needsDoc },
  "image.contentAwareScale": { run: contentAwareScaleDialog, enabled: needsDoc },
  "image.crop":   { run: () => setTool("crop"), enabled: needsDoc },
  "image.rotL":   { run: rotateLeft,  enabled: needsDoc },
  "image.rotR":   { run: rotateRight, enabled: needsDoc },
  "image.autoStraighten": { run: async () => (await import("./features/autostraighten.js")).autoStraighten(), enabled: needsDoc },
  "image.rot180": { run: rotate180,   enabled: needsDoc },
  /* Cortar en partes (cortar/): sin documento, pide una foto */
  // Sin documento, la foto se pide en el mismo toque (ver pickNow).
  "image.slice":     { run: () => doc.open ? import("../cortar/index.js").then(m => m.openCut())
                                           : pickNow({}, ([f]) => import("../cortar/index.js").then(m => m.openCut(f))) },
  /* Recortar en forma (formas/): sin documento, pide una foto */
  "image.shapeCrop": { run: () => doc.open ? import("../formas/index.js").then(m => m.openShapes())
                                           : pickNow({}, ([f]) => import("../formas/index.js").then(m => m.openShapes(f))) },
  /* Plugins a pantalla completa (carpetas hdr/, …): no necesitan documento */
  "image.hdr":       { run: async () => (await import("../hdr/index.js")).openHdr() },
  "image.merge":     { run: async () => (await import("../unir/index.js")).openMerge() },
  "image.flipH":  { run: flipH,       enabled: needsDoc },
  "image.flipV":  { run: flipV,       enabled: needsDoc },
  "image.removeBackground": { run: photoTool("removeBackground"), enabled: needsDoc },

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
                         // requirePaintable() en editor/tools.js—.
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
                         if(top && (top.clipped || top.styles || top.blendIf || top.filters?.length)){
                           toast(`«${top.name}» tiene recorte, estilos, filtros o Fusionar si; aplícalos antes de combinar.`, "err");
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
                         const pixBefore = copyOf(below.canvas);
                         const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
                         if(!mergeDown()){ toast("No hay capa debajo"); return; }
                         const pixAfter = copyOf(below.canvas);
                         const nextLayers = doc.layers.slice(), nextActive = doc.activeId;
                         const put = (pix, layers, active) => {
                           const x = below.ctx;
                           x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
                           x.globalCompositeOperation = "copy";
                           x.drawImage(pix, 0, 0); x.restore();
                           below.thumbDirty = true;
                           doc.layers = layers.slice(); doc.activeId = active;
                           emit("doc:structure"); emit("doc:change");
                         };
                         record("Combinar hacia abajo",
                           () => put(pixBefore, prevLayers, prevActive),
                           () => put(pixAfter, nextLayers, nextActive));
                       },
                       enabled: () => { const l = activeLayer(); return needsDoc() && l && l.type !== "group" && l.type !== "adjust"; } },
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
  /* Creador de memes a pantalla completa (memes/). */
  "layer.meme":      { run: async () => (await import("../memes/index.js")).openMemeCreator(),
                       enabled: needsDoc },
  "layer.stickers":  { run: async () => (await import("../stickers/index.js")).openStickers(),
                       enabled: needsDoc },
  /* Collage / History / Post (socialmediapost/): no necesita documento;
     el resultado se abre en una pestaña nueva. */
  "file.socialPost": { run: async () => (await import("../socialmediapost/index.js")).openSocialPost() },

  "view.fit":     { run: fit, enabled: needsDoc },
  "view.zoom100": { run: zoom100, enabled: needsDoc },
  "view.zoomIn":  { run: zoomIn, enabled: needsDoc },
  "view.zoomOut": { run: zoomOut, enabled: needsDoc },
  "view.panels":  () => {
      if(isMobile()) toggleSheet();
      else panels.classList.toggle("collapsed");
    },
  "view.guides":  () => setGuidesVisible(!guidesVisible()),
  "view.rulers":  () => setRulersVisible(!rulersVisible()),
  "view.guidesClear": { run: clearGuides, enabled: needsDoc },
  "view.grid":       () => setGridVisible(!gridVisible()),
  "view.gridSnap":   () => setSnapToGrid(!snapToGridEnabled()),
  /* Cuadrícula inteligente (editor/smartgrid.js): guías calculadas a
     partir del contenido (sujeto, horizonte, rostros) */
  "view.smartGrid":  { run: async () => (await import("./editor/smartgrid.js")).openSmartGrid(), enabled: needsDoc },
  "view.smartGridToggle": { run: async () => (await import("./editor/smartgrid.js")).toggleSmartGrid(), enabled: needsDoc },
  "view.gridConfig": { run: async () => {
      const cfg = gridConfig();
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="field"><label>Espaciado</label>
          <input type="range" id="gcSize" class="grow" min="4" max="500" value="${cfg.size}">
          <span class="unit mono" id="gcSizeV" style="min-width:46px;text-align:right">${cfg.size} px</span></div>
        <div class="field"><label>Subdivisiones</label>
          <input type="range" id="gcSub" class="grow" min="1" max="10" value="${cfg.sub}">
          <span class="unit mono" id="gcSubV" style="min-width:46px;text-align:right">${cfg.sub}</span></div>
        <p class="hint" style="margin-top:8px">Líneas mayores cada tantos píxeles, con líneas
          menores repartiendo cada celda entre las subdivisiones —igual que un papel
          milimetrado—. «Ajustar a la cuadrícula» (menú Ver) usa este mismo espaciado.</p>`;
      const sizeR = wrap.querySelector("#gcSize"), sizeV = wrap.querySelector("#gcSizeV");
      const subR = wrap.querySelector("#gcSub"), subV = wrap.querySelector("#gcSubV");
      sizeR.addEventListener("input", () => { sizeV.textContent = sizeR.value + " px"; });
      subR.addEventListener("input", () => { subV.textContent = subR.value; });
      const res = await dialog({
        title: "Configurar cuadrícula", body: wrap,
        buttons: [{ label:"Cancelar", value:null }, { label:"Aceptar", primary:true, value:"go" }]
      });
      if(res !== "go") return;
      setGridConfig(+sizeR.value, +subR.value);
      if(!gridVisible()) setGridVisible(true);
    } },
  "view.compare": { run: () => setTool("compare"), enabled: needsDoc },
  "view.compare100": { run: () => { setTool("compare"); zoom100(); }, enabled: needsDoc },

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

  "sel.fillContent": { run: runContentAwareFill, enabled: () => doc.open && hasSelection() },
  "sel.rangeMask": { run: async () => (await import("./editor/luminositymasks.js")).openLuminosityMaskPanel(),
                     enabled: needsDoc },
  "sel.subject": { run: async () => (await import("./features/segmentselect.js")).selectSubjectCommand(),
                   enabled: needsDoc },
  "sel.sky":     { run: async () => (await import("./features/segmentselect.js")).selectSkyCommand(),
                   enabled: needsDoc },
  "sky.replace": { run: async () => (await import("./features/sky.js")).replaceSky(),
                   enabled: needsDoc },
  "liquify.reset": { run: resetLiquify, enabled: () => doc.open && current.id === "liquify" },
  "compare.center": { run: centerCompare, enabled: () => doc.open && current.id === "compare" },

  "crop.apply":  { run: applyCrop, enabled: () => doc.open && current.id === "crop" },
  "crop.cancel": { run: cancelPendingTool, enabled: () => current.id === "crop" },
  "clone.reset": { run: async () => (await import("./editor/tools.js")).resetClone(),
                   enabled: () => current.id === "clone" },
  "clone.pickSource": { run: async () => (await import("./editor/tools.js")).pickCloneSource(),
                   enabled: () => current.id === "clone" },
  "perspective.apply": { run: applyPerspective, enabled: () => doc.open && current.id === "perspective" },
  "perspective.reset": { run: resetPerspective, enabled: () => current.id === "perspective" },
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
        const [w, h] = toolState.cropRatio.split(":").map(Number);
        toolState.cropW = w; toolState.cropH = h;
        toolState.cropRatio = "custom";
      }
      const w = toolState.cropW; toolState.cropW = toolState.cropH; toolState.cropH = w;
      emit("tool:options");
      reflowCrop();
    }, enabled: () => current.id === "crop" },

  "sel.all":    { run: selectAll, enabled: needsDoc },
  "sel.none":   { run: () => { if(!hasSelection()) return; selectNone(); },
                  enabled: () => doc.open && hasSelection() },
  "sel.invert": { run: invertSelection, enabled: needsDoc },
  "sel.feather": { run: async () => {
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="field"><label>Radio</label>
          <input type="range" id="sfR" class="grow" min="1" max="200" value="12">
          <span class="unit mono" id="sfV" style="min-width:40px;text-align:right">12 px</span></div>
        <p class="hint" style="margin-top:8px">Suaviza el borde de la selección actual. Sin
          selección activa no hay nada que difuminar: el efecto se nota al usarla después,
          en un ajuste o un relleno.</p>`;
      const r = wrap.querySelector("#sfR"), v = wrap.querySelector("#sfV");
      r.addEventListener("input", () => { v.textContent = r.value + " px"; });
      const res = await dialog({
        title: "Difuminar selección", body: wrap,
        buttons: [{ label:"Cancelar", value:null }, { label:"Aplicar", primary:true, value:"go" }]
      });
      if(res !== "go") return;
      featherSelection(+r.value);
    }, enabled: () => doc.open && hasSelection() },

  "layer.maskFromSel": { run: () => { addMask(activeLayer(), true); setMaskTarget(doc.activeId); },
                          enabled: () => doc.open && activeLayer() && !activeLayer().mask && hasSelection() },
  "layer.maskFromSelInvert": { run: () => { addMask(activeLayer(), true, true); setMaskTarget(doc.activeId); },
                          enabled: () => doc.open && activeLayer() && !activeLayer().mask && hasSelection() },
  "layer.maskReveal":  { run: () => { addMask(activeLayer(), false); setMaskTarget(doc.activeId); },
                          enabled: () => doc.open && activeLayer() && !activeLayer().mask },
  "layer.maskHide":    { run: () => { addMask(activeLayer(), false, true); setMaskTarget(doc.activeId); },
                          enabled: () => doc.open && activeLayer() && !activeLayer().mask },
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
  "layer.maskRefineEdge": { run: async () => (await import("./editor/refineedge.js")).refineEdge({ type:"mask", layer: activeLayer() }),
                            enabled: () => doc.open && activeLayer() && activeLayer().mask },
  "sel.refineEdge": { run: async () => (await import("./editor/refineedge.js")).refineEdge({ type:"selection" }),
                      enabled: () => doc.open && hasSelection() },
  "sel.contentAwareMove": { run: () => setTool("camove"), enabled: () => doc.open && hasSelection() },

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
    }, enabled: () => isText(activeLayer()) },

  "help.install": () => promptInstall(),

  "help.about": () => dialog({
    title: "Acerca de Realify",
    body: `<p class="hint">Editor de imagen con simulación de captura fotográfica.</p>
           <p class="hint">Todo el procesado ocurre en tu equipo: tus imágenes no se
             suben a ningún servidor, no hay analítica y no hace falta cuenta. Sólo
             los modelos de IA grandes se descargan de un tercero (Hugging Face), y
             sólo si los usas; las tipografías se sirven desde el propio sitio. Los
             detalles están en la Política de privacidad.</p>
           <p class="hint">El filtro Realify reproduce el recorrido físico de la luz
             —óptica, sensor, procesador y códec— sobre imágenes generadas, para
             investigación sobre detectores, trabajo artístico y prueba de defensas
             propias.</p>`,
    buttons:[{ label:"Cerrar", primary:true }]
  }),

  /* Estos llegan con los módulos que faltan por migrar. Se declaran
     ya para que los menús no queden con huecos ni comandos rotos. */
  "filter.camera":  { run: async () => {
      const m = await import("./filters/camera/ui.js");
      await m.openCamera();
    }, enabled: needsDoc },
  "filter.cameraPremium": { run: async () => (await import("./filters/camera/ui.js")).openCamera({ premium: true }), enabled: needsDoc },
  "filter.photoDevelop": { run: async () => (await import("../raw/index.js")).openPhotoDevelop(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked && activeLayer().type !== "adjust" },
  "filter.vintage": { run: async () => (await import("../vintagefilter/index.js")).openVintageFilter(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked && activeLayer().type !== "adjust" },
  /* Sin `!anyDialogOpen()` en la condición, a propósito: en móvil los
     filtros se eligen desde una rejilla que ES un diálogo, así que esa
     comprobación dejaba el botón permanentemente gris ahí dentro —el
     único filtro que no se podía abrir en un teléfono—. La reentrada
     de verdad ya la corta `openPurePixel()` en su primera línea, que
     es donde corresponde. */
  "filter.purepixel": { run: async () => (await import("./filters/purepixel/ui.js")).openPurePixel(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked &&
      activeLayer().type === "raster" },
  "filter.lens":    { run: async () => (await import("./filters/lens/ui.js")).openLens(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked &&
      activeLayer().type !== "adjust" },
  "filter.unmark":  { run: async () => (await import("./filters/unmark/ui.js")).openUnmark(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked &&
      activeLayer().type !== "adjust" },
  "filter.blur":    { run: async () => (await import("./filters/basic.js")).blur(),
                      enabled: needsDoc },
  "filter.sharpen": { run: async () => (await import("./filters/basic.js")).sharpen(),
                      enabled: needsDoc },
  "filter.denoise": { run: photoTool("reduceNoise"), enabled: needsDoc },
  "filter.aiDenoise": { run: photoTool("aiDenoise"), enabled: needsDoc },
  "filter.aiDejpeg":  { run: photoTool("aiDejpeg"),  enabled: needsDoc },
  "filter.lensCorrection": { run: photoTool("lensCorrection"), enabled: needsDoc },
  "filter.selectiveSharpen": { run: photoTool("selectiveSharpen"), enabled: needsDoc },
  "filter.portrait": { run: photoTool("portraitRetouch"), enabled: needsDoc },
  "filter.freqsep": { run: async () => (await import("./filters/freqsep.js")).openFreqSep(), enabled: needsDoc },
  "dodgeburn.start":    { run: () => setTool("dodgeburn"), enabled: needsDoc },
  "brush.settings":     { run: async () => (await import("./editor/brushes.js")).openBrushPanel(), enabled: needsDoc },
  "dodgeburn.newLayer": { run: () => { addDodgeBurnLayer(); setTool("dodgeburn"); }, enabled: needsDoc },
  /* Dodge & Burn con la capa gris a la vista, en tiempo real */
  "dodgeburn.viewGray": { run: async () => {
      setTool("dodgeburn");
      const t = await import("./editor/tools.js");
      t.state.dbShowGray = !t.state.dbShowGray;
      emit("tool:options"); emit("tool:paramchange", "dbShowGray");
      toast(t.state.dbShowGray ? "Viendo la capa gris al 50 % en tiempo real" : "Vista normal");
    }, enabled: needsDoc },
  /* Pinceles especiales: activan el Pincel con el modo ya puesto (los
     ajustes siguen en su barra de opciones y en «Pinceles…"). */
  "brush.symmetric": { run: async () => {
      setTool("brush");
      const t = await import("./editor/tools.js");
      if(t.state.brushSymmetry === "none") t.setBrushMode("brushSymmetry", "horizontal");
      emit("tool:options"); toast("Pincel simétrico: elige el eje en la barra de opciones");
    }, enabled: needsDoc },
  "brush.textured": { run: async () => {
      setTool("brush");
      const t = await import("./editor/tools.js");
      if(t.state.brushTexture === "none") t.setBrushMode("brushTexture", "grain");
      emit("tool:options"); toast("Pincel con textura: grano, papel, lienzo, cristales, rayones…");
    }, enabled: needsDoc },
  "brush.gradient": { run: async () => {
      setTool("brush");
      const t = await import("./editor/tools.js");
      if(t.state.brushColorMode === "solid") t.setBrushMode("brushColorMode", "gradient");
      emit("tool:options"); toast("Pincel de degradado: del color frontal al de fondo a lo largo del trazo");
    }, enabled: needsDoc },
  "snapshot.add": { run: async () => {
      const name = await promptDlg("Nueva instantánea", "Nombre", "");
      if(name !== null) takeSnapshot(name);
    }, enabled: needsDoc },
  "historyBrush.start": { run: () => setTool("historyBrush"), enabled: needsDoc },
  "filter.motionBlur": { run: async () => (await import("./filters/basic.js")).motionBlur(),
                      enabled: needsDoc },
  "filter.lensBlur": { run: async () => (await import("./filters/advanced.js")).lensBlur(), enabled: needsDoc },
  "filter.radialBlur": { run: async () => (await import("./filters/advanced.js")).radialBlur(), enabled: needsDoc },
  "filter.surfaceBlur": { run: async () => (await import("./filters/advanced.js")).surfaceBlur(), enabled: needsDoc },
  "filter.highPass": { run: async () => (await import("./filters/advanced.js")).highPass(), enabled: needsDoc },
  "filter.channelDenoise": { run: async () => (await import("./filters/advanced.js")).channelDenoise(), enabled: needsDoc },
  "filter.smartSharpen": { run: async () => (await import("./filters/advanced.js")).smartSharpen(), enabled: needsDoc },
  "filter.distort": { run: async () => (await import("./filters/advanced.js")).distort(), enabled: needsDoc },
  "filter.stylize": { run: async () => (await import("./filters/advanced.js")).stylize(), enabled: needsDoc },
  "filter.pixelate": { run: async () => (await import("./filters/effects.js")).pixelate(), enabled: needsDoc },
  "filter.stylizeEffects": { run: async () => (await import("./filters/effects.js")).stylizeEffects(), enabled: needsDoc },
  "filter.artisticGallery": { run: async () => (await import("./filters/effects.js")).artisticGallery(), enabled: needsDoc },
  "filter.renderEffects": { run: async () => (await import("./filters/effects.js")).renderEffects(), enabled: needsDoc },
  "filter.textureEffects": { run: async () => (await import("./filters/effects.js")).textureEffects(), enabled: needsDoc },
  "filter.customConvolution": { run: async () => (await import("./filters/effects.js")).customConvolution(), enabled: needsDoc },
  "filter.offsetMorphology": { run: async () => (await import("./filters/effects.js")).offsetMorphology(), enabled: needsDoc },
  "filter.blurGallery": { run: async () => (await import("./filters/classic.js")).blurGallery(), enabled: needsDoc },
  "filter.utilityBlur": { run: async () => (await import("./filters/classic.js")).utilityBlur(), enabled: needsDoc },
  "filter.restoration": { run: async () => (await import("./filters/classic.js")).restoration(), enabled: needsDoc },
  "filter.advancedSharpen": { run: async () => (await import("./filters/classic.js")).advancedSharpen(), enabled: needsDoc },
  "filter.classicDistort": { run: async () => (await import("./filters/classic.js")).classicDistort(), enabled: needsDoc },
  "filter.adaptiveWideAngle": { run: async () => (await import("./filters/classic.js")).adaptiveWideAngle(), enabled: needsDoc },
  "filter.puppetWarp": { run: async () => (await import("./filters/classic.js")).puppetWarp(), enabled: needsDoc },
  "filter.noise":   { run: async () => (await import("./filters/basic.js")).noise(),
                      enabled: needsDoc },
  "adj.brightness": { run: async () => (await import("./editor/adjustments.js")).brightnessContrast(),
                      enabled: needsDoc },
  "adj.levels":     { run: async () => {
      // Ídem: con la máscara en edición, Niveles ajusta su gama de
      // grises; si no, los de la capa, como ha hecho siempre.
      const l = maskInFocus();
      if(l){ maskLevels(l); return; }
      (await import("./editor/adjustments.js")).levels();
    }, enabled: needsDoc },
  "adj.curves":     { run: async () => {
      const l = maskInFocus();
      if(l){ maskCurves(l); return; }
      (await import("./editor/adjustments.js")).curves();
    }, enabled: needsDoc },
  "adj.hsl":        { run: async () => (await import("./editor/adjustments.js")).hueSaturation(),
                      enabled: needsDoc },
  "adj.grayscale":  { run: async () => (await import("./editor/adjustments.js")).grayscale(),
                      enabled: needsDoc },
  "adj.invert":     { run: async () => {
      // Igual que en Photoshop: Ctrl+I invierte lo que tenga el foco
      // puesto. Con la máscara en edición, invierte la máscara; si
      // no, los colores de la capa, como ha hecho siempre.
      const l = maskInFocus();
      if(l){ invertMaskLayer(l); return; }
      (await import("./editor/adjustments.js")).invert();
    }, enabled: needsDoc },
  "adj.auto":       { run: async () => (await import("./editor/adjustments.js")).autoContrast(),
                      enabled: needsDoc },
  "adj.autoPremium": { run: async () => (await import("./editor/adjustments.js")).autoContrastPremium(),
                      enabled: needsDoc },
  "adj.autoLevels": { run: async () => (await import("./editor/adjustments.js")).autoLevels(),
                      enabled: needsDoc },
  "adj.autoLevelsPremium": { run: async () => (await import("./editor/adjustments.js")).autoLevelsPremium(),
                      enabled: needsDoc },
  "adj.autoEnhance": { run: async () => (await import("./editor/autoenhance.js")).autoEnhance(),
                      enabled: needsDoc },
  "adj.autoEnhancePremium": { run: async () => (await import("./editor/autoenhance.js")).autoEnhancePremium(),
                      enabled: needsDoc },
  "adj.whiteBalance": { run: async () => (await import("./editor/adjustments.js")).whiteBalance(),
                      enabled: needsDoc },
  "adj.tone":       { run: async () => (await import("./editor/tone.js")).toneRegions(),
                      enabled: needsDoc },
  "adj.colorBands":  { run: async () => (await import("./editor/colorbands.js")).colorBands(),
                      enabled: needsDoc },
  "adj.exposure":   { run: async () => (await import("./editor/exposure.js")).exposure(),
                      enabled: needsDoc },
  "adj.vibrance":   { run: async () => (await import("./editor/vibrance.js")).vibrance(),
                      enabled: needsDoc },
  "adj.shadowsHighlights": { run: async () => (await import("./editor/shadowshighlights.js")).shadowsHighlights(),
                      enabled: needsDoc },
  "adj.colorBalance": { run: async () => (await import("./editor/colorbalance.js")).colorBalance(),
                      enabled: needsDoc },
  "adj.channelMixer": { run: async () => (await import("./editor/channelmixer.js")).channelMixer(),
                      enabled: needsDoc },
  "adj.selectiveColor": { run: async () => (await import("./editor/selectivecolor.js")).selectiveColor(),
                      enabled: needsDoc },
  "adj.gradientMap": { run: async () => (await import("./editor/gradientmap.js")).gradientMap(),
                      enabled: needsDoc },
  "adj.colorGrading": { run: async () => (await import("./editor/advanced-color.js")).colorGrading(), enabled: needsDoc },
  "adj.splitToning": { run: async () => (await import("./editor/advanced-color.js")).splitToning(), enabled: needsDoc },
  "adj.photoFilter": { run: async () => (await import("./editor/advanced-color.js")).photoFilter(), enabled: needsDoc },
  "adj.dehaze": { run: async () => (await import("./editor/advanced-color.js")).dehaze(), enabled: needsDoc },
  "adj.labCurves": { run: async () => (await import("./editor/advanced-color.js")).labCurves(), enabled: needsDoc },
  /* Tonos del histograma: sólo una franja de luminancia. Desde el panel
     Histograma llega con la zona pulsada ({ center, width }). */
  "adj.toneBand": { run: async arg => (await import("./editor/toneband.js")).toneBand(
      arg && typeof arg === "object" && Number.isFinite(arg.center) ? { init: arg } : {}), enabled: needsDoc },
  "view.histogram": { run: async () => (await import("./ui/histogrampanel.js")).showHistogramPanel() },
  "adj.rangeHsl": { run: async () => (await import("./editor/advanced-color.js")).rangeHsl(), enabled: needsDoc },
  "adj.replaceColor": { run: async () => (await import("./editor/advanced-color.js")).replaceColor(), enabled: needsDoc },
  "adj.matchColor": { run: async () => (await import("./editor/advanced-color.js")).matchColor(), enabled: needsDoc },
  "adj.threshold": { run: async () => (await import("./editor/advanced-color.js")).threshold(), enabled: needsDoc },
  "adj.posterize": { run: async () => (await import("./editor/advanced-color.js")).posterize(), enabled: needsDoc },
  "adj.equalize": { run: async () => (await import("./editor/advanced-color.js")).equalize(), enabled: needsDoc },
  "adj.desaturate": { run: async () => (await import("./editor/advanced-color.js")).desaturate(), enabled: needsDoc },
  "adj.autoToneColor": { run: async () => (await import("./editor/advanced-color.js")).autoToneColor(), enabled: needsDoc },
  "adj.autoToneColorPremium": { run: async () => (await import("./editor/advanced-color.js")).autoToneColorPremium(), enabled: needsDoc },
  "adj.lowLight":        { run: async () => (await import("./editor/lowlight.js")).lowLight(), enabled: needsDoc },
  "adj.lowLightPremium": { run: async () => (await import("./editor/lowlight.js")).lowLightPremium(), enabled: needsDoc },
  "adj.hdrTone": { run: async () => (await import("./editor/advanced-color.js")).hdrTone(), enabled: needsDoc },
  "adj.tonalContrast": { run: async () => (await import("./editor/advanced-color.js")).tonalContrast(), enabled: needsDoc },
  "adj.graduatedFilter": { run: async () => (await import("./editor/advanced-color.js")).graduatedFilter(), enabled: needsDoc },
  "filter.vignette": { run: async () => (await import("./filters/basic.js")).vignette(),
                      enabled: needsDoc },
  "filter.clarity":  { run: async () => (await import("./filters/basic.js")).clarity(),
                      enabled: needsDoc },
  "filter.spot":     { run: () => setTool("heal"), enabled: needsDoc },
  "filter.patch":    { run: () => setTool("clone"), enabled: needsDoc },
  "filter.liquify":  { run: () => setTool("liquify"), enabled: needsDoc },
  "filter.looks":    { run: async () => (await import("./filters/looks.js")).openLooks(),
                      enabled: needsDoc },
  "filter.lut":      { run: async () => (await import("./filters/lut/ui.js")).openLut(),
                      enabled: needsDoc },
  "filter.perspective": { run: () => setTool("perspective"), enabled: needsDoc },
  "an.metrics":     { run: async () => (await import("./analysis/ui.js")).openMetrics(),
                      enabled: needsDoc },
  "an.forensics":   { run: async () => (await import("./analysis/ui.js")).openForensics(),
                      enabled: needsDoc },
  "an.spectrum":    { run: async () => (await import("./analysis/ui.js")).openSpectrum(),
                      enabled: needsDoc },
  "an.exif":        async () => (await import("./exif/ui.js")).openExif(),
  "an.strip":       async () => (await import("./io/stripui.js")).openStrip(),
  "help.guide":     async () => (await import("./ui/guide.js")).openGuide(),
  "help.legal":     async () => (await import("./ui/legal.js")).openLegalNotice(),
  "help.privacy":   async () => (await import("./ui/legal.js")).openPrivacyPolicy(),
  "help.cookies":   async () => (await import("./ui/legal.js")).openCookiesPolicy(),
  "help.diag":      async () => {
      const { diagnose } = await import("./filters/camera/engine.js");
      const d = diagnose();
      const compatRows = (await import("./core/compat.js")).checkCompat();
      const row = (ok, name, detail) =>
        `<div class="field"><label style="width:150px">${ok ? "✓" : "✗"} ${name}</label>
         <span class="hint" style="margin:0;color:${ok ? "var(--tx-dim)" : "var(--bad)"}">${detail}</span></div>`;
      const bad = Object.entries(d.shaders).filter(([, v]) => v !== true);
      const body = document.createElement("div");
      body.innerHTML =
          row(d.webgl2, "WebGL2", d.webgl2 ? "disponible" : (d.error || "no disponible")) +
          (d.renderer ? row(true, "GPU", d.renderer.slice(0, 70)) : "") +
          (d.webgl2 ? row(d.float, "Buffer flotante",
              d.float ? "sí, precisión completa" : "no: puede aparecer banding en sombras") : "") +
          (d.maxTexture ? row(true, "Textura máxima", d.maxTexture + " px") : "") +
          (d.webgl2 ? row(bad.length === 0, "Shaders",
              bad.length ? "fallan: " + bad.map(b => b[0]).join(", ")
                         : Object.keys(d.shaders).length + " compilan correctamente") : "") +
          row(typeof createImageBitmap === "function", "createImageBitmap",
              typeof createImageBitmap === "function" ? "sí" : "no: el análisis ELA no funcionará") +
          row((() => { try{ localStorage.setItem("__t","1"); localStorage.removeItem("__t"); return true; }catch{ return false; } })(),
              "Almacenamiento local", "para presets y ajustes") +
          row(!!navigator.gpu, "WebGPU", navigator.gpu ? "sí: la IA usa la GPU" : "no: la IA funciona en la CPU (WebAssembly), más despacio") +
          compatRows.map(p => row(false, p.title.split(" ").slice(0, 3).join(" "), p.title)).join("") +
          `<div class="field"><button type="button" class="diag-copy">Copiar diagnóstico</button><span class="hint" style="margin:0">para enviarlo si algo no funciona</span></div>` +
          `<div class="section-label" style="margin-top:12px">Modelos de IA descargados</div><div class="diag-models hint" style="margin:0">Comprobando…</div>`;
      body.querySelector(".diag-copy").addEventListener("click", e =>
        window.__realifyCopyDiag?.(window.__realifyDiag?.([
          "WebGL2: " + (d.webgl2 ? "sí" : "no") + (d.renderer ? " · " + d.renderer : ""),
          ...compatRows.map(p => "Aviso: " + p.title)]) || "", e.currentTarget));
      // Modelos guardados en este navegador: lo que ocupan y cómo borrarlos
      const listEl = body.querySelector(".diag-models");
      const fill = async () => {
        const { storedModels, forgetModel } = await import("./ai/runtime.js");
        const { mb } = await import("./ai/models.js");
        const list = await storedModels().catch(() => []);
        if(!list.length){ listEl.textContent = "Ninguno: se descargan la primera vez que se usan."; return; }
        const total = list.reduce((a, m) => a + m.size, 0);
        listEl.innerHTML = list.map((m, i) => `<div class="field"><label style="width:auto;flex:1">${m.label}${m.premium ? " 👑" : ""}</label>
          <span class="unit mono">${mb(m.size)}</span><button type="button" data-i="${i}">Borrar</button></div>`).join("") +
          `<div class="field"><label style="width:auto;flex:1"><b>Total</b></label><span class="unit mono">${mb(total)}</span>
          <button type="button" data-all="1">Borrar todos</button></div>`;
        listEl.querySelectorAll("button").forEach(b => b.addEventListener("click", async () => {
          b.disabled = true;
          await forgetModel(b.dataset.all ? undefined : list[+b.dataset.i].url);
          fill();
        }));
      };
      fill();
      dialog({ title: "Diagnóstico", wide: true, body, buttons:[{ label:"Cerrar", primary:true }] });
    }
});

async function newDialog(){
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="field"><label>Ancho</label>
      <input type="number" id="nw" class="grow" min="1" max="16384" value="1920">
      <span class="unit">px</span></div>
    <div class="field"><label>Alto</label>
      <input type="number" id="nh" class="grow" min="1" max="16384" value="1080">
      <span class="unit">px</span></div>
    <div class="field"><label>Fondo</label>
      <select id="nf" class="grow">
        <option value="#ffffff">Blanco</option>
        <option value="#000000">Negro</option>
        <option value="">Transparente</option>
      </select></div>`;
  const r = await dialog({
    title:"Documento nuevo", body: wrap,
    buttons:[{ label:"Cancelar", value:null }, { label:"Crear", primary:true, value:"go" }]
  });
  if(r !== "go") return;
  const w = Math.max(1, +wrap.querySelector("#nw").value);
  const h = Math.max(1, +wrap.querySelector("#nh").value);
  const fill = wrap.querySelector("#nf").value;
  // En una pestaña nueva, igual que abrir un archivo: nunca sustituye
  // lo que ya hubiera abierto.
  await openAsNewTab(() => {
    newDoc(w, h, { fill: fill || null, name: "Sin título" });
    clearHistory();
    clearSnapshots();
  });
}

/* ═══ atajos ═══ */
bind("mod+o", "file.open");
bind("mod+n", "file.new");
bind("mod+s", "file.saveProject");
bind("mod+alt+s", "file.export");
bind("mod+shift+s", "file.exportPng");
bind("mod+z", "edit.undo");
bind("mod+shift+z", "edit.redo");
bind("mod+y", "edit.redo");
bind("mod+c", "edit.copy");
bind("mod+x", "edit.cut");
bind("mod+v", "edit.paste");
// Las dos teclas de borrar: Supr en un teclado completo, Retroceso en
// los portátiles sin bloque numérico y en los Mac.
bind("delete", "edit.clear");
bind("backspace", "edit.clear");
bind("mod+shift+n", "layer.add");
bind("mod+j", "layer.duplicate");
bind("mod+e", "layer.mergeDown");
bind("mod+shift+e", "layer.mergeVisible");
bind("mod+g", "layer.group");
bind("mod+shift+g", "layer.ungroup");
bind("mod+0", "view.fit");
bind("mod+1", "view.zoom100");
bind("mod+shift+1", "view.compare100");
bind("mod++", "view.zoomIn");
bind("mod+-", "view.zoomOut");
bind("mod+r", "image.resize");
bind("mod+l", "adj.levels");
bind("mod+m", "adj.curves");
bind("mod+u", "adj.hsl");
bind("mod+i", "adj.invert");
bind("mod+shift+u", "adj.grayscale");
bind("tab", "view.panels");
bind("mod+a", "sel.all");
bind("mod+d", "sel.none");
bind("mod+shift+i", "sel.invert");
/* Ctrl/⌘+T abre casi siempre una pestaña del NAVEGADOR antes de que la
   página llegue a verlo, así que en la práctica el atajo fiable —y el
   que ya sigue el resto de herramientas de esta aplicación, una letra
   suelta sin modificador— es «F» (T ya era de Texto). Ver el
   manejador de teclas de herramienta, más abajo. Este bind queda para
   quien tenga la app instalada o use un navegador que sí lo deje pasar. */
bind("mod+t", "transform.start");
bind("escape", "tool.cancelPending");
// Intro, con la Pluma activa, aparca abierto el subtrazado en curso —
// no lo cierra: para eso, clic sobre su primera ancla—. En cualquier
// otro momento no hace nada (el comando se desactiva solo).
bind("enter", "pen.close");
// Intro confirma también el recorte, la Transformación libre y la
// Perspectiva, como en cualquier editor: cada comando sólo está activo
// con su herramienta, así que no se pisan entre sí ni con la Pluma.
bind("enter", "crop.apply");
bind("enter", "transform.apply");
bind("enter", "perspective.apply");
// Sin letra suelta libre (ver el comentario en tools.js): Ctrl+Mayús+D,
// como el resto de comandos con combinación en vez de tecla sola.
bind("mod+shift+d", "dodgeburn.start");
bind("mod+shift+h", "historyBrush.start");

/* Teclas de herramienta, como en cualquier editor */
addEventListener("keydown", e => {
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if(anyDialogOpen()) return;
  const t = TOOLS.find(x => x.key === e.key.toLowerCase());
  if(t){ e.preventDefault(); setTool(t.id); }
});

/* D/X del color frontal/fondo, como en Photoshop. Letra suelta, así
   que las mismas guardas que las teclas de herramienta de arriba. */
addEventListener("keydown", e => {
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if(anyDialogOpen()) return;
  if(e.key === "d"){ e.preventDefault(); resetColors(); }
  else if(e.key === "x"){ e.preventDefault(); swapColors(); }
});

/* Tamaño y dureza del pincel con [ ] y Mayús+[ Mayús+], igual que en
   Photoshop. Sólo actúan si la herramienta activa de verdad tiene esa
   opción (el Pincel, el Borrador, Clonar…), para no hacer nada raro
   con herramientas como Mover donde esas teclas no significan nada. */
addEventListener("keydown", e => {
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  if(e.key !== "[" && e.key !== "]") return;
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if(anyDialogOpen()) return;
  const dir = e.key === "]" ? 1 : -1;
  const opt = e.shiftKey
    ? current.options?.find(o => o.key === "hardness")
    : current.options?.find(o => o.key === "size");
  if(!opt) return;
  e.preventDefault();
  const step = e.shiftKey ? 10 : 2;
  const v = Math.max(opt.min, Math.min(opt.max, toolState[opt.key] + dir * step));
  toolState[opt.key] = v;
  renderOptions();
});

/* Opacidad de la herramienta con un dígito, igual que en Photoshop:
   "5" pone 50%, "0" pone 100%, y dos dígitos seguidos y rápidos
   (p.ej. "2" luego "5") forman 25. Sólo si la herramienta activa
   tiene opacidad entre sus opciones. */
let opacityBuffer = "";
let opacityTimer = null;
addEventListener("keydown", e => {
  if(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if(!/^[0-9]$/.test(e.key)) return;
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if(anyDialogOpen()) return;
  const opt = current.options?.find(o => o.key === "opacity");
  if(!opt) return;
  e.preventDefault();
  clearTimeout(opacityTimer);
  const apply = value => {
    toolState.opacity = Math.max(opt.min, Math.min(opt.max, value === 0 ? 100 : value));
    renderOptions();
  };
  if(opacityBuffer){
    // Segundo dígito a tiempo: "2" + "5" = 25.
    apply(+(opacityBuffer + e.key));
    opacityBuffer = "";
    return;
  }
  apply(+e.key * 10);
  opacityBuffer = e.key;
  opacityTimer = setTimeout(() => { opacityBuffer = ""; }, 600);
});

/* Flechas con la herramienta Mover: 1 píxel, o 10 con Alt, como en
   Photoshop. Aparte del atajo de arriba porque aquí SÍ hace falta
   Alt (para el paso largo) y no cambia de herramienta. */
const NUDGE = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0] };
addEventListener("keydown", e => {
  if(current.id !== "move" || !NUDGE[e.key]) return;
  if(e.ctrlKey || e.metaKey || e.shiftKey) return;
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if(anyDialogOpen()) return;
  e.preventDefault();
  const step = e.altKey ? 10 : 1;
  const [dx, dy] = NUDGE[e.key];
  current.nudge(dx * step, dy * step);
});

/* ═══ barra de herramientas ═══ */
function buildTools(){
  const host = document.getElementById("tools");
  host.innerHTML = "";
  // Separadores por grupo, no por indice: al anadir una herramienta
  // los indices bailan y los separadores acaban en cualquier sitio.
  const GROUPS = new Set(["select-rect", "brush", "clone", "picker", "liquify", "compare"]);

  /* Doble clic en el botón de una herramienta: la convención de
     Photoshop. En la mano equivale a «ajustar a la ventana» y en la
     lupa a «tamaño real», que son las dos cosas que se piden a diario
     y que si no hay que ir a buscar al menú Ver. */
  const DBL = { pan: "view.fit", zoom: "view.zoom100", move: "layer.centerContent" };

  const bundles=[
    ["pan","zoom"], ["crop","transform","perspective"],
    ["brush","eraser","smudge"], ["fill","gradient","shape"],
    ["clone","heal"], ["expose","dodgeburn"],
    ["select-rect","select-ellipse","select-lasso","select-wand","pen"]
  ];
  const bundled=new Set(bundles.flat());
  const byId=id=>TOOLS.find(t=>t.id===id);
  const configure=(b,t)=>{
    b.dataset.tool=t.id;
    const extra=t.id==="pan"?" · doble clic: ajustar a la ventana":t.id==="zoom"?" · doble clic: tamaño real":t.id==="move"?" · doble clic: centrar en el lienzo":"";
    b.title=`${t.name}${t.key?` (${t.key.toUpperCase()})`:""}${extra}`;
    b.setAttribute("aria-label",t.name);b.innerHTML=t.icon;
  };
  const popup=(button,tools)=>{
    document.querySelector(".tool-flyout")?.remove();
    const p=document.createElement("div");p.className="tool-flyout";
    for(const t of tools){const x=document.createElement("button");x.innerHTML=t.icon+`<span>${t.name}</span>`;x.onclick=()=>{setTool(t.id);configure(button,t);p.remove();};p.appendChild(x);}
    document.body.appendChild(p);const r=button.getBoundingClientRect();p.style.left=Math.min(innerWidth-p.offsetWidth-8,r.right+5)+"px";p.style.top=Math.min(innerHeight-p.offsetHeight-8,r.top)+"px";
    setTimeout(()=>document.addEventListener("pointerdown",e=>{if(!p.contains(e.target))p.remove();},{once:true}),0);
  };
  const addButton=t=>{
    if(GROUPS.has(t.id)){
      const s = document.createElement("div");
      s.className = "tool-sep";
      host.appendChild(s);
    }
    const b = document.createElement("button");
    b.className = "tool" + (t === current ? " on" : "");
    configure(b,t);
    /* El icono de un grupo puede cambiar de herramienta. El clic debe
       activar la que muestra ahora, no la primera con la que se creó el
       botón. Tras una pulsación larga tampoco debe dispararse el clic
       sintético que llega al soltar el ratón o el dedo. */
    b.addEventListener("click", e => {
      if(b._longPressOpened){
        b._longPressOpened = false;
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      setTool(b.dataset.tool);
    });
    if(DBL[t.id]) b.addEventListener("dblclick", e => {
      e.preventDefault();
      run(DBL[t.id]);
    });
    host.appendChild(b);
    return b;
  };
  const emitted=new Set();
  for(const t of TOOLS){
    const ids=bundles.find(g=>g.includes(t.id));
    if(!ids){addButton(t);continue;}
    if(emitted.has(ids))continue;emitted.add(ids);
    const tools=ids.map(byId).filter(Boolean),chosen=tools.includes(current)?current:tools[0],b=addButton(chosen);
    b.dataset.bundle=ids.join(",");b.classList.add("has-flyout");b.title+=" · mantén pulsado para ver herramientas agrupadas";
    b.oncontextmenu=e=>{e.preventDefault();popup(b,tools);};
    let timer=0,startX=0,startY=0;
    const cancelHold=()=>{if(timer){clearTimeout(timer);timer=0;}};
    b.onpointerdown=e=>{
      /* Photoshop abre el grupo manteniendo pulsado el botón principal,
         tanto con ratón como con lápiz o dedo. */
      if(e.button!==0)return;
      startX=e.clientX;startY=e.clientY;
      cancelHold();
      timer=setTimeout(()=>{
        timer=0;
        b._longPressOpened=true;
        popup(b,tools);
      },450);
    };
    b.onpointermove=e=>{
      if(timer&&Math.hypot(e.clientX-startX,e.clientY-startY)>8)cancelHold();
    };
    b.onpointerup=b.onpointercancel=b.onpointerleave=cancelHold;
  }
}

on("tool:change", () => {
  document.querySelectorAll(".tool").forEach(b => {
    const ids=(b.dataset.bundle||"").split(",");
    if(ids.includes(current.id)){
      const t=TOOLS.find(x=>x.id===current.id);if(t){b.dataset.tool=t.id;b.innerHTML=t.icon;b.setAttribute("aria-label",t.name);}
    }
    b.classList.toggle("on", b.dataset.tool === current.id);
  });
  stage.style.cursor = current.cursor === "none" ? "none" : (current.cursor || "default");
  haptic(6);
});

/* ═══ gestos sobre el lienzo ═══ */
let drawing = false;
let brushResize = null;

/* Si un segundo dedo llega para pellizcar o panear mientras había un
   trazo a medias, ese trazo se cancela primero: sin esto se queda un
   punto de pintura pegado en pantalla o una capa a medio mover, que es
   justo el «el zoom con dos dedos funciona mal» que se nota al tacto.
   La vista es quien detecta la transición de un dedo a dos, así que
   avisa por el bus y aquí se limpia lo que hiciera falta. */
on("view:gesturestart", () => {
  if(!drawing) return;
  try{
    if(current.cancel) current.cancel();
    else if(current.up) current.up();
  }catch(err){ console.error("[gesto]", err); }
  drawing = false;
  stopAutoScroll();
  emit("doc:structure");
  scheduleCompose();
});

/* Autodesplazamiento cerca del borde mientras se dibuja: con un lápiz
   o el dedo, acercarse al límite del lienzo desplaza la vista sola en
   esa dirección, para no tener que soltar y volver a agarrar. Sólo
   tiene sentido con las herramientas tipo pincel (cursor «none»); con
   mover o recortar cambiar la vista a la vez que se arrastra confunde
   más de lo que ayuda. */
let autoScrollReq = null, lastClientPos = null;
function stopAutoScroll(){
  lastClientPos = null;
  if(autoScrollReq){ cancelAnimationFrame(autoScrollReq); autoScrollReq = null; }
}
function autoScrollTick(){
  autoScrollReq = null;
  if(!drawing || !lastClientPos) return;
  const d = edgeAutoScroll(lastClientPos.x, lastClientPos.y);
  if(!d) return;   // se reactiva solo en el próximo pointermove si vuelve a acercarse
  panBy(d.dx, d.dy);
  const p = toImage(lastClientPos.x, lastClientPos.y);
  if(current.move) current.move(p, lastClientPos.e);
  autoScrollReq = requestAnimationFrame(autoScrollTick);
}

stage.addEventListener("dblclick", e => {
  // Doble clic sobre un texto lo reabre, venga de la herramienta que venga
  if(!doc.open) return;
  const l = activeLayer();
  if(isText(l)){ setTool("text"); startEdit(l, true, false); return; }
  // Mismo atajo que el doble clic en el icono de la barra de
  // herramientas (Mano → ajustar, Lupa → 100 %, Mover → centrar), para
  // quien lo prueba directamente en el lienzo en vez de en el icono.
  const cmd = current.id === "pan"  ? "view.fit"
            : current.id === "zoom" ? "view.zoom100"
            : current.id === "move" ? "layer.centerContent"
            : null;
  if(cmd) run(cmd);
});

// El menú contextual del navegador no aporta nada sobre el lienzo, y
// taparía justo el gesto que ahora tiene su propio significado: botón
// derecho = pintar con el color de fondo.
stage.addEventListener("contextmenu", e => e.preventDefault());

stage.addEventListener("pointerdown", e => {
  if(!doc.open) return;
  // Controles de verdad flotando sobre el lienzo (píldora de zoom, el
  // textarea de edición de texto, el FAB de comparar…): tocarlos debe
  // comportarse como el control que son, no arrancar un trazo de la
  // herramienta activa debajo. Sin este corte, `stage.setPointerCapture`
  // más abajo secuestra el puntero y el click nativo del botón nunca
  // llega a dispararse.
  if(e.target.closest("button, input, select, textarea, a")) return;
  // Photoshop: Alt + botón derecho y arrastrar. Horizontal cambia el
  // diámetro; vertical, la dureza. Todas las herramientas que declaran
  // una opción `size` comparten state.size, por lo que el mismo gesto
  // sirve para pincel, borrador, clonar, correctores y similares.
  if(e.altKey && e.button === 2 && current.options?.some(o => o.key === "size")){
    e.preventDefault();
    brushResize = { x:e.clientX, y:e.clientY, size:toolState.size, hardness:toolState.hardness };
    stage.setPointerCapture(e.pointerId);
    return;
  }
  // Con un texto en edición, tocar fuera lo confirma
  if(isEditing() && !e.target.closest(".text-edit")) endEdit();
  if(handleDoubleTap(e)) return;
  if(handlePointerDown(e)) return;      // la vista se ha quedado el gesto
  if(e.button === 2 && !current.rightClick) return;
  if(e.button !== 0 && e.button !== 2) return;
  setActiveColorSlot(e.button === 2 ? "bg" : "fg");
  const p = toImage(e.clientX, e.clientY);
  if(current.down){
    drawing = true;
    stage.setPointerCapture(e.pointerId);
    current.down(p, e);
    scheduleCompose();
  }
});

stage.addEventListener("pointermove", e => {
  if(!doc.open) return;
  if(brushResize){
    e.preventDefault();
    toolState.size = Math.max(1, Math.min(400, Math.round(brushResize.size + e.clientX - brushResize.x)));
    toolState.hardness = Math.max(0, Math.min(100, Math.round(brushResize.hardness - (e.clientY - brushResize.y) / 2)));
    for(const [key, value] of [["size", toolState.size], ["hardness", toolState.hardness]]){
      const input = document.querySelector(`#optsbar input[data-option-key="${key}"]`);
      if(input){ input.value = value; const label = input.parentElement.querySelector(".mono"); if(label) label.textContent = value + (key === "size" ? "px" : "%"); }
      emit("tool:paramchange", key);
    }
    return;
  }
  const p = toImage(e.clientX, e.clientY);
  updatePos(p);
  if(current.cursor === "none") setCursorPos(p);
  if(handlePointerMove(e)) return;
  if(drawing && current.move) current.move(p, e);
  if(drawing && current.cursor === "none"){
    lastClientPos = { x: e.clientX, y: e.clientY, e };
    if(!autoScrollReq) autoScrollReq = requestAnimationFrame(autoScrollTick);
  }
});

const endStroke = e => {
  if(brushResize){ brushResize = null; return; }
  stopAutoScroll();
  // El botón derecho vale sólo para el trazo que lo usó: suelto el
  // ratón, «state.color» vuelve a mirar al frontal, que es el que
  // muestra el resto de la interfaz (el swatch de la barra de
  // opciones, el picker de color…).
  setActiveColorSlot("fg");
  if(handlePointerUp(e)) return;
  if(drawing && current.up){ current.up(e); }
  drawing = false;
};
stage.addEventListener("pointerup", endStroke);
stage.addEventListener("pointercancel", endStroke);
stage.addEventListener("pointerleave", e => {
  if(current.cursor === "none") setCursorPos(null);
});

/* ═══ barra de estado ═══ */
const stZoom = document.getElementById("stZoom");
const stSize = document.getElementById("stSize");
const stLayer = document.getElementById("stLayer");
const stPos  = document.getElementById("stPos");
const zoomPillLvl = document.getElementById("zoomPillLvl");

function updatePos(p){
  if(!p){ stPos.textContent = "—"; return; }
  stPos.textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`;
}

function syncStatus(){
  const z = view.zoom * 100;
  const txt = (z < 10 ? z.toFixed(1) : Math.round(z)) + " %";
  stZoom.textContent = txt;
  zoomPillLvl.textContent = txt;
  stSize.textContent = doc.open ? `${doc.w} × ${doc.h}` : "—";
  const l = activeLayer();
  stLayer.textContent = l ? l.name : "—";
}

on("view:change", syncStatus);
on("doc:change", syncStatus);
on("doc:structure", syncStatus);
on("doc:active", syncStatus);

const compareFab = document.getElementById("compareFab");
function syncCompareFab(){ compareFab.hidden = !(doc.open && canUndo()); }
compareFab.addEventListener("click", () => setTool("compare"));
on("doc:change", syncCompareFab);
on("doc:structure", syncCompareFab);
on("history:change", syncCompareFab);
on("cmd:done", syncCompareFab);
syncCompareFab();

/* El historial libera capturas de píxeles viejas cuando se pasa del
   techo de memoria: ese paso deja de poder recorrerse. Nadie escuchaba
   el aviso, así que deshacer se quedaba quieto sin decir por qué y
   parecía que la aplicación ignoraba la orden. */
on("history:lost", () => toast("Ese paso ya no puede deshacerse: su copia se liberó para no agotar la memoria"));

document.getElementById("zoomCell").addEventListener("click", () => run("view.fit"));

/* ═══ arranque ═══ */
initPWA();
initLandscapeNotice();
installKeyboardFit();
initMenu();
initPanels();
import("./ui/histogrampanel.js").then(m => m.initHistogramPanel());
initOpen();
initDocbar();
initProjects();
resumeAfterUpdate();   // lo que se guardó justo antes de actualizar la app (pwa.js)
// Si la página se cayó con un modelo de IA pesado en marcha (ai/runtime.js)
try{ if(localStorage.getItem("realify.aiRunning")) import("./ai/runtime.js").then(m => m.recoverAfterCrash()); }catch{}
try{ if(localStorage.getItem("realify.hdrRunning")) import("../hdr/index.js").then(m => m.recoverHdrCrash()); }catch{}
initMobileBar();
initToolDrawer();
initRulers();
/* Aviso informativo de cookies. Se importa aparte y sin bloquear: los
   filtros de «avisos de cookies» de algunos bloqueadores (uBlock con
   EasyList Cookie, «I don't care about cookies»…) bloqueaban el archivo
   cuando se llamaba cookiebar.js, y al ser un import estático Firefox no
   llegaba a arrancar la app. Si lo bloquean, la app funciona sin él. */
import("./ui/prefsnote.js").then(m => m.initPrefsNote()).catch(() => {});
buildTools();
initColorSwatch(document.getElementById("tools"));
renderOptions();
syncStatus();
renderInfo();

/* Un aviso antes de perder el trabajo. Sólo cuando hay algo abierto:
   preguntar con el lienzo vacío es ruido. */
addEventListener("beforeunload", e => {
  if(!doc.open) return;
  e.preventDefault();
  e.returnValue = "";
});

on("doc:new", () => setTimeout(maybeShowOnboarding, 500));

/* La pantalla de bienvenida se muestra u oculta según si HAY un
   documento activo, punto — sea cual sea el camino por el que se
   llegó a ese estado (abrir, cerrar una pestaña, volver a la última
   que queda…). Centralizarlo aquí evita tener que acordarse de
   tocarlo en cada sitio nuevo que cree o cierre una pestaña. */
on("doc:structure", () => empty.classList.toggle("hide", doc.open));

console.info("Realify · listo");
/* Arrancada: el vigilante (js/boot-guard.js) deja de esperar; y un
   aviso si el navegador bloquea algo que el editor necesita (lectura
   del lienzo, WebGL2, almacenamiento). */
window.__realifyReady = true;
setTimeout(() => import("./core/compat.js").then(m => m.showCompatNotice()).catch(() => {}), 800);
