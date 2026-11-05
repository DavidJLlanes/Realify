/* ═══════════════════════════════════════════════════════════════
   AI-KIT · SESIÓN DE IA
   Punto único desde el que las funciones nuevas abren una sesión de IA con ventana de progreso y botón de cancelar
   (aiSession) y la protección contra cierres por falta de memoria (withHeavyGuard). La lógica vive en js/ai/runtime.js.
   ═══════════════════════════════════════════════════════════════ */

export { aiSession, withHeavyGuard, runModel } from "../../ai/runtime.js";
