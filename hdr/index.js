/* ═══════════════════════════════════════════════════════════════
   HDR · ENTRADA
   Abre el editor HDR (con la imagen abierta disponible como una foto
   más del horquillado) y, al crear, abre el resultado SIEMPRE como una
   foto recién abierta: pestaña propia, una sola capa, historial vacío
   y ese HDR como «antes» de Comparar. (Antes, si la imagen abierta era
   del horquillado, se añadía como capa encima de ella y Comparar
   enseñaba la foto original en vez del HDR.)
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
    onAccept: async (canvas, { count, style }) => {
      await resultToLayer(canvas, { name: `HDR · ${style}`, docName: "HDR", newDocument: true });
      toast(`HDR de ${count} ${count === 1 ? "foto" : "fotos"} abierto como foto nueva · ${canvas.width} × ${canvas.height}`, "ok");
    }
  });
}
