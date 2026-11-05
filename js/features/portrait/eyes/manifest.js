/* ═══════════════════════════════════════════════════════════════
   OJOS · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Ojos» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.eyes",
  label: "Ojos…",
  short: "Ojos",
  icon: "aperture",
  help: "Da luz y detalle al iris sin quemar el reflejo, cambia el color del iris sin teñir la pupila y aclara el blanco del ojo. Capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "ojos" },
  params: PARAMS,
  load: () => import("./index.js")
};
