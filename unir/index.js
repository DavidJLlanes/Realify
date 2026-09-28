/* ═══════════════════════════════════════════════════════════════
   UNIR · ENTRADA
   Abre el editor (con la imagen abierta disponible como una foto más)
   y lleva el resultado a una CAPA NUEVA. Como el resultado casi nunca
   mide lo mismo que el documento abierto, va a una pestaña nueva salvo
   que coincida el tamaño.
   ═══════════════════════════════════════════════════════════════ */

import { ensureShellStyles, resultToLayer } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

export async function openMerge(){
  await ensureShellStyles();
  const [{ openMergeEditor }, { doc }, { flatten }] = await Promise.all([
    import("./ui.js"), import("../js/core/doc.js"), import("../js/editor/layertree.js")]);
  const current = doc.open ? { canvas: flatten(), name: doc.name || "Imagen abierta" } : null;
  openMergeEditor({
    current,
    onAccept: async (canvas, { mode, count }) => {
      const same = doc.open && canvas.width === doc.w && canvas.height === doc.h;
      const name = mode === "pano" ? "Panorámica" : "Imágenes unidas";
      const where = await resultToLayer(canvas, { name, docName: name, newDocument: !same });
      toast(`${name} de ${count} fotos ${where === "doc" ? "en una pestaña nueva" : "en una capa nueva"} · ${canvas.width} × ${canvas.height}`, "ok");
    }
  });
}
