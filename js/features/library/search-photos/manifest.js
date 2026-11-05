/* ═══════════════════════════════════════════════════════════════
   BUSCAR FOTOS · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Abre el editor a pantalla completa del plugin.
   ═══════════════════════════════════════════════════════════════ */
export default {
  cmd: "ai.searchPhotos",
  label: "Buscar fotos…",
  short: "Buscar fotos",
  icon: "scan-eye",
  help: "Indexa tus fotos en este dispositivo y búscalas con una frase («perro en la playa», «de noche», «retrato en blanco y negro»). Nada sale de tu equipo.",
  submenu: "lote",
  tabs: ["analizar"],
  premium: true,
  ui: "simple",
  params: [],
  load: () => import("./index.js")
};
