/* ═══════════════════════════════════════════════════════════════
   SELECCIONAR PARTES · MANIFIESTO
   Sólo DATOS: de aquí salen el menú de escritorio, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: "simple" (cuatro mandos globales). `params`: el esquema (js/ui/kit/params-panel.js).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.partsSelect",
  label: "Seleccionar partes…",
  short: "Partes",
  icon: "user-round",
  help: "Elige una parte de la persona —pelo, cara, piel, ropa, brazos, piernas, zapatos…— y la IA (SegFormer + pose) la selecciona o la deja como máscara de la capa. Reconoce varias personas. Todo en tu equipo.",
  submenu: "seleccionar",
  tabs: ["seleccion"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
