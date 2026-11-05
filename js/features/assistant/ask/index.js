/* ═══════════════════════════════════════════════════════════════
   ASISTENTE · FACHADA
   Sólo conecta (≤ 40 líneas). Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
export async function openAssistant(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
