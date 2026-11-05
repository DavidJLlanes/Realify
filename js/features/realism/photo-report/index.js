/* ═══════════════════════════════════════════════════════════════
   INFORME DE REALISMO · FACHADA
   Sólo conecta (≤ 40 líneas). Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
export async function openPhotoReport(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
