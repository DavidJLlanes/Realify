/* ═══════════════════════════════════════════════════════════════
   BORRADO LIGERO · FACHADA
   Sólo conecta (≤ 40 líneas): abre la ventana de pincel de SAM en el modo «quick». Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
export async function openQuickErase(){
  return (await import("../../samtools.js")).openSamTool("quick");
}
