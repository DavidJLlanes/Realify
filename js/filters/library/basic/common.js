/* ═══════════════════════════════════════════════════════════════
   basic · piezas que usan varios bloques
   Parte de js/filters/library/basic.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { emit } from "../../../core/bus.js";
import { doc, activeLayer } from "../../../core/doc.js";
import { blendBySelection } from "../../../editor/selection/selection.js";
import { toast } from "../../../core/toast.js";
import { filterBase, commitFilter } from "../../../editor/layers/filterlayer.js";
import { hiFullCover, colorFnFromFilter, applyNativeFromBase, applyDeltaFromBase, attachFloatResult } from "../../../editor/render/floatfilter.js";
import { applyFloatFromBase } from "../../../editor/render/floatadjust.js";
import { dialog } from "../../../ui/kit/dialog.js";
import { isMobile, COARSE } from "../../../core/device.js";

function snapshot(layer){
  const c = document.createElement("canvas");
  c.width = layer.canvas.width; c.height = layer.canvas.height;
  // Se relee con getImageData (recorte a la selección): con esta opción
  // el navegador lo guarda en CPU y no avisa en la consola.
  c.getContext("2d", { willReadFrequently: true }).drawImage(layer.canvas, 0, 0);
  return c;
}

function restore(layer, snap){
  const x = layer.ctx;
  x.save(); x.globalCompositeOperation = "copy";
  x.drawImage(snap, 0, 0); x.restore();
  layer.thumbDirty = true;
  emit("doc:change");
}

/* A diferencia de los ajustes (adjust.js), un filtro no siempre
   escribe sus píxeles a través de una tabla: el desenfoque nativo, por
   ejemplo, deja que el propio navegador dibuje con `ctx.filter`. No
   hay un `data` común al que mezclar antes de escribir, así que la
   selección se aplica DESPUÉS, releyendo lo que `apply` acaba de
   dejar en el lienzo y devolviendo a su color original lo que caiga
   fuera de la máscara. Cuesta una lectura de más por fotograma, pero
   es el único punto que vale para cualquier filtro, escriba como
   escriba. */
function clipToSelection(layer, beforeCanvas){
  if(!doc.selection) return;
  const w = layer.canvas.width, h = layer.canvas.height;
  const now = layer.ctx.getImageData(0, 0, w, h);
  const bx = beforeCanvas.getContext("2d", { willReadFrequently: true });
  const orig = bx.getImageData(0, 0, w, h);
  blendBySelection(now.data, orig.data, doc.selection, w, h);
  layer.ctx.putImageData(now, 0, 0);
}

/* Esqueleto común: original guardado, vista previa por fotograma,
   historial en un solo paso, cancelar deja la capa intacta.

   La vista previa sigue escribiendo sobre la propia capa —es la única
   forma de verla en el lienzo mientras se mueven los mandos—, pero al
   aceptar se deshace ese trazo y el resultado se lleva a una capa
   nueva: la de origen acaba tan intacta como si se hubiera cancelado.
   Ver editor/layers/filterlayer.js.

   `apply(layer, src, isFinal)` recibe además si esta llamada es la
   FINAL (al aceptar, o la única del propio `res!=="go"` de más abajo)
   o una de las muchas de la vista previa en vivo. Los filtros con un
   bucle CPU caro (Enfocar, Detalle y estructura) usan esa bandera
   para trabajar sobre una copia reducida mientras se arrastra un
   deslizador y sólo recalcular a resolución completa cuando de verdad
   hace falta guardar el resultado; los demás (el desenfoque nativo,
   que ya va por GPU) la ignoran sin más. */
