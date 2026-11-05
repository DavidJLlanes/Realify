/* ═══════════════════════════════════════════════════════════════
   MEJORAR CIELO · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   Interfaz simple (4.7 del plan): pocos mandos en un diálogo.
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.skyEnhance",
  label: "Mejorar cielo…",
  short: "Mejorar cielo",
  icon: "cloud-sun",
  help: "Realza el cielo (contraste y saturación), rellena de azul los cielos apagados conservando las nubes y ajusta la luz del primer plano.",
  submenu: "escena",
  tabs: ["mejorar"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
