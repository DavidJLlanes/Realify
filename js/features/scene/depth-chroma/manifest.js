/* ═══════════════════════════════════════════════════════════════
   ABERRACIÓN POR DISTANCIA · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   Interfaz simple (4.7 del plan): pocos mandos en un diálogo.
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.depthChroma",
  label: "Aberración por distancia…",
  short: "Aberración distancia",
  icon: "rainbow",
  help: "Aberración cromática que crece con la distancia, como un objetivo que se resiente en lo lejano.",
  submenu: "profundidad",
  tabs: ["efectos"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
