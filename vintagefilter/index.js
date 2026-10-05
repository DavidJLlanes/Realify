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
import { attachFloatResult } from "../js/editor/floatfilter.js";
import { hiCoversCanvas } from "../js/core/hisrc.js";

const canvasCopy = source => {
  const c = document.createElement("canvas"); c.width = source.width; c.height = source.height;
  c.getContext("2d", { willReadFrequently: true }).drawImage(source, 0, 0); return c;
};

/* Fecha del sello: la del archivo original si se conoce; si no, hoy. */
const stampDate = () => dateText(doc.source?.file?.lastModified);

/* La hoja de estilos se enlaza en index.html, pero el módulo no debe
   depender de ello: si un despliegue deja un index.html antiguo, la
   ventana se crearía sin estilos —sin `position:fixed`, al final de la
   página y fuera de la vista— y parecería que el filtro no abre. */
function ensureStyles(){
  const href = new URL("./vintage.css", import.meta.url).href;
  if([...document.styleSheets].some(s => s.href === href) ||
     document.querySelector('link[href$="vintagefilter/vintage.css"]')) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

export async function openVintageFilter(opts = {}){
  const edit = opts.edit || null, layer = edit ? filterBase(edit) : activeLayer();
  if(!layer){ toast("No hay una capa a la que aplicar el filtro", "err"); return; }
  await ensureStyles();
  const initial = normalize(opts.init);
  if(!initial.date) initial.date = stampDate();
  const { openVintageEditor } = await import("./ui.js");
  openVintageEditor({
    source: canvasCopy(layer.canvas), initial,
    hiSrc: hiCoversCanvas(layer) ? layer.hiSrc : null,       // con 16 bits en el origen, el resultado también los conserva
    onAccept: async (result, settings) => {
      const made = commitFilter({ base: layer, edit, result, title: "Filtro Vintage", filter: "vintage", params: settings });
      const hi = result._hi;
      if(hi && made) attachFloatResult(made, { hiSrc: { dither: true } }, { canvas: result, hi, rect: { x: 0, y: 0, w: result.width, h: result.height } });
      else if(made && edit) delete made.hiSrc;
      toast((edit ? "Filtro Vintage actualizado" : "Filtro Vintage · capa nueva") + (hi ? " · 16 bits conservados" : ""), "ok");
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
