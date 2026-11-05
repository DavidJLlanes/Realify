/* ═══════════════════════════════════════════════════════════════
   POSTURA · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cuerpo en el grupo «postura» (4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export default {
  cmd: "ai.bodyPosture",
  label: "Postura…",
  short: "Postura",
  icon: "move-vertical",
  help: "Endereza la postura: erguir la espalda, cuello adelantado y hombros caídos. Cambios pequeños y naturales, con el perfil de la persona.",
  submenu: "cuerpo",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "body", group: "postura" },
  params: PARAMS,
  load: () => import("./index.js")
};
