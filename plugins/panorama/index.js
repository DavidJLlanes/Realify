/* Entrada del editor panorámico independiente. */
import { ensureShellStyles, resultToLayer } from "../../js/ui/kit/fsshell.js";
import { toast } from "../../js/core/toast.js";

async function ensurePanoramaStyles(){
  const href = new URL("./style.css", import.meta.url).href;
  if([...document.querySelectorAll('link[rel="stylesheet"]')].some(l => l.href === href)) return;
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

export async function openPanorama(){
  await Promise.all([ensureShellStyles(), ensurePanoramaStyles()]);
  const [{ openPanoramaEditor }, { doc }, { flatten }] = await Promise.all([
    import("./ui.js"), import("../../js/core/doc.js"), import("../../js/editor/layers/layertree.js")]);
  const current = doc.open ? { canvas: flatten(), name: doc.name || "Imagen abierta" } : null;
  openPanoramaEditor({ current, onAccept: async (canvas, { count }) => {
    const name = "Panorámica";
    const same = doc.open && canvas.width === doc.w && canvas.height === doc.h;
    const where = await resultToLayer(canvas, { name, docName: name, newDocument: !same });
    toast(`${name} de ${count} fotos ${where === "doc" ? "en una pestaña nueva" : "en una capa nueva"} · ${canvas.width} × ${canvas.height}`, "ok");
  }});
}
