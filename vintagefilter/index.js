/* ═══════════════════════════════════════════════════════════════
   FILTRO VINTAGE · ENTRADA
   Mismo contrato que el revelador fotográfico (raw/index.js):
     · openVintageFilter()   → abre la ventana sobre la capa activa y,
       al aplicar, crea una capa de filtro reeditable encima
       (id «vintage» en js/editor/filterregistry.js).
     · renderVintageFilter() → lo que llama el registro de filtros:
       reabre la ventana con los ajustes guardados, o recalcula el
       resultado sin ventana cuando cambia la capa de debajo o su
       porcentaje de aplicación.
   ═══════════════════════════════════════════════════════════════ */

import { normalize } from "./state.js";
import { dateText } from "./overlays.js";
import { toast } from "../js/ui/toast.js";
import { doc, activeLayer } from "../js/core/doc.js";
import { commitFilter, filterBase } from "../js/editor/filterlayer.js";

const canvasCopy = source => {
  const c = document.createElement("canvas"); c.width = source.width; c.height = source.height;
  c.getContext("2d", { willReadFrequently: true }).drawImage(source, 0, 0); return c;
};

/* Fecha del sello: la del archivo original si se conoce; si no, hoy. */
const stampDate = () => dateText(doc.source?.file?.lastModified);

export async function openVintageFilter(opts = {}){
  const edit = opts.edit || null, layer = edit ? filterBase(edit) : activeLayer();
  if(!layer){ toast("No hay una capa a la que aplicar el filtro", "err"); return; }
  const initial = normalize(opts.init);
  if(!initial.date) initial.date = stampDate();
  const { openVintageEditor } = await import("./ui.js");
  openVintageEditor({
    source: canvasCopy(layer.canvas), initial,
    onAccept: async (result, settings) => {
      commitFilter({ base: layer, edit, result, title: "Filtro Vintage", filter: "vintage", params: settings });
      toast(edit ? "Filtro Vintage actualizado" : "Filtro Vintage · capa nueva", "ok");
    }
  });
}

export async function renderVintageFilter({ init = {}, render, edit = null } = {}){
  if(!render) return openVintageFilter({ init, edit });
  const { VintageGL } = await import("./engine.js");
  const gl = new VintageGL();
  try{ return await gl.renderFull(render.src, normalize(init)); }
  finally{ gl.dispose(); }
}
