/* ═══════════════════════════════════════════════════════════════
   CÁMARAS · ENTRADA
   Mismo contrato que el Filtro Vintage (plugins/vintage/index.js):
     · openCamaras()        → abre la ventana sobre la capa activa y,
       al aplicar, crea una capa de filtro reeditable encima (id
       «camaras» en js/editor/layers/filterregistry.js).
     · renderCamaras()      → lo que llama el registro de filtros: reabre
       la ventana con los ajustes guardados, o recalcula el resultado sin
       ventana cuando cambia la capa de debajo o su porcentaje.
   ═══════════════════════════════════════════════════════════════ */

import { normalize } from "./state.js";
import { toast } from "../../js/core/toast.js";
import { doc, activeLayer } from "../../js/core/doc.js";
import { commitFilter, filterBase } from "../../js/editor/layers/filterlayer.js";

const canvasCopy = source => {
  const c = document.createElement("canvas"); c.width = source.width; c.height = source.height;
  c.getContext("2d", { willReadFrequently: true }).drawImage(source, 0, 0); return c;
};

/* Fecha del sello: la del archivo original si se conoce; si no, hoy. «'05 7 14». */
export function dateText(ms){
  const d = new Date(Number.isFinite(ms) && ms > 0 ? ms : Date.now());
  return `'${String(d.getFullYear()).slice(-2)} ${d.getMonth() + 1} ${d.getDate()}`;
}

/* La hoja de estilos se enlaza en index.html, pero el módulo no debe depender de ello: si un despliegue deja un index.html antiguo,
   la ventana se crearía sin estilos y parecería que el filtro no abre. */
function ensureStyles(){
  const href = new URL("./cameras.css", import.meta.url).href;
  if([...document.styleSheets].some(s => s.href === href) || document.querySelector('link[href$="plugins/cameras/cameras.css"]')) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

export async function openCamaras(opts = {}){
  const edit = opts.edit || null, layer = edit ? filterBase(edit) : activeLayer();
  if(!layer){ toast("No hay una capa a la que aplicar la cámara", "err"); return; }
  await ensureStyles();
  const hasInit = opts.init && Object.keys(opts.init).length > 0;
  // sin `premium` en lo guardado, la ventana usa la preferencia recordada
  const initial = { ...(hasInit ? opts.init : {}) };
  if(!initial.date) initial.date = dateText(doc.source?.file?.lastModified);
  const { openCamarasEditor } = await import("./ui.js");
  await openCamarasEditor({
    source: canvasCopy(layer.canvas), initial, edit: !!edit,
    onAccept: async (result, settings, p) => {
      commitFilter({ base: layer, edit, result, title: `Cámaras · ${p?.name || "cámara"}`, filter: "camaras", params: settings });
      toast(edit ? "Cámara actualizada" : `Cámaras · ${p?.name || "capa nueva"}`, "ok");
    }
  });
}

export async function renderCamaras({ init = {}, render, edit = null } = {}){
  if(!render) return openCamaras({ init, edit });
  const { CamarasGL } = await import("./engine.js");
  const gl = new CamarasGL();
  try{ return await gl.renderFull(render.src, normalize(init)); }
  finally{ gl.dispose(); }
}
