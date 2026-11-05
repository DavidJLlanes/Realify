/* ═══════════════════════════════════════════════════════════════
   MOIRÉ Y BANDAS · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   Interfaz simple (4.7 del plan): pocos mandos en un diálogo.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.moire",
  label: "Moiré y bandas…",
  short: "Moiré y bandas",
  icon: "grid-3x3",
  help: "Quita el moiré y las bandas periódicas buscando picos en el espectro de cada bloque y atenuándolos; el color se limpia más fuerte.",
  submenu: "mejorar",
  tabs: ["mejorar","corregir"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
