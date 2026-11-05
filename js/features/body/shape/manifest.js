/* ═══════════════════════════════════════════════════════════════
   SILUETA Y PROPORCIONES · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cuerpo en el grupo «silueta» (4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export default {
  cmd: "ai.bodyShape",
  label: "Silueta y proporciones…",
  short: "Silueta",
  icon: "ruler",
  help: "Cambia la silueta y las proporciones: delgado o ancho, altura, piernas y torso, hombros, cintura, caderas, brazos y piernas. Deforma sin pliegues, protege el fondo lejano y deja cada persona en su capa.",
  submenu: "cuerpo",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "body", group: "silueta" },
  params: PARAMS,
  load: () => import("./index.js")
};
