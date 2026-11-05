/* ═══════════════════════════════════════════════════════════════
   PINCEL INTELIGENTE · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Usa la ventana a pantalla completa de SAM (js/features/samtools.js), sin diálogo propio.
   ══════════════════════════════════════════════════════════════ */

export default {
  cmd: "ai.smartBrush",
  label: "Pincel inteligente con IA…",
  short: "Pincel inteligente",
  icon: "brush",
  help: "Pinta sobre un objeto y la selección se ajusta a sus bordes (MobileSAM). Puedes añadir o quitar; el resultado es la selección activa.",
  submenu: "seleccionar",
  tabs: ["seleccion"],
  premium: true,
  ui: "simple",
  params: [],
  load: () => import("./index.js")
};
