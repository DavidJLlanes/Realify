/* ═══════════════════════════════════════════════════════════════
   APP · comandos de Ajustes
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { maskLevels, maskCurves } from "../../editor/layers/maskadjust.js";
import { invertMaskLayer } from "../../editor/layers/masks.js";
import { needsDoc, maskInFocus } from "./helpers.js";

registerAll({
  "adj.brightness": { run: async () => (await import("../../editor/adjust/adjustments.js")).brightnessContrast(),
                      enabled: needsDoc },
  "adj.levels":     { run: async () => {
      // Ídem: con la máscara en edición, Niveles ajusta su gama de
      // grises; si no, los de la capa, como ha hecho siempre.
      const l = maskInFocus();
      if(l){ maskLevels(l); return; }
      (await import("../../editor/adjust/adjustments.js")).levels();
    }, enabled: needsDoc },
  "adj.curves":     { run: async () => {
      const l = maskInFocus();
      if(l){ maskCurves(l); return; }
      (await import("../../editor/adjust/adjustments.js")).curves();
    }, enabled: needsDoc },
  "adj.hsl":        { run: async () => (await import("../../editor/adjust/adjustments.js")).hueSaturation(),
                      enabled: needsDoc },
  "adj.grayscale":  { run: async () => (await import("../../editor/adjust/adjustments.js")).grayscale(),
                      enabled: needsDoc },
  "adj.invert":     { run: async () => {
      // Igual que en Photoshop: Ctrl+I invierte lo que tenga el foco
      // puesto. Con la máscara en edición, invierte la máscara; si
      // no, los colores de la capa, como ha hecho siempre.
      const l = maskInFocus();
      if(l){ invertMaskLayer(l); return; }
      (await import("../../editor/adjust/adjustments.js")).invert();
    }, enabled: needsDoc },
  "adj.auto":       { run: async () => (await import("../../editor/adjust/adjustments.js")).autoContrast(),
                      enabled: needsDoc },
  "adj.autoPremium": { run: async () => (await import("../../editor/adjust/adjustments.js")).autoContrastPremium(),
                      enabled: needsDoc },
  "adj.autoLevels": { run: async () => (await import("../../editor/adjust/adjustments.js")).autoLevels(),
                      enabled: needsDoc },
  "adj.autoLevelsPremium": { run: async () => (await import("../../editor/adjust/adjustments.js")).autoLevelsPremium(),
                      enabled: needsDoc },
  "adj.autoEnhance": { run: async () => (await import("../../editor/adjust/autoenhance.js")).autoEnhance(),
                      enabled: needsDoc },
  "adj.autoEnhancePremium": { run: async () => (await import("../../editor/adjust/autoenhance.js")).autoEnhancePremium(),
                      enabled: needsDoc },
  "adj.whiteBalance": { run: async () => (await import("../../editor/adjust/adjustments.js")).whiteBalance(),
                      enabled: needsDoc },
  "adj.tone":       { run: async () => (await import("../../editor/adjust/tone.js")).toneRegions(),
                      enabled: needsDoc },
  "adj.colorBands":  { run: async () => (await import("../../editor/adjust/colorbands.js")).colorBands(),
                      enabled: needsDoc },
  "adj.exposure":   { run: async () => (await import("../../editor/adjust/exposure.js")).exposure(),
                      enabled: needsDoc },
  "adj.vibrance":   { run: async () => (await import("../../editor/adjust/vibrance.js")).vibrance(),
                      enabled: needsDoc },
  "adj.shadowsHighlights": { run: async () => (await import("../../editor/adjust/shadowshighlights.js")).shadowsHighlights(),
                      enabled: needsDoc },
  "adj.colorBalance": { run: async () => (await import("../../editor/adjust/colorbalance.js")).colorBalance(),
                      enabled: needsDoc },
  "adj.channelMixer": { run: async () => (await import("../../editor/adjust/channelmixer.js")).channelMixer(),
                      enabled: needsDoc },
  "adj.selectiveColor": { run: async () => (await import("../../editor/adjust/selectivecolor.js")).selectiveColor(),
                      enabled: needsDoc },
  "adj.gradientMap": { run: async () => (await import("../../editor/adjust/gradientmap.js")).gradientMap(),
                      enabled: needsDoc },
  "adj.colorGrading": { run: async () => (await import("../../editor/adjust/advanced-color.js")).colorGrading(), enabled: needsDoc },
  "adj.splitToning": { run: async () => (await import("../../editor/adjust/advanced-color.js")).splitToning(), enabled: needsDoc },
  "adj.photoFilter": { run: async () => (await import("../../editor/adjust/advanced-color.js")).photoFilter(), enabled: needsDoc },
  "adj.dehaze": { run: async () => (await import("../../editor/adjust/advanced-color.js")).dehaze(), enabled: needsDoc },
  "adj.labCurves": { run: async () => (await import("../../editor/adjust/advanced-color.js")).labCurves(), enabled: needsDoc },
  /* Tonos del histograma: sólo una franja de luminancia. Desde el panel
     Histograma llega con la zona pulsada ({ center, width }). */
  "adj.toneBand": { run: async arg => (await import("../../editor/adjust/toneband.js")).toneBand(
      arg && typeof arg === "object" && Number.isFinite(arg.center) ? { init: arg } : {}), enabled: needsDoc },
  "adj.rangeHsl": { run: async () => (await import("../../editor/adjust/advanced-color.js")).rangeHsl(), enabled: needsDoc },
  "adj.replaceColor": { run: async () => (await import("../../editor/adjust/advanced-color.js")).replaceColor(), enabled: needsDoc },
  "adj.matchColor": { run: async () => (await import("../../editor/adjust/advanced-color.js")).matchColor(), enabled: needsDoc },
  "adj.threshold": { run: async () => (await import("../../editor/adjust/advanced-color.js")).threshold(), enabled: needsDoc },
  "adj.posterize": { run: async () => (await import("../../editor/adjust/advanced-color.js")).posterize(), enabled: needsDoc },
  "adj.equalize": { run: async () => (await import("../../editor/adjust/advanced-color.js")).equalize(), enabled: needsDoc },
  "adj.desaturate": { run: async () => (await import("../../editor/adjust/advanced-color.js")).desaturate(), enabled: needsDoc },
  "adj.autoToneColor": { run: async () => (await import("../../editor/adjust/advanced-color.js")).autoToneColor(), enabled: needsDoc },
  "adj.autoToneColorPremium": { run: async () => (await import("../../editor/adjust/advanced-color.js")).autoToneColorPremium(), enabled: needsDoc },
  "adj.clahe":           { run: async () => (await import("../../editor/adjust/clahe.js")).clahe(), enabled: needsDoc },
  "adj.clahePremium":    { run: async () => (await import("../../editor/adjust/clahe.js")).clahePremium(), enabled: needsDoc },
  "adj.lowLight":        { run: async () => (await import("../../editor/adjust/lowlight.js")).lowLight(), enabled: needsDoc },
  "adj.lowLightPremium": { run: async () => (await import("../../editor/adjust/lowlight.js")).lowLightPremium(), enabled: needsDoc },
  "adj.hdrTone": { run: async () => (await import("../../editor/adjust/advanced-color.js")).hdrTone(), enabled: needsDoc },
  "adj.tonalContrast": { run: async () => (await import("../../editor/adjust/advanced-color.js")).tonalContrast(), enabled: needsDoc },
  "adj.graduatedFilter": { run: async () => (await import("../../editor/adjust/advanced-color.js")).graduatedFilter(), enabled: needsDoc }
});
