/* ═══════════════════════════════════════════════════════════════
   MANOS Y DIENTES SOSPECHOSOS · FACHADA
   Sólo conecta (≤ 40 líneas). Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
export async function openAiArtifacts(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
