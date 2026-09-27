/* Compatibilidad para cualquier importación antigua del módulo. El motor
   real vive en un archivo independiente y se valida antes de conectarse a
   la exportación; así un fallo futuro no vuelve a bloquear el editor. */
export {
  highPrecisionCapabilities,
  highPrecisionAvailableFor,
  renderHighPrecisionCanvas,
  renderPrecisionAdjustmentStack
} from "./high-precision-next.js?v=1";
