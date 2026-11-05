/* ═══════════════════════════════════════════════════════════════
   INFORME DE REALISMO · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Informa en un diálogo (js/features/ai-kit/report-host.js), sin mandos.
   ══════════════════════════════════════════════════════════════ */
export default {
  cmd: "ai.photoReport",
  label: "Informe de realismo…",
  short: "Informe de realismo",
  icon: "scan",
  help: "Mide nitidez, ruido, rango dinámico, zonas lisas, metadatos y la puntuación de Plausibilidad. Se puede guardar en PDF o JSON.",
  submenu: "realismo",
  tabs: ["analizar"],
  premium: true,
  ui: "simple",
  params: [],
  load: () => import("./index.js")
};
