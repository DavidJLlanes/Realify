/* ═══════════════════════════════════════════════════════════════
   ASISTENTE · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Interfaz simple (1 mando) + confirmación del plan.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.assistant",
  label: "Asistente de edición…",
  short: "Asistente",
  icon: "wand",
  help: "Escribe lo que quieres («más cálida y con grano», «quita la neblina y mejora el cielo»), mira el plan y aplícalo. Todo va en capas que puedes retocar o deshacer.",
  submenu: "asistente",
  tabs: ["mejorar"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
