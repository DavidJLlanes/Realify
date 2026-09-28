/* ═══════════════════════════════════════════════════════════════
   FORMAS · ENTRADA
   Recorta la imagen visible (o, sin documento, una foto que se elige)
   con una forma y lleva el resultado, con transparencia fuera, a una
   CAPA NUEVA del documento o a una pestaña nueva recortada a la forma.
   El documento de partida no se toca.
   ═══════════════════════════════════════════════════════════════ */

import { ensureShellStyles, pickFiles, decodePhoto, resultToLayer } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

export async function openShapes(){
  await ensureShellStyles();
  const [{ openShapeEditor }, { doc }, { flatten }] = await Promise.all([
    import("./ui.js"), import("../js/core/doc.js"), import("../js/editor/layertree.js")]);
  let source, fromDoc = doc.open, name = doc.name || "Imagen";
  if(fromDoc) source = flatten();
  else {
    const [file] = await pickFiles({ multiple: false });
    if(!file) return;
    try{ source = await decodePhoto(file, 8192); }catch(err){ toast(err.message, "err"); return; }
    name = file.name.replace(/\.[^.]+$/, "");
  }
  openShapeEditor({
    source, canLayer: fromDoc,
    onAccept: async (canvas, { output, bounds, name: shapeName }) => {
      if(output === "layer"){
        await resultToLayer(canvas, { name: `Forma · ${shapeName}` });
        toast(`Recorte en forma de ${shapeName.toLowerCase()} en una capa nueva`, "ok");
        return;
      }
      const c = document.createElement("canvas"); c.width = bounds.w; c.height = bounds.h;
      c.getContext("2d").drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
      await resultToLayer(c, { name: `Forma · ${shapeName}`, docName: `${name} · ${shapeName}`, newDocument: true });
      toast(`Recorte en forma de ${shapeName.toLowerCase()} en una pestaña nueva · ${c.width} × ${c.height}`, "ok");
    }
  });
}
