/* ═══════════════════════════════════════════════════════════════
   PACKS DE CÁMARA · FLUJO
   Abre el editor a pantalla completa de plugins/camera-packs/ (cámaras con vista previa en vivo, móvil y escritorio). Aquí no hay píxeles.
   Entradas: ninguna. Salida: promesa que se resuelve al cerrar el editor.
   ═══════════════════════════════════════════════════════════════ */
export async function ejecutar(){
  const { openCameraPacks } = await import("../../../../plugins/camera-packs/index.js");
  return openCameraPacks();
}
