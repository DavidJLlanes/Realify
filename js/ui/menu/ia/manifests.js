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

export const MANIFESTS = [
  partsSelect,
  skinWrinkles, darkCircles, skinShine, skinTexture, skinEven,
  /* aquí se añade el import del manifiesto de cada función nueva (el generador imprime la línea) */
];
