/* ═══════════════════════════════════════════════════════════════
   TEXTURA DE TEJIDO · FACHADA
   Sólo conecta (≤ 40 líneas): abre la función. Entradas: ninguna. Salida: promesa que se resuelve al terminar.
   ═══════════════════════════════════════════════════════════════ */
export async function openFabricTexture(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
