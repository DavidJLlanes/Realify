/* ═══════════════════════════════════════════════════════════════
   MANOS Y DIENTES SOSPECHOSOS · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Informa en un diálogo (js/features/ai-kit/report-host.js), sin mandos.
   ══════════════════════════════════════════════════════════════ */
export default {
  cmd: "ai.aiArtifacts",
  label: "Manos y dientes sospechosos…",
  short: "Manos y dientes",
  icon: "scan-eye",
  help: "Revisa las manos (proporciones, dedos, articulaciones) y los dientes (separaciones) de las personas de la foto y te avisa de lo que parece generado. Solo avisa: no corrige nada.",
  submenu: "realismo",
  tabs: ["analizar"],
  premium: true,
  ui: "simple",
  params: [],
  load: () => import("./index.js")
};
