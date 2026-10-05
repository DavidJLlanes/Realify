/* Una página por capa (PDF): cada capa de primer nivel visible —con su máscara, estilos y modo de fusión; un grupo, con todo lo que lleva dentro— se
   acopla sola a tamaño de documento. Las capas de ajuste no son página (retocan a las demás) y las ocultas se saltan. */
import { doc } from "../core/doc.js";
import { flatten } from "../editor/layertree.js";
import { isP3Doc, toSrgbCanvas } from "../core/colorspace.js";

export function layerPages(){
  const tops = doc.layers.filter(l => !l.groupId && l.type !== "adjust" && l.visible !== false && (l.opacity ?? 1) > 0);
  const out = [];
  for(const l of tops){
    const ids = new Set([l.id]);
    for(let again = true; again;){ again = false; for(const x of doc.layers) if(x.groupId != null && ids.has(x.groupId) && !ids.has(x.id)){ ids.add(x.id); again = true; } }
    // las capas de ajuste que cuelgan de un grupo van con él; una capa suelta no lleva ajustes
    const subset = doc.layers.filter(x => ids.has(x.id));
    let canvas = flatten(null, subset, doc.w, doc.h);
    if(isP3Doc()) canvas = toSrgbCanvas(canvas);
    out.push({ name: l.name || "Capa", canvas });
  }
  return out;
}
