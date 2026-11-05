/* ═══════════════════════════════════════════════════════════════
   ESTILO DESDE UNA FOTO · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Interfaz simple (≤ 4 mandos).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.styleFromReference",
  label: "Estilo desde una foto de referencia…",
  short: "Estilo de referencia",
  icon: "palette",
  help: "Elige una foto de referencia y lleva el color y el tono de tu foto hacia los suyos, por zonas (cielo, personas, resto) y en OKLab. También puede sugerir ajustes (exposición, contraste, calidez, saturación).",
  submenu: "color",
  tabs: ["color"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
