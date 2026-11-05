/* ═══════════════════════════════════════════════════════════════
   FORMA DE LA CARA · FACHADA
   Sólo conecta (≤ 40 líneas): abre la función. Entradas: ninguna. Salida: promesa que se resuelve al terminar.
   ═══════════════════════════════════════════════════════════════ */
export async function openFaceShape(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
