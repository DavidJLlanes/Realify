/* Entrada del editor panorámico independiente. */
import { ensureShellStyles, resultToLayer } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

export async function openPanorama(){
  await ensureShellStyles();
  const [{ openPanoramaEditor }, { doc }, { flatten }] = await Promise.all([
    import("./ui.js"), import("../js/core/doc.js"), import("../js/editor/layertree.js")]);
  const current = doc.open ? { canvas: flatten(), name: doc.name || "Imagen abierta" } : null;
  openPanoramaEditor({ current, onAccept: async (canvas, { count }) => {
    const name = "Panorámica";
    const same = doc.open && canvas.width === doc.w && canvas.height === doc.h;
    const where = await resultToLayer(canvas, { name, docName: name, newDocument: !same });
    toast(`${name} de ${count} fotos ${where === "doc" ? "en una pestaña nueva" : "en una capa nueva"} · ${canvas.width} × ${canvas.height}`, "ok");
  }});
}
