/* ═══════════════════════════════════════════════════════════════
   LUZ EN LA CARA · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Luz» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.faceRelight",
  label: "Luz en la cara…",
  short: "Luz",
  icon: "lightbulb",
  help: "Cambia la luz de la cara: dirección, altura, intensidad y suavidad, sobre la forma real de la cara (profundidad + elipsoide), en luz lineal y respetando el color de la piel. Capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "luz" },
  params: PARAMS,
  load: () => import("./index.js")
};
