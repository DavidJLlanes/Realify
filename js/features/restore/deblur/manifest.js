/* ═══════════════════════════════════════════════════════════════
   QUITAR DESENFOQUE · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   Interfaz simple (4.7 del plan): pocos mandos en un diálogo.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.deblur",
  label: "Quitar desenfoque…",
  short: "Quitar desenfoque",
  icon: "focus",
  help: "Quita el desenfoque de movimiento o de enfoque con un núcleo medido en la propia foto (o puesto a mano) y frena los halos.",
  submenu: "mejorar",
  tabs: ["mejorar","corregir"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
