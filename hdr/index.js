/* ═══════════════════════════════════════════════════════════════
   HDR · ENTRADA
   Abre el editor HDR (con la imagen abierta disponible como una foto
   más del horquillado) y, al crear, lleva el resultado a una CAPA
   NUEVA: en el documento abierto si la imagen abierta formaba parte
   del horquillado o mide lo mismo; si no, en una pestaña nueva.
   ═══════════════════════════════════════════════════════════════ */

import { ensureShellStyles, resultToLayer } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

export async function openHdr(){
  await ensureShellStyles();
  const [{ openHdrEditor }, { doc }, { flatten }] = await Promise.all([
    import("./ui.js"), import("../js/core/doc.js"), import("../js/editor/layertree.js")]);
  const current = doc.open ? { canvas: flatten(), name: doc.name || "Imagen abierta", file: doc.source?.file || null } : null;
  openHdrEditor({
    current,
    onAccept: async (canvas, { usedCurrent, count, style }) => {
      const sameSize = doc.open && canvas.width === doc.w && canvas.height === doc.h;
      const where = await resultToLayer(canvas, {
        name: `HDR · ${style}`, docName: "HDR",
        newDocument: !(usedCurrent || sameSize)
      });
      toast(where === "doc" ? `HDR de ${count} ${count === 1 ? "foto" : "fotos"} creado en una pestaña nueva · ${canvas.width} × ${canvas.height}`
                            : `HDR de ${count} ${count === 1 ? "foto" : "fotos"} en una capa nueva`, "ok");
    }
  });
}
