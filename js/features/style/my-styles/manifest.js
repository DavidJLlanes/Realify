/* ═══════════════════════════════════════════════════════════════
   MIS ESTILOS · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Interfaz simple (4 mandos).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.myStyles",
  label: "Mis estilos…",
  short: "Mis estilos",
  icon: "heart",
  help: "Guarda el color y el tono de una foto de referencia como estilo, aplícalo a esta foto o a todas las abiertas, y pásalo a otra persona o ordenador como archivo.",
  submenu: "color",
  tabs: ["estilo"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
