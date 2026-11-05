/* ═══════════════════════════════════════════════════════════════
   RECUPERAR LUCES · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   Interfaz simple (4.7 del plan): pocos mandos en un diálogo.
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.highlightRecovery",
  label: "Recuperar luces…",
  short: "Recuperar luces",
  icon: "sun-medium",
  help: "Reconstruye los canales quemados: toma el color de los vecinos sanos y comprime el exceso con un hombro suave.",
  submenu: "escena",
  tabs: ["mejorar"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
