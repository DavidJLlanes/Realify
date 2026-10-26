/* ═══════════════════════════════════════════════════════════════
   UTILIDADES · Texto: normalizar para buscar, ASCII y UTF-8.
   Una sola copia: antes estaban repetidas, idénticas, en 3 o más archivos (fase 4 de la reorganización).
   ═══════════════════════════════════════════════════════════════ */

export const asciiAt = (u, i, n) => { let s = ""; for(let k = 0; k < n && i + k < u.length; k++) s += String.fromCharCode(u[i + k]); return s; };

export const utf8 = s => new TextEncoder().encode(s);

export const foldText = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
