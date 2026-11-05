/* ═══════════════════════════════════════════════════════════════
   PIEL DEL CUERPO · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cuerpo en el grupo «piel» (4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export default {
  cmd: "ai.bodySkin",
  label: "Piel del cuerpo…",
  short: "Piel cuerpo",
  icon: "sun-medium",
  help: "Piel del cuerpo: suavizar, uniformar el color y bronceado (adultos); el perfil infantil solo tiene «uniformar».",
  submenu: "cuerpo",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "body", group: "piel" },
  params: PARAMS,
  load: () => import("./index.js")
};
