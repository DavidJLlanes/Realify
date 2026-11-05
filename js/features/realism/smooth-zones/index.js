/* ═══════════════════════════════════════════════════════════════
   ZONAS LISAS · FACHADA
   Sólo conecta (≤ 40 líneas). Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
export async function openSmoothZones(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
