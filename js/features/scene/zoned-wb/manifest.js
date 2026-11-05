/* ═══════════════════════════════════════════════════════════════
   BALANCE DE BLANCOS POR ZONAS · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   Interfaz simple (4.7 del plan): pocos mandos en un diálogo.
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.zonedWhiteBalance",
  label: "Balance de blancos por zonas…",
  short: "Blancos zonas",
  icon: "thermometer",
  help: "Estima el iluminante de cada zona de la foto y lo corrige por separado: sirve con luz mezclada (ventana fría y lámpara cálida).",
  submenu: "escena",
  tabs: ["color"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
