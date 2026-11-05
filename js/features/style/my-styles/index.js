/* ═══════════════════════════════════════════════════════════════
   MIS ESTILOS · FACHADA
   Sólo conecta (≤ 40 líneas). Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
export async function openMyStyles(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
