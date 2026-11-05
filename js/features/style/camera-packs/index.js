/* ═══════════════════════════════════════════════════════════════
   PACKS DE CÁMARA · FACHADA
   Sólo conecta (≤ 40 líneas). Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
export async function openCameraPacks(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
