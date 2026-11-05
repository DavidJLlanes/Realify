/* ═══════════════════════════════════════════════════════════════
   BORRADO LIGERO · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Usa la ventana a pantalla completa de SAM (js/features/samtools.js), sin diálogo propio.
   ══════════════════════════════════════════════════════════════ */

export default {
  cmd: "ai.quickErase",
  label: "Borrado ligero con IA…",
  short: "Borrado ligero",
  icon: "eraser",
  help: "Pinta sobre lo que sobra y se rellena en una capa nueva; el original queda intacto. Pensado para el móvil.",
  submenu: "borrar",
  tabs: ["retoque"],
  premium: true,
  ui: "simple",
  params: [],
  load: () => import("./index.js")
};
