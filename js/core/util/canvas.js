/* ═══════════════════════════════════════════════════════════════
   UTILIDADES · Lectura de píxeles de un lienzo.
   Una sola copia: antes estaban repetidas, idénticas, en 3 o más archivos (fase 4 de la reorganización).
   ═══════════════════════════════════════════════════════════════ */

export const readPixels = c => c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
