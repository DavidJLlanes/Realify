/* ═══════════════════════════════════════════════════════════════
   SELECCIÓN RÁPIDA · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Abre el editor a pantalla completa del plugin.
   ═══════════════════════════════════════════════════════════════ */
export default {
  cmd: "ai.culling",
  label: "Selección rápida…",
  short: "Selección rápida",
  icon: "layers",
  help: "Carga varias fotos y elige las mejores: puntúa nitidez, ojos y composición, agrupa duplicados y te deja comparar y descartar.",
  submenu: "lote",
  tabs: ["analizar"],
  premium: true,
  ui: "simple",
  params: [],
  load: () => import("./index.js")
};
