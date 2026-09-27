/* ═══════════════════════════════════════════════════════════════
   MOVER SEGÚN EL CONTENIDO
   Arrastra lo seleccionado a otro sitio del lienzo Y rellena el hueco
   que deja, las dos cosas en el mismo gesto: sin esto, mover un objeto
   son dos pasos sueltos —cortar/pegar, y luego «Rellenar según el
   contenido» a mano sobre el hueco—, con el riesgo de que la selección
   ya no coincida para cuando se acuerda uno del segundo paso.

   Comparte motor con «Rellenar según el contenido» (fillcontent.js):
   el hueco de origen se sintetiza con el mismo PatchMatch, sobre el
   mismo recorte de trabajo. Lo nuevo aquí es pegar el trozo movido en
   el destino con un desvanecido en su propio borde —el mismo criterio
   que el feather del relleno, sólo que fundiéndose con lo que YA haya
   en destino en vez de con un desenfoque de sí mismo—, para que la
   costura tampoco se note ahí.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { toast, status } from "../ui/toast.js";
import { featherMask } from "./selection.js";
import { fillContentAwarePatchMatch, cropRGBA, cropMask } from "./fillcontent.js";

/* Pega `floatRGBA`/`floatMask` (tamaño fw×fh) sobre `img` en
   (dstX,dstY), desvanecido hacia lo que YA hay ahí en vez de hacia un
   desenfoque de sí mismo —a diferencia del relleno, aquí el destino
   puede ser una zona con su propio contenido significativo, no un
   agujero que rellenar—. */
function pasteFloating(img, floatRGBA, floatMask, w, h, dstX, dstY, fw, fh){
  const feather = featherMask(floatMask, fw, fh, 5);
  const d = img.data;
  for(let y = 0; y < fh; y++){
    const gy = dstY + y;
    if(gy < 0 || gy >= h) continue;
    for(let x = 0; x < fw; x++){
      const gx = dstX + x;
      if(gx < 0 || gx >= w) continue;
      const li = y * fw + x;
      if(floatMask[li] === 0) continue;
      const t = (feather[li] / 255) * (floatMask[li] / 255);
      if(t <= 0) continue;
      const gi = (gy * w + gx) * 4, li4 = li * 4;
      d[gi]   = d[gi]   * (1 - t) + floatRGBA[li4]   * t;
      d[gi+1] = d[gi+1] * (1 - t) + floatRGBA[li4+1] * t;
      d[gi+2] = d[gi+2] * (1 - t) + floatRGBA[li4+2] * t;
    }
  }
}

function snapshotCanvas(layer){
  const c = document.createElement("canvas");
  c.width = layer.canvas.width; c.height = layer.canvas.height;
  c.getContext("2d").drawImage(layer.canvas, 0, 0);
  return c;
}
function restoreCanvas(layer, snap){
  layer.ctx.save(); layer.ctx.globalCompositeOperation = "copy";
  layer.ctx.drawImage(snap, 0, 0); layer.ctx.restore();
  layer.thumbDirty = true;
}

/* Traslada una máscara —del tamaño del documento— por (dx,dy), sin
   envolver en los bordes: lo que se sale, se pierde, como cualquier
   arrastre. Es la selección movida junto con el contenido. */
function shiftMask(mask, w, h, dx, dy){
  const out = new Uint8ClampedArray(w * h);
  for(let y = 0; y < h; y++){
    const sy = y - dy;
    if(sy < 0 || sy >= h) continue;
    for(let x = 0; x < w; x++){
      const sx = x - dx;
      if(sx < 0 || sx >= w) continue;
      out[y*w+x] = mask[sy*w+sx];
    }
  }
  return out;
}

/**
 * Ejecuta el movimiento completo: recorta el contenido bajo la
 * selección, rellena ese hueco con PatchMatch, pega el recorte
 * desplazado (dx,dy) y mueve la selección con él —todo en un único
 * paso de historial—. `dx`/`dy` en píxeles del documento, ya
 * redondeados.
 */
export function moveContentAware(layer, selMask, bounds, dx, dy){
  if(!dx && !dy) return;
  status("Moviendo…");

  const w = layer.canvas.width, h = layer.canvas.height;
  const before = snapshotCanvas(layer);
  const beforeSel = selMask;

  const img = layer.ctx.getImageData(0, 0, w, h);
  const floatRGBA = cropRGBA(img, w, bounds);
  const floatMask = cropMask(selMask, w, bounds);

  // 1. el hueco que deja el objeto en su sitio de origen, sintetizado.
  fillContentAwarePatchMatch(img, selMask, w, h, bounds, {});

  // 2. el objeto, pegado en su nuevo sitio, fundido con lo que haya.
  pasteFloating(img, floatRGBA, floatMask, w, h, bounds.x + dx, bounds.y + dy, bounds.w, bounds.h);

  layer.ctx.putImageData(img, 0, 0);
  layer.thumbDirty = true;
  status("");

  const after = snapshotCanvas(layer);
  const afterSel = shiftMask(selMask, w, h, dx, dy);

  const apply = (canvasSnap, sel) => {
    restoreCanvas(layer, canvasSnap);
    doc.selection = sel ? { mask: sel, w, h } : null;
    emit("doc:change"); emit("sel:change");
  };
  record("Mover según el contenido",
    () => apply(before, beforeSel),
    () => apply(after, afterSel));

  doc.selection = { mask: afterSel, w, h };
  emit("doc:structure"); emit("doc:change"); emit("sel:change");
  toast("Movido", "ok");
}
