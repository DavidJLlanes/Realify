/* ═══════════════════════════════════════════════════════════════
   LABIOS Y CEJAS · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Labios y cejas» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.lipsBrows",
  label: "Labios y cejas…",
  short: "Labios y cejas",
  icon: "heart",
  help: "Labios: más o menos color y definición. Cejas: oscurecer, dar color y rellenar los huecos. Capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "labios" },
  params: PARAMS,
  load: () => import("./index.js")
};
