/* ═══════════════════════════════════════════════════════════════
   REALZAR POR TIPO · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   Interfaz simple (4.7 del plan): pocos mandos en un diálogo.
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.categoryBoost",
  label: "Realzar por tipo…",
  short: "Realzar tipo",
  icon: "palette",
  help: "Realza por tipo de cosa —agua, follaje, cielo, edificios o piel— con la receta de cada una: saturación y detalle sólo donde toca.",
  submenu: "escena",
  tabs: ["mejorar","color"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
