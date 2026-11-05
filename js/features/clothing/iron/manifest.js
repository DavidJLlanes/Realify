/* ═══════════════════════════════════════════════════════════════
   PLANCHAR ARRUGAS DE ROPA · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de ropa en el grupo «planchar» (4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export default {
  cmd: "ai.clothesWrinkles",
  label: "Planchar arrugas de ropa…",
  short: "Planchar ropa",
  icon: "wind",
  help: "Plancha las arrugas de la ropa: aplana el sombreado de los pliegues y conserva la trama del tejido, las rayas y los estampados.",
  submenu: "ropa",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "clothing", group: "planchar" },
  params: PARAMS,
  load: () => import("./index.js")
};
