/* ═══════════════════════════════════════════════════════════════
   LUZ DIRECCIONAL CON RELIEVE · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   Interfaz simple (4.7 del plan): pocos mandos en un diálogo.
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.depthRelight",
  label: "Luz direccional con relieve…",
  short: "Luz relieve",
  icon: "lightbulb",
  help: "Luz direccional con relieve: saca las normales del mapa de profundidad y ilumina la escena desde donde elijas.",
  submenu: "profundidad",
  tabs: ["efectos"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
