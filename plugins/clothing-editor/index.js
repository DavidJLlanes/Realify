/* ═══════════════════════════════════════════════════════════════
   EDITOR DE ROPA · PUERTA
   Editor de ropa y tejidos a pantalla completa con zoom en la prenda (4.7 del plan, Fase 7). Entradas: { group } = grupo que se abre.
   Salida: promesa que se resuelve al cerrar el editor.
   ═══════════════════════════════════════════════════════════════ */
export async function openClothingEditor(opts = {}){
  const { abrirEditorRopa } = await import("./editor.js");
  return abrirEditorRopa(opts);
}
