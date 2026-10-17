/* ═══════════════════════════════════════════════════════════════
   EFECTOS LUT · ENTRADA
   Mismo contrato que Cámaras y el Filtro Vintage:
     · openLuts()    → abre la ventana sobre la capa activa y, al aplicar,
       crea una capa de filtro reeditable encima (id «luts» en
       js/editor/filterregistry.js).
     · renderLuts()  → lo que llama el registro de filtros: reabre la
       ventana con los ajustes guardados, o recalcula el resultado sin
       ventana cuando cambia la capa de debajo o su porcentaje.
   La capa guarda sólo el id de la tabla, la intensidad y el modo; la
   tabla se vuelve a descargar de lut/files/ cuando hace falta.
   ═══════════════════════════════════════════════════════════════ */

import { toast } from "../js/ui/toast.js";
import { activeLayer } from "../js/core/doc.js";
import { commitFilter, filterBase } from "../js/editor/filterlayer.js";

const canvasCopy = source => {
  const c = document.createElement("canvas"); c.width = source.width; c.height = source.height;
  c.getContext("2d", { willReadFrequently: true }).drawImage(source, 0, 0); return c;
};

/* La hoja de estilos se enlaza en index.html, pero el módulo no debe depender de ello. */
function ensureStyles(){
  const href = new URL("./lut.css", import.meta.url).href;
  if([...document.styleSheets].some(s => s.href === href) || document.querySelector('link[href$="lut/lut.css"]')) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

export async function openLuts(opts = {}){
  const edit = opts.edit || null, layer = edit ? filterBase(edit) : activeLayer();
  if(!layer){ toast("No hay una capa a la que aplicar el efecto", "err"); return; }
  await ensureStyles();
  const initial = opts.init && Object.keys(opts.init).length ? { ...opts.init } : null;   // sin `premium` en lo guardado, la ventana usa la preferencia recordada
  const { openLutEditor } = await import("./ui.js");
  await openLutEditor({
    source: canvasCopy(layer.canvas), initial, edit: !!edit,
    onAccept: async (result, settings, item) => {
      commitFilter({ base: layer, edit, result, title: `Efectos LUT · ${item?.name || "efecto"}`, filter: "luts", params: settings });
      toast(edit ? "Efecto actualizado" : `Efectos LUT · ${item?.name || "capa nueva"}`, "ok");
    }
  });
}

export async function renderLuts({ init = {}, render, edit = null } = {}){
  if(!render) return openLuts({ init, edit });
  const [{ LutGL, loadLut }, { normalize, lutItem }] = await Promise.all([import("./engine.js"), import("./ui.js")]);
  const state = normalize(init), it = lutItem(state.id);
  if(!it) throw new Error("La tabla de color de esta capa ya no existe");
  const gl = new LutGL();
  try{ return await gl.renderFull(render.src, await loadLut(it.fam, it.id), state); }
  finally{ gl.dispose(); }
}
