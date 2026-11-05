/* ═══════════════════════════════════════════════════════════════
   ARRUGAS · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Arrugas» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.skinWrinkles",
  label: "Arrugas…",
  short: "Arrugas",
  icon: "waves-horizontal",
  help: "Atenúa las arrugas de la frente, el entrecejo, las patas de gallo, los surcos y el cuello sin borrar la textura de la piel: detecta cada surco con un filtro de crestas y reinyecta los poros. En el editor de cara, capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "arrugas" },
  params: PARAMS,
  load: () => import("./index.js")
};
