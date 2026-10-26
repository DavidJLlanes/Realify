/* ═══════════════════════════════════════════════════════════════
   APP · comandos de Filtros
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { activeLayer } from "../../core/doc.js";
import { setTool } from "../../editor/tools/tools.js";
import { needsDoc, photoTool } from "./helpers.js";

registerAll({
  /* Marcos (plugins/frames/): añade un marco como capa independiente sobre el
     documento, de modo que las capas fotográficas de 16 bits conservan
     su hiSrc y siguen pudiendo exportarse en alta precisión. */
  "filter.frames":   { run: async () => (await import("../../../plugins/frames/index.js")).openFrames(),
                       enabled: needsDoc },
  /* Estos llegan con los módulos que faltan por migrar. Se declaran
     ya para que los menús no queden con huecos ni comandos rotos. */
  "filter.camera":  { run: async () => {
      const m = await import("../../filters/camera/ui.js");
      await m.openCamera();
    }, enabled: needsDoc },
  "filter.cameraPremium": { run: async () => (await import("../../filters/camera/ui.js")).openCamera({ premium: true }), enabled: needsDoc },
  "filter.photoDevelop": { run: async () => (await import("../../../plugins/raw/index.js")).openPhotoDevelop(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked && activeLayer().type !== "adjust" },
  "filter.vintage": { run: async () => (await import("../../../plugins/vintage/index.js")).openVintageFilter(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked && activeLayer().type !== "adjust" },
  "filter.cameras": { run: async () => (await import("../../../plugins/cameras/index.js")).openCamaras(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked && activeLayer().type !== "adjust" },
  "filter.luts": { run: async () => (await import("../../../plugins/lut/index.js")).openLuts(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked && activeLayer().type !== "adjust" },
  /* Sin `!anyDialogOpen()` en la condición, a propósito: en móvil los
     filtros se eligen desde una rejilla que ES un diálogo, así que esa
     comprobación dejaba el botón permanentemente gris ahí dentro —el
     único filtro que no se podía abrir en un teléfono—. La reentrada
     de verdad ya la corta `openPurePixel()` en su primera línea, que
     es donde corresponde. */
  "filter.purepixel": { run: async () => (await import("../../filters/purepixel/ui.js")).openPurePixel(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked &&
      activeLayer().type === "raster" },
  "filter.lens":    { run: async () => (await import("../../filters/lens/ui.js")).openLens(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked &&
      activeLayer().type !== "adjust" },
  "filter.unmark":  { run: async () => (await import("../../filters/unmark/ui.js")).openUnmark(),
    enabled: () => needsDoc() && !!activeLayer() && !activeLayer().locked &&
      activeLayer().type !== "adjust" },
  "filter.blur":    { run: async () => (await import("../../filters/library/basic.js")).blur(),
                      enabled: needsDoc },
  "filter.sharpen": { run: async () => (await import("../../filters/library/basic.js")).sharpen(),
                      enabled: needsDoc },
  "filter.denoise": { run: photoTool("reduceNoise"), enabled: needsDoc },
  "filter.aiDenoise": { run: photoTool("aiDenoise"), enabled: needsDoc },
  "filter.aiDejpeg":  { run: photoTool("aiDejpeg"),  enabled: needsDoc },
  "filter.lensProfile": { run: async () => (await import("../../features/lenscorrect.js")).openLensProfile(), enabled: needsDoc },
  "filter.lensAuto": { run: async () => (await import("../../features/lenscorrect.js")).applyLensAuto(), enabled: needsDoc },
  "filter.lensCorrection": { run: photoTool("lensCorrection"), enabled: needsDoc },
  "filter.selectiveSharpen": { run: photoTool("selectiveSharpen"), enabled: needsDoc },
  "filter.portrait": { run: photoTool("portraitRetouch"), enabled: needsDoc },
  "filter.freqsep": { run: async () => (await import("../../filters/library/freqsep.js")).openFreqSep(), enabled: needsDoc },
  "filter.motionBlur": { run: async () => (await import("../../filters/library/basic.js")).motionBlur(),
                      enabled: needsDoc },
  "filter.lensBlur": { run: async () => (await import("../../filters/library/advanced.js")).lensBlur(), enabled: needsDoc },
  "filter.radialBlur": { run: async () => (await import("../../filters/library/advanced.js")).radialBlur(), enabled: needsDoc },
  "filter.surfaceBlur": { run: async () => (await import("../../filters/library/advanced.js")).surfaceBlur(), enabled: needsDoc },
  "filter.highPass": { run: async () => (await import("../../filters/library/advanced.js")).highPass(), enabled: needsDoc },
  "filter.channelDenoise": { run: async () => (await import("../../filters/library/advanced.js")).channelDenoise(), enabled: needsDoc },
  "filter.smartSharpen": { run: async () => (await import("../../filters/library/advanced.js")).smartSharpen(), enabled: needsDoc },
  "filter.distort": { run: async () => (await import("../../filters/library/advanced.js")).distort(), enabled: needsDoc },
  "filter.stylize": { run: async () => (await import("../../filters/library/advanced.js")).stylize(), enabled: needsDoc },
  "filter.pixelate": { run: async () => (await import("../../filters/library/effects.js")).pixelate(), enabled: needsDoc },
  "filter.stylizeEffects": { run: async () => (await import("../../filters/library/effects.js")).stylizeEffects(), enabled: needsDoc },
  "filter.artisticGallery": { run: async () => (await import("../../filters/library/effects.js")).artisticGallery(), enabled: needsDoc },
  "filter.renderEffects": { run: async () => (await import("../../filters/library/effects.js")).renderEffects(), enabled: needsDoc },
  "filter.textureEffects": { run: async () => (await import("../../filters/library/effects.js")).textureEffects(), enabled: needsDoc },
  "filter.customConvolution": { run: async () => (await import("../../filters/library/effects.js")).customConvolution(), enabled: needsDoc },
  "filter.offsetMorphology": { run: async () => (await import("../../filters/library/effects.js")).offsetMorphology(), enabled: needsDoc },
  "filter.blurGallery": { run: async () => (await import("../../filters/library/classic.js")).blurGallery(), enabled: needsDoc },
  "filter.utilityBlur": { run: async () => (await import("../../filters/library/classic.js")).utilityBlur(), enabled: needsDoc },
  "filter.restoration": { run: async () => (await import("../../filters/library/classic.js")).restoration(), enabled: needsDoc },
  "filter.advancedSharpen": { run: async () => (await import("../../filters/library/classic.js")).advancedSharpen(), enabled: needsDoc },
  "filter.classicDistort": { run: async () => (await import("../../filters/library/classic.js")).classicDistort(), enabled: needsDoc },
  "filter.adaptiveWideAngle": { run: async () => (await import("../../filters/library/classic.js")).adaptiveWideAngle(), enabled: needsDoc },
  "filter.puppetWarp": { run: async () => (await import("../../filters/library/classic.js")).puppetWarp(), enabled: needsDoc },
  "filter.noise":   { run: async () => (await import("../../filters/library/basic.js")).noise(),
                      enabled: needsDoc },
  "filter.vignette": { run: async () => (await import("../../filters/library/basic.js")).vignette(),
                      enabled: needsDoc },
  "filter.clarity":  { run: async () => (await import("../../filters/library/basic.js")).clarity(),
                      enabled: needsDoc },
  "filter.spot":     { run: () => setTool("heal"), enabled: needsDoc },
  "filter.patch":    { run: () => setTool("clone"), enabled: needsDoc },
  "filter.liquify":  { run: () => setTool("liquify"), enabled: needsDoc },
  "filter.looks":    { run: async () => (await import("../../filters/looks/looks.js")).openLooks(),
                      enabled: needsDoc },
  "filter.lut":      { run: async () => (await import("../../filters/lut/ui.js")).openLut(),
                      enabled: needsDoc },
  "filter.perspective": { run: () => setTool("perspective"), enabled: needsDoc }
});
