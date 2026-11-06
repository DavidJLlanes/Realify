/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · PUERTA DE ENTRADA
   Único archivo del módulo que el resto de la web puede cargar (con import(), desde js/app/commands/video.js). Abre el editor a pantalla completa (ui/editor.js).
   Todavía no hay entrada de menú (F15.8). Entradas: ninguna. Salida: promesa con { cerrar() }.
   ═══════════════════════════════════════════════════════════════ */
export async function openVideo(){
  const { abrirEditor } = await import("./ui/editor.js");
  return abrirEditor();
}
