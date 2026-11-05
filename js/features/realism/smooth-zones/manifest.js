/* ═══════════════════════════════════════════════════════════════
   ZONAS LISAS · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Interfaz simple (3 mandos).
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.smoothZones",
  label: "Zonas demasiado lisas con IA…",
  short: "Zonas lisas",
  icon: "layers",
  help: "Detecta las zonas sin textura creíble (cielos, pieles y fondos de imágenes generadas) y añade grano de sensor solo ahí. También puede mostrártelas marcadas en rojo.",
  submenu: "realismo",
  tabs: ["efectos"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
