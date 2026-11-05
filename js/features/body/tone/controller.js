/* ═══════════════════════════════════════════════════════════════
   DEFINICIÓN Y TONO · FLUJO
   Abre el editor de cuerpo a pantalla completa (plugins/body-editor/) en el grupo «definicion». El análisis de personas, el zoom, la vista previa
   y el resultado en capa nueva los hace el editor; aquí no hay píxeles. Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { panel } from "./ui.js";

export async function ejecutar(){
  const { openBodyEditor } = await import("../../../../plugins/body-editor/index.js");
  return openBodyEditor({ group: panel().group });
}
