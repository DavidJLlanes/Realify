/* ═══════════════════════════════════════════════════════════════
   APP · comandos de Imagen
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { resizeDialog, canvasSizeDialog, contentAwareScaleDialog, rotateLeft, rotateRight, rotate180, flipH, flipV } from "../../editor/imageops.js";
import { setTool } from "../../editor/tools/tools.js";
import { doc } from "../../core/doc.js";
import { pickNow } from "../../io/open.js";
import { needsDoc, photoTool } from "./helpers.js";

registerAll({
  "image.beforeAfter": { run: async () => (await import("../../../plugins/compare/index.js")).openCompare(), enabled: needsDoc },
  "image.resize": { run: resizeDialog, enabled: needsDoc },
  "image.canvasSize": { run: canvasSizeDialog, enabled: needsDoc },
  "image.contentAwareScale": { run: contentAwareScaleDialog, enabled: needsDoc },
  "image.crop":   { run: () => setTool("crop"), enabled: needsDoc },
  "image.rotL":   { run: rotateLeft,  enabled: needsDoc },
  "image.rotR":   { run: rotateRight, enabled: needsDoc },
  "image.autoStraighten": { run: async () => (await import("../../features/autostraighten.js")).autoStraighten(), enabled: needsDoc },
  "image.rot180": { run: rotate180,   enabled: needsDoc },
  /* Cortar en partes (plugins/slice/): sin documento, pide una foto */
  // Sin documento, la foto se pide en el mismo toque (ver pickNow).
  "image.slice":     { run: () => doc.open ? import("../../../plugins/slice/index.js").then(m => m.openCut())
                                           : pickNow({}, ([f]) => import("../../../plugins/slice/index.js").then(m => m.openCut(f))) },
  /* Recortar en forma (plugins/shape-crop/): sin documento, pide una foto */
  "image.shapeCrop": { run: () => doc.open ? import("../../../plugins/shape-crop/index.js").then(m => m.openShapes())
                                           : pickNow({}, ([f]) => import("../../../plugins/shape-crop/index.js").then(m => m.openShapes(f))) },
  /* Plugins a pantalla completa (carpetas plugins/hdr/, …): no necesitan documento */
  "image.hdr":       { run: async () => (await import("../../../plugins/hdr/index.js")).openHdr() },
  "image.merge":     { run: async () => (await import("../../../plugins/merge/index.js")).openMerge() },
  "image.panorama":  { run: async () => (await import("../../../plugins/panorama/index.js")).openPanorama() },
  "image.docscan":   { run: async () => (await import("../../features/docscan.js")).openDocScan(), enabled: needsDoc },
  "image.sharpness": { run: async () => (await import("../../features/sharpness.js")).openSharpness() },
  "image.stack":     { run: async () => (await import("../../features/stack.js")).openStack() },
  "image.flipH":  { run: flipH,       enabled: needsDoc },
  "image.flipV":  { run: flipV,       enabled: needsDoc },
  "image.removeBackground": { run: photoTool("removeBackground"), enabled: needsDoc }
});
