/* ═══════════════════════════════════════════════════════════════
   DEFINICIÓN Y TONO · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cuerpo en el grupo «definicion» (4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export default {
  cmd: "ai.bodyTone",
  label: "Definición y tono…",
  short: "Definición",
  icon: "contrast",
  help: "Realza la definición del cuerpo adulto: relieve de luz y sombra y musculatura por zonas, sin generar piel. No existe para el perfil infantil.",
  submenu: "cuerpo",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "body", group: "definicion" },
  params: PARAMS,
  load: () => import("./index.js")
};
