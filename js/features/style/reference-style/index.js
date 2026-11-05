/* ═══════════════════════════════════════════════════════════════
   ESTILO DESDE UNA FOTO · FACHADA
   Sólo conecta (≤ 40 líneas). Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
export async function openStyleFromReference(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
