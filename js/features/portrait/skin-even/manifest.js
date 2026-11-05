/* ═══════════════════════════════════════════════════════════════
   IMPERFECCIONES Y TONO · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Imperfecciones» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.skinEven",
  label: "Imperfecciones y tono…",
  short: "Imperfecciones",
  icon: "bandage",
  help: "Rellena granos y manchas pequeñas con la piel de alrededor y uniforma las rojeces por zonas, sin tocar la luz ni la textura. En el editor de cara, capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "tono" },
  params: PARAMS,
  load: () => import("./index.js")
};
