/* ═══════════════════════════════════════════════════════════════
   BUSCAR FOTOS · FACHADA
   Sólo conecta (≤ 40 líneas) con el plugin. Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
export async function openSearchPhotos(){
  const { openPhotoSearch } = await import("../../../../plugins/photo-search/index.js");
  return openPhotoSearch();
}
