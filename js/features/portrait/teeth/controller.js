/* ═══════════════════════════════════════════════════════════════
   DIENTES · FLUJO
   Abre el editor de cara a pantalla completa (plugins/face-editor/) en el grupo «Dientes». El análisis, el zoom a la cara, la vista previa
   y el resultado en capa nueva los hace el editor; aquí no hay píxeles. Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { panel } from "./ui.js";

export async function ejecutar(){
  const { openFaceEditor } = await import("../../../../plugins/face-editor/index.js");
  return openFaceEditor({ group: panel().group });
}
