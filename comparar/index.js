/* ═══════════════════════════════════════════════════════════════
   ANTES Y DESPUÉS · ENTRADA
   «Antes»: el archivo original que se abrió (si el documento viene de
   un archivo) o una foto que se elige. «Después»: la imagen visible.
   El resultado se abre como capa en una pestaña nueva.
   ═══════════════════════════════════════════════════════════════ */

import { ensureShellStyles, pickFiles, decodePhoto, resultToLayer } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

async function pickPhoto(){
  const [f] = await pickFiles({ multiple: false });
  if(!f) return null;
  try{ return await decodePhoto(f, 4096); }catch(err){ toast(err.message, "err"); return null; }
}

export async function openCompare(){
  const [{ doc }, { flatten }] = await Promise.all([import("../js/core/doc.js"), import("../js/editor/layertree.js")]);
  if(!doc.open){ toast("Abre una imagen: será el «después»", "err"); return; }
  await ensureShellStyles();
  const after = flatten();
  let before = null;
  if(doc.source?.file){ try{ before = await decodePhoto(doc.source.file, 4096); }catch{} }
  if(!before){
    toast("Elige la foto original (el «antes»)");
    before = await pickPhoto();
    if(!before) return;
  }
  const { openCompareEditor } = await import("./ui.js");
  openCompareEditor({
    before, after, onPickBefore: pickPhoto,
    onAccept: async canvas => {
      await resultToLayer(canvas, { name: "Antes y después", docName: `${doc.name || "Imagen"} · antes y después`, newDocument: true });
      toast(`Imagen de antes y después en una pestaña nueva · ${canvas.width} × ${canvas.height}`, "ok");
    }
  });
}
