/* ═══════════════════════════════════════════════════════════════
   CAMBIAR COLOR DE PRENDAS · FACHADA
   Sólo conecta (≤ 40 líneas): abre la función. Entradas: ninguna. Salida: promesa que se resuelve al terminar.
   ═══════════════════════════════════════════════════════════════ */
export async function openRecolorClothes(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
