/* ═══════════════════════════════════════════════════════════════
   UNIFICAR ILUMINACIÓN · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   Interfaz simple (4.7 del plan): pocos mandos en un diálogo.
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.harmonize",
  label: "Unificar iluminación…",
  short: "Unificar luz",
  icon: "contrast",
  help: "Acerca el color y la luz del sujeto a los del fondo que lo rodea, para que parezca hecho en la misma escena.",
  submenu: "escena",
  tabs: ["color"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
