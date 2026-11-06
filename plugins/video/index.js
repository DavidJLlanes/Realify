/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · PUERTA DE ENTRADA
   Único archivo del módulo que el resto de la web puede cargar (con import(), desde js/app/commands/video.js). Abre el editor a pantalla completa (ui/editor.js).
   Si hay un proyecto guardado (project/guardado.js) lo recupera antes de añadir los vídeos nuevos.
   Entradas: { importar:boolean, archivos:File[] } (importar pide los vídeos al abrir; archivos son vídeos ya elegidos). Salida: promesa con { cerrar() }.
   ═══════════════════════════════════════════════════════════════ */
export async function openVideo({ importar = false, archivos = null } = {}){
  const { abrirEditor } = await import("./ui/editor.js"), ed = abrirEditor();
  await ed.restaurar();   // sigue el proyecto guardado de la sesión anterior, si lo hay
  if(archivos?.length) ed.anadir(archivos); else if(importar) ed.anadir();
  return ed;
}
