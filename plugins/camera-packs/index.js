/* ═══════════════════════════════════════════════════════════════
   PACKS DE CÁMARA · PUERTA
   Editor a pantalla completa (estilo collage, sobre js/ui/kit/ai-editor/) para elegir una cámara y ver el resultado al momento. Entradas: ninguna.
   Salida: promesa que se resuelve al cerrar el editor.
   ═══════════════════════════════════════════════════════════════ */
export async function openCameraPacks(opts = {}){
  const { abrirEditorPacks } = await import("./editor.js");
  return abrirEditorPacks(opts);
}
