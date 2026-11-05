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

export const MANIFESTS = [
  partsSelect,
  skinWrinkles, darkCircles, skinShine, skinTexture, skinEven,
  faceRelight, eyes, lipsBrows, teeth, hair, flyawayHair, glassesGlare, faceShape,
  bodyEditor, bodyShape, bodyPosture, bodyTone, bodySkin,
  /* aquí se añade el import del manifiesto de cada función nueva (el generador imprime la línea) */
];
