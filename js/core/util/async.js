/* ═══════════════════════════════════════════════════════════════
   UTILIDADES · Utilidades asíncronas.
   Una sola copia: antes estaban repetidas, idénticas, en 3 o más archivos (fase 4 de la reorganización).
   ═══════════════════════════════════════════════════════════════ */

export const nextTask = () => new Promise(r => setTimeout(r, 0));
