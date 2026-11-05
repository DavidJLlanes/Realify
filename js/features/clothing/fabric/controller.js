/* ═══════════════════════════════════════════════════════════════
   ARRUGAS DE TELAS Y FONDOS · FLUJO
   Abre el editor de ropa a pantalla completa (plugins/clothing-editor/) en el grupo «planchar». El análisis, el zoom, la vista previa y el
   resultado en capa nueva los hace el editor; aquí no hay píxeles. Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { panel } from "./ui.js";

export async function ejecutar(){
  const { openClothingEditor } = await import("../../../../plugins/clothing-editor/index.js");
  const { group, telas } = panel();
  return openClothingEditor({ group, telas });
}
