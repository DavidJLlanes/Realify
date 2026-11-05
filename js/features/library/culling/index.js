/* ═══════════════════════════════════════════════════════════════
   SELECCIÓN RÁPIDA · FACHADA
   Sólo conecta (≤ 40 líneas) con el plugin. Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
export async function openCulling(){
  const { openCulling: abrir } = await import("../../../../plugins/culling/index.js");
  return abrir();
}
