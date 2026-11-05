/* ═══════════════════════════════════════════════════════════════
   MENÚ IA · LISTA DE MANIFIESTOS
   Aquí se apuntan los manifiestos de las funciones nuevas (`js/features/<familia>/<función>/manifest.js`). De esta lista
   salen el menú de escritorio, el cajón del móvil, el menú ☰ y el registro de comandos: no se escribe nada a mano en otro sitio.
   Entradas: imports estáticos de manifiestos (solo datos, sin cargar el motor). Salida: MANIFESTS (array).
   Esquema de un manifiesto: { cmd, label, short, icon, help, submenu, tabs:[], premium:true, ui, params, load }.
   ═══════════════════════════════════════════════════════════════ */

import partsSelect from "../../../features/people/parts-select/manifest.js";
import skinWrinkles from "../../../features/portrait/skin-wrinkles/manifest.js";
import darkCircles from "../../../features/portrait/skin-dark-circles/manifest.js";
import skinShine from "../../../features/portrait/skin-shine/manifest.js";
import skinTexture from "../../../features/portrait/skin-texture/manifest.js";
import skinEven from "../../../features/portrait/skin-even/manifest.js";
import faceRelight from "../../../features/portrait/face-relight/manifest.js";
import eyes from "../../../features/portrait/eyes/manifest.js";
import lipsBrows from "../../../features/portrait/lips-brows/manifest.js";
import teeth from "../../../features/portrait/teeth/manifest.js";
import hair from "../../../features/portrait/hair/manifest.js";
import flyawayHair from "../../../features/portrait/flyaway-hair/manifest.js";
import glassesGlare from "../../../features/portrait/glasses-glare/manifest.js";
import faceShape from "../../../features/portrait/face-shape/manifest.js";
import bodyEditor from "../../../features/body/editor/manifest.js";
import bodyShape from "../../../features/body/shape/manifest.js";
import bodyPosture from "../../../features/body/posture/manifest.js";
import bodyTone from "../../../features/body/tone/manifest.js";
import bodySkin from "../../../features/body/skin/manifest.js";
import clothesWrinkles from "../../../features/clothing/iron/manifest.js";
import fabricWrinkles from "../../../features/clothing/fabric/manifest.js";
import recolorClothes from "../../../features/clothing/recolor/manifest.js";
import fabricTexture from "../../../features/clothing/texture/manifest.js";
import skyEnhance from "../../../features/scene/sky/manifest.js";
import dehaze from "../../../features/scene/dehaze/manifest.js";
import categoryBoost from "../../../features/scene/category-boost/manifest.js";
import zonedWhiteBalance from "../../../features/scene/zoned-wb/manifest.js";
import highlightRecovery from "../../../features/scene/highlights/manifest.js";
import harmonize from "../../../features/scene/harmonize/manifest.js";
import depthChroma from "../../../features/scene/depth-chroma/manifest.js";
import depthRelight from "../../../features/scene/depth-relight/manifest.js";
import smartBrush from "../../../features/compose/smart-brush/manifest.js";
import quickErase from "../../../features/compose/quick-erase/manifest.js";
import textPlacement from "../../../features/compose/text-placement/manifest.js";
import deblur from "../../../features/restore/deblur/manifest.js";
import dustSpots from "../../../features/restore/dust-spots/manifest.js";
import moire from "../../../features/restore/moire/manifest.js";

export const MANIFESTS = [
  partsSelect,
  skinWrinkles, darkCircles, skinShine, skinTexture, skinEven,
  faceRelight, eyes, lipsBrows, teeth, hair, flyawayHair, glassesGlare, faceShape,
  bodyEditor, bodyShape, bodyPosture, bodyTone, bodySkin,
  clothesWrinkles, fabricWrinkles, recolorClothes, fabricTexture,
  skyEnhance, dehaze, categoryBoost, zonedWhiteBalance, highlightRecovery, harmonize, depthChroma, depthRelight, textPlacement, smartBrush, quickErase,
  deblur, dustSpots, moire,
  /* aquí se añade el import del manifiesto de cada función nueva (el generador imprime la línea) */
];
