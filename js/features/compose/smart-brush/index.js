/* ═══════════════════════════════════════════════════════════════
   PINCEL INTELIGENTE · FACHADA
   Sólo conecta (≤ 40 líneas): abre la ventana de pincel de SAM en el modo «brush». Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
export async function openSmartBrush(){
  return (await import("../../samtools.js")).openSamTool("brush");
}
