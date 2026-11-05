/* ═══════════════════════════════════════════════════════════════
   POLVO Y MOTAS · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   Interfaz simple (4.7 del plan): pocos mandos en un diálogo.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.dustSpots",
  label: "Polvo y motas del sensor…",
  short: "Polvo y motas",
  icon: "spray-can",
  help: "Detecta las motas del sensor (manchas pequeñas y oscuras sobre zonas lisas) y las rellena con el color de su alrededor, sin tocar la textura.",
  submenu: "mejorar",
  tabs: ["mejorar","corregir"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
