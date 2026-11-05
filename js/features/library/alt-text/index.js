/* ═══════════════════════════════════════════════════════════════
   TEXTO ALTERNATIVO · FACHADA
   Sólo conecta (≤ 40 líneas). Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
export async function openAltText(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
