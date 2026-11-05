/* ═══════════════════════════════════════════════════════════════
   REFLEJOS EN GAFAS · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Reflejos gafas» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.glassesGlare",
  label: "Reflejos en gafas…",
  short: "Reflejos gafas",
  icon: "glasses",
  help: "Atenúa los brillos y reflejos de los cristales de las gafas, sin tocar los ojos ni la montura. Capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "gafas" },
  params: PARAMS,
  load: () => import("./index.js")
};
