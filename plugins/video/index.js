/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · PUERTA DE ENTRADA
   Único archivo del módulo que el resto de la web puede cargar (con import(), desde js/app/commands/video.js). Abre el editor a pantalla completa (ui/editor.js).
   Entradas: { importar:boolean } (si es true, pide los vídeos al abrir). Salida: promesa con { cerrar() }.
   ═══════════════════════════════════════════════════════════════ */
export async function openVideo({ importar = false } = {}){
  const { abrirEditor } = await import("./ui/editor.js"), ed = abrirEditor();
  if(importar) ed.anadir();
  return ed;
}
