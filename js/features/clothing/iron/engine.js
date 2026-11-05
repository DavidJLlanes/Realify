/* ═══════════════════════════════════════════════════════════════
   PLANCHAR ARRUGAS DE ROPA · MOTOR
   El cálculo está en js/features/clothing/engine/ (planchar, color, textura) y la selección de la tela en js/features/clothing/shared/; se
   reexporta aquí para cumplir la plantilla de una carpeta por función. Sin DOM.
   ═══════════════════════════════════════════════════════════════ */
export { etapas, planchar, texturar, recolorear, hayCambioRopa } from "../engine/index.js";
export { mascaraPrenda } from "../shared/mascara.js";
export { crecerRegion } from "../shared/region.js";
