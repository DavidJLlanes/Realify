/* ═══════════════════════════════════════════════════════════════
   COLOCAR TEXTO EN LA ZONA LIBRE · FACHADA
   Sólo conecta (≤ 40 líneas). Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
export async function openTextPlacement(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
