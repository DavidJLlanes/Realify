/* ═══════════════════════════════════════════════════════════════
   ARRUGAS DE TELAS Y FONDOS · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de ropa en el grupo «planchar» (4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export default {
  cmd: "ai.fabricWrinkles",
  label: "Arrugas de telas y fondos…",
  short: "Arrugas telas",
  icon: "waves-horizontal",
  help: "Plancha las arrugas de sábanas, cortinas, manteles o fondos de tela: tocas la tela y se alisa sin perder su trama.",
  submenu: "ropa",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "clothing", group: "planchar", target: "telas" },
  params: PARAMS,
  load: () => import("./index.js")
};
