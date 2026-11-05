/* ═══════════════════════════════════════════════════════════════
   PACKS DE CÁMARA · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Interfaz simple (≤ 4 mandos).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.cameraPacks",
  label: "Packs de cámara…",
  short: "Packs de cámara",
  icon: "camera",
  help: "Elige un estilo de película analógica, de móvil o de réflex/óptica y se aplica como capa de filtro reeditable (con el motor de Cámaras). Al ser una capa de filtro, «Aplicar esta edición a otras fotos» la copia a un lote.",
  submenu: "color",
  tabs: ["estilo"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
