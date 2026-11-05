/* ═══════════════════════════════════════════════════════════════
   QUITAR NEBLINA CON PROFUNDIDAD · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   Interfaz simple (4.7 del plan): pocos mandos en un diálogo.
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.dehaze",
  label: "Quitar neblina con IA…",
  short: "Quitar neblina IA",
  icon: "wind",
  help: "Quita la neblina usando la distancia de cada punto (mapa de profundidad) además del canal oscuro, sin halos en los bordes.",
  submenu: "escena",
  tabs: ["mejorar"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
