/* ═══════════════════════════════════════════════════════════════
   CAMBIAR COLOR DE PRENDAS · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de ropa en el grupo «color» (4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export default {
  cmd: "ai.recolorClothes",
  label: "Cambiar color de prendas…",
  short: "Color ropa",
  icon: "palette",
  help: "Cambia el color de una prenda en OKLab conservando sus sombras, brillos y pliegues; las prendas blancas, grises o negras se tiñen con el tinte.",
  submenu: "ropa",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "clothing", group: "color" },
  params: PARAMS,
  load: () => import("./index.js")
};
