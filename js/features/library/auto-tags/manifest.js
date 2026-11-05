/* ═══════════════════════════════════════════════════════════════
   ETIQUETAS AUTOMÁTICAS · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Interfaz simple (2 mandos) + informe.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.autoTags",
  label: "Etiquetas y nombre…",
  short: "Etiquetas",
  icon: "type",
  help: "La IA describe la foto con etiquetas en español (tipo, objetos, colores) y propone un nombre de archivo con una plantilla: {fecha}, {etiqueta}, {color}, {n}…",
  submenu: "lote",
  tabs: ["analizar"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
