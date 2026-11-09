/* ═══════════════════════════════════════════════════════════════
   UTILIDADES · Escape de texto para HTML.
   Una sola copia: antes estaban repetidas, idénticas, en 3 o más archivos (fase 4 de la reorganización).
   ═══════════════════════════════════════════════════════════════ */

export const escAttr = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export const escText = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/* Escapa & < > " para meter texto en innerHTML (atributos y contenido). */
export const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
