/* ═══════════════════════════════════════════════════════════════
   SELECCIONAR PARTES · FLUJO
   Imagen visible → análisis de personas → panel (parte, persona, borde, resultado) → máscara a tamaño del documento → selección
   nueva o máscara de la capa activa. Nada de píxeles aquí: los calcula engine.js.
   ═══════════════════════════════════════════════════════════════ */
import { doc, activeLayer } from "../../../core/doc.js";
import { toast } from "../../../core/toast.js";
import { visibleImage } from "../../ai-kit/visible-image.js";
import { openSimple } from "../../ai-kit/simple-host.js";
import { analizarPersonas } from "./analysis.js";
import { composeParts } from "./engine.js";
import { personasRef } from "./params.js";
import { panel } from "./ui.js";

export async function ejecutar(){
  const src = await visibleImage(); if(!src) return;
  let res;
  try{ res = await analizarPersonas(src); }
  catch(err){ if(!err.cancelled) toast("No se pudo analizar la foto: " + (err.message || err), "err"); return; }
  const personas = res.personas.filter(p => p.partes);
  if(!personas.length){ toast("No he encontrado ninguna persona en la foto", "err"); return; }
  personasRef.n = personas.length;

  const r = await openSimple({ ...panel() });
  if(!r.ok) return;
  const { mask, cubierto } = composeParts(personas, r.values, doc.w, doc.h);
  if(cubierto < 0.0005){ toast("No he encontrado esa parte en la foto", "err"); return; }
  const etiqueta = (panel().params[0].options.find(o => o[0] === r.values.parte) || [])[1] || "parte";
  if(r.values.salida === "mask"){
    const { setMaskFromArray, setMaskTarget } = await import("../../../editor/layers/masks.js");
    const layer = activeLayer();
    if(!layer || !setMaskFromArray(layer, mask, "Máscara · " + etiqueta)){ toast("No se pudo poner la máscara en esa capa", "err"); return; }
    setMaskTarget(layer.id);
    toast(`Máscara «${etiqueta}» puesta en «${layer.name}»`, "ok");
  } else {
    const { commitSelection } = await import("../../../editor/selection/selection.js");
    commitSelection(mask, "new");
    toast(`Selección «${etiqueta}» lista (${(100 * cubierto).toFixed(0)} % de la foto)`, "ok");
  }
}