export async function runFilter({ title, build, apply, wide = false, id, params, asyncRefine = false, float = false, native = null }, opts = {}){
  /* Modo sin diálogo: el registro de filtros pide el resultado para
     un lienzo cualquiera (deslizador de aplicación de la capa). */
  if(opts.render){
    const src = opts.render.src;
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const fake = { canvas: c, ctx: c.getContext("2d", { willReadFrequently: true }) };
    await Promise.resolve(apply(fake, src, opts.render.isFinal !== false));
    return c;
  }

  const edit = opts.edit || null;
  const layer = edit || activeLayer();
  if(!layer){ toast("No hay capa activa"); return; }
  if(layer.locked){ toast("La capa está bloqueada"); return; }
  /* Una capa de ajuste no tiene píxeles propios: filtrarla daría una
     capa nueva en blanco sin que se entienda por qué. */
  if(layer.type === "adjust"){
    toast("Una capa de ajuste no tiene píxeles que filtrar", "err");
    return;
  }
  /* Reabrir sobre una capa de filtro: el origen es la capa de debajo
     y al aceptar se sustituye ESTA capa en vez de apilar otra. */
  const base = edit ? filterBase(edit) : layer;
  if(!base){ toast("La capa de filtro no tiene ninguna capa debajo", "err"); return; }

  const before = snapshot(layer);
  const source = edit ? snapshot(base) : before;
  const clipRef = edit ? before : source;
  /* En el panel de Propiedades (sin botón Aplicar), al dejar de mover
     un mando se recalcula a resolución completa si el filtro es rápido
     (los filtros CPU caros trabajan sobre una copia reducida mientras
     se arrastra): si no, la capa quedaba con la copia ampliada hasta
     cambiar de capa. En el diálogo no hace falta, porque Aplicar ya
     recalcula, y así nunca congela la app al soltar un mando.
     `asyncRefine`: el filtro calcula la versión completa en un worker
     (no congela nada), así que se recalcula también en el diálogo y sin
     límite de tiempo; es para los filtros cuya copia reducida no sirve
     para juzgar el resultado (los de enfoque: el detalle fino es justo
     lo que la reducción se come). */
  const px = layer.canvas.width * layer.canvas.height;
  let queued = false, refineTimer = 0, lastMs = 0, refineOff = false, gen = 0;
  const refine = async () => {
    refineTimer = 0;
    const my = gen, t0 = performance.now();
    await Promise.resolve(apply(layer, source, true));
    if(my !== gen) return;          // se movió un mando mientras tanto
    clipToSelection(layer, clipRef);
    layer.thumbDirty = true;
    emit("doc:change");
    if(performance.now() - t0 > 900) refineOff = true;
  };
  const preview = () => {
    if(queued) return;
    queued = true;
    gen++;
    clearTimeout(refineTimer); refineTimer = 0;
    requestAnimationFrame(async () => {
      queued = false;
      const t0 = performance.now();
      await Promise.resolve(apply(layer, source, false));
      lastMs = performance.now() - t0;
      clipToSelection(layer, clipRef);
      layer.thumbDirty = true;
      emit("doc:change");
      if(asyncRefine ? px > FILTER_PREVIEW_LIMIT
         : opts.container && px > FILTER_PREVIEW_LIMIT && !refineOff && lastMs * px / FILTER_PREVIEW_LIMIT < 1500)
        refineTimer = setTimeout(refine, asyncRefine ? 250 : 450);
    });
  };

  const body = build(preview);
  /* Al reabrir, la capa ya tiene el resultado a resolución completa:
     no se repinta con la vista previa (en fotos grandes la dejaba con
     la copia reducida mientras siguiera seleccionada). */

  /* Compartido por las dos salidas: el diálogo modal de siempre y el
     panel de propiedades en vivo (ver editor/adjust/adjust.js, que sigue el
     mismo patrón para los ajustes). */
  const finish = async commit => {
    gen++; clearTimeout(refineTimer); refineTimer = 0;
    if(!commit){ restore(layer, before); return; }
    /* Coma flotante (fase 12, editor/render/floatfilter.js): `float` = "color" (el filtro sólo mira el color de cada
       píxel) o "delta" (filtro local: su cambio se suma a los 16 bits). Sólo si la capa de origen trae 16 bits
       que cubren el lienzo; si algo falla, el camino de 8 bits de siempre. Al reeditar con una selección activa
       el recorte se hace contra el resultado anterior, así que «color» (que mezcla con el origen) no se usa. */
    const mode = typeof float === "function" ? float() : float;
    const wantHi = !!mode && hiFullCover(base) && !(mode === "color" && edit && doc.selection);
    let fres = null;
    if(wantHi && mode === "color"){
      try{
        const fn = await colorFnFromFilter(apply);
        fres = await applyFloatFromBase(base, source, fn, doc.selection);
      }catch(err){ console.warn("[coma flotante]", err); fres = null; }
    }
    /* «native» (v252, editor/render/floatspatial.js): el filtro espacial se calcula de verdad en coma flotante sobre los 16 bits, no como cambio de 8 bits */
    if(!fres && wantHi && mode === "delta" && native){
      try{
        const fn = native();
        if(fn) fres = await applyNativeFromBase(base, source, fn, doc.selection);
      }catch(err){ console.warn("[coma flotante nativa]", err); fres = null; }
    }
    if(!fres){
      await Promise.resolve(apply(layer, source, true));
      clipToSelection(layer, clipRef);
    }
    let after = fres ? fres.canvas : snapshot(layer);
    if(!fres && wantHi && mode === "delta"){
      try{ fres = await applyDeltaFromBase(base, source, after); if(fres) after = fres.canvas; }
      catch(err){ console.warn("[coma flotante]", err); fres = null; }
    }
    restore(layer, before);
    const made = commitFilter({ base, edit, result: after, title,
                   filter: id || title, params: params || {} });
    if(fres) attachFloatResult(made, base, fres);
    toast(title + (edit ? " · actualizado" : " · capa nueva") + (fres ? " · 16 bits conservados" : ""), "ok");
  };

  if(opts.container){
    opts.container.appendChild(body);
    return { body, commit: () => finish(true), cancel: () => finish(false) };
  }

  const res = await dialog({
    title, body, wide,
    cls: isMobile() ? "dlg-compact" : "",
    buttons:[{ label:"Cancelar", value:null },
             { label: edit ? "Guardar cambios" : "Aplicar", primary:true, value:"go" }]
  });
  await finish(res === "go");
}

/* Límite de trabajo por fotograma para los filtros CPU de este
   archivo (Enfocar, Detalle y estructura): mismo criterio que
   editor/adjust/adjust.js y features/photo-tools.js, más estricto en
   `pointer:coarse`. Sólo se usa mientras NO es la llamada final. */
export const FILTER_PREVIEW_LIMIT = COARSE ? 9e5 : 1.2e6;

/* Reduce `src` a una copia de como mucho `FILTER_PREVIEW_LIMIT`
   píxeles si hace falta, y devuelve también el factor de escala —para
   reescalar cualquier radio en píxeles ABSOLUTOS que el filtro use
   por debajo, o el resultado se vería más fuerte en el proxy que en
   la imagen completa—. `scale` es 1 (sin copia) si no hacía falta
   reducir nada. */
export function previewProxy(src, isFinal){
  const w = src.width, h = src.height;
  if(isFinal || w * h <= FILTER_PREVIEW_LIMIT) return { canvas: src, w, h, scale: 1 };
  const scale = Math.sqrt(FILTER_PREVIEW_LIMIT / (w * h));
  const pw = Math.max(1, Math.round(w * scale)), ph = Math.max(1, Math.round(h * scale));
  const c = document.createElement("canvas");
  c.width = pw; c.height = ph;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, pw, ph);
  return { canvas: c, w: pw, h: ph, scale };
}
