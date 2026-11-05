/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CUERPO · PUERTA
   Editor de cuerpo a pantalla completa con zoom en la persona (4.7 del plan, Fase 6). Entradas: { group } = grupo que se abre.
   Salida: promesa que se resuelve al cerrar el editor.
   ═══════════════════════════════════════════════════════════════ */
export async function openBodyEditor(opts = {}){
  const { abrirEditorCuerpo } = await import("./editor.js");
  return abrirEditorCuerpo(opts);
}
