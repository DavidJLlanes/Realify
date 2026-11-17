/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · ATAJOS DE TECLADO (escritorio)
   Ctrl/⌘+Z deshacer, Ctrl/⌘+Mayús+Z o Ctrl+Y rehacer, Ctrl/⌘+O abrir, Ctrl/⌘+S guardar copia.
   Entradas: montarAtajos({ abrir, guardar }). Salidas: nada. Límites: se ignoran mientras se escribe en un campo.
   ═══════════════════════════════════════════════════════════════ */
import { deshacer, rehacer } from "../app/session.js";

export function montarAtajos({ abrir, guardar }) {
  addEventListener("keydown", e => {
    if (!(e.ctrlKey || e.metaKey) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    const accion = k === "z" ? (e.shiftKey ? rehacer : deshacer) : k === "y" ? rehacer : k === "o" ? abrir : k === "s" ? guardar : null;
    if (accion) { e.preventDefault(); accion(); }
  });
}
