/* ═══════════════════════════════════════════════════════════════
   BUSCAR FOTOS · ENTRADA
   Puerta única del plugin (js/features/library/search-photos abre esto con import()). Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
export async function openPhotoSearch(){
  const { openPhotoSearchEditor } = await import("./ui.js");
  return openPhotoSearchEditor();
}
