/* ═══════════════════════════════════════════════════════════════
   SELECCIÓN RÁPIDA · ENTRADA
   Puerta única del plugin (js/features/library/culling abre esto con import()). Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
export async function openCulling(){
  const { openCullingEditor } = await import("./ui.js");
  return openCullingEditor();
}
