/* ═══════════════════════════════════════════════════════════════
   OJERAS Y BOLSAS · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Ojeras» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.darkCircles",
  label: "Ojeras y bolsas…",
  short: "Ojeras",
  icon: "eye",
  help: "Iguala la luz y el tono de la zona bajo los ojos con el de la mejilla, sin borrar la textura de la piel. En el editor de cara, capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "ojeras" },
  params: PARAMS,
  load: () => import("./index.js")
};
