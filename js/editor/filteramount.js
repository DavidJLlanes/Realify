/* ═══════════════════════════════════════════════════════════════
   PORCENTAJE DE APLICACIÓN DE UN FILTRO
   El deslizador que hay en cada capa de filtro del panel de capas.
   No es la opacidad: la opacidad funde el resultado con lo de abajo,
   y esto vuelve a CALCULAR el filtro con sus mandos escalados a ese
   tanto por ciento respecto a lo que el usuario introdujo (ver
   filterregistry.js para qué mando escala y cuál no). Un desenfoque
   de radio 10 al 50 % es un desenfoque de radio 5, no una mezcla al
   50 % de dos imágenes.

   Para los filtros que no tienen ningún mando de intensidad
   (Invertir, Contraste automático, Blanco y negro en modo receta…),
   o cuyo motor no está disponible ya (una LUT que no se volvió a
   cargar), el porcentaje se resuelve como mezcla entre el original y
   el resultado completo: es la única lectura posible y se avisa de
   ello en la etiqueta del deslizador.

   Mientras se arrastra se recalcula sobre una copia reducida y se
   estira sobre la capa; al soltar, a resolución completa y con un
   paso de historial. Los parámetros guardados en la capa no se tocan
   nunca: sólo cambia `amount`.
   ═══════════════════════════════════════════════════════════════ */

import { emit } from "../core/bus.js";
import { record } from "../core/history.js";
import { COARSE } from "../core/device.js";
import { status } from "../ui/toast.js";
import { filterOf, filterBase, filterAmount } from "./filterlayer.js";
import { renderFilter, scaleParams, knownFilter } from "./filterregistry.js";

const PREVIEW_LIMIT = COARSE ? 3e5 : 8e5;

const snapshot = canvas => {
  const c = document.createElement("canvas");
  c.width = canvas.width; c.height = canvas.height;
  c.getContext("2d").drawImage(canvas, 0, 0);
  return c;
};
function proxyOf(src){
  const w = src.width, h = src.height;
  if(w * h <= PREVIEW_LIMIT) return src;
  const k = Math.sqrt(PREVIEW_LIMIT / (w * h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
function writeInto(layer, canvas){
  const x = layer.ctx;
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = "copy";
  x.imageSmoothingQuality = "high";
  x.drawImage(canvas, 0, 0, layer.canvas.width, layer.canvas.height);
  x.restore();
  layer.thumbDirty = true;
}
const dataOf = c => c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);

/* ¿El porcentaje de esta capa se resuelve escalando mandos o como
   mezcla? Sirve para etiquetar el deslizador. */
export function amountMode(layer){
  const f = filterOf(layer);
  if(!f || !knownFilter(f.id)) return "mix";
  return scaleParams(f.id, f.params, 0.5) ? "scale" : "mix";
}

/* Resultado del filtro al 100 %, a resolución completa. Se guarda en
   la capa (no se serializa) para la mezcla y para volver al 100 % sin
   recalcular. Si no está, se deduce de los píxeles actuales y del
   porcentaje que tengan: cur = base + (full − base)·a  →  full. */
function fullResult(layer, base){
  if(layer._fxFull && layer._fxFull.width === layer.canvas.width) return layer._fxFull;
  const a = filterAmount(layer) / 100;
  const cur = snapshot(layer.canvas);
  if(a >= 0.995){ layer._fxFull = cur; return cur; }
  if(a <= 0.005) return null;
  const cd = dataOf(cur), bd = dataOf(base.canvas);
  const c = cd.data, b = bd.data, inv = 1 / a;
  for(let i = 0; i < c.length; i += 4){
    c[i]   = b[i]   + (c[i]   - b[i])   * inv;
    c[i+1] = b[i+1] + (c[i+1] - b[i+1]) * inv;
    c[i+2] = b[i+2] + (c[i+2] - b[i+2]) * inv;
  }
  cur.getContext("2d").putImageData(cd, 0, 0);
  layer._fxFull = cur;
  return cur;
}

function mixCanvas(baseC, fullC, t){
  const out = document.createElement("canvas");
  out.width = baseC.width; out.height = baseC.height;
  const bd = dataOf(baseC), fd = dataOf(fullC);
  const b = bd.data, f = fd.data;
  for(let i = 0; i < b.length; i += 4){
    b[i]   += (f[i]   - b[i])   * t;
    b[i+1] += (f[i+1] - b[i+1]) * t;
    b[i+2] += (f[i+2] - b[i+2]) * t;
    b[i+3]  = f[i+3];
  }
  out.getContext("2d").putImageData(bd, 0, 0);
  return out;
}

const tickets = new WeakMap();
const pendingPreview = new WeakMap();
const busy = new WeakSet();

/**
 * @param {object} layer   capa de filtro
 * @param {number} amount  0..100
 * @param {{preview?:boolean}} o  preview: copia reducida, sin historial
 */
export async function setFilterAmount(layer, amount, { preview = false } = {}){
  const entry = filterOf(layer);
  const base = filterBase(layer);
  if(!entry || !base) return false;
  amount = Math.max(0, Math.min(100, Math.round(amount)));

  // Mientras hay un cálculo en marcha, la vista previa sólo recuerda
  // el último valor pedido y se ejecuta al terminar; la final espera.
  if(preview && busy.has(layer)){ pendingPreview.set(layer, amount); return true; }
  busy.add(layer);
  const ticket = (tickets.get(layer) || 0) + 1;
  tickets.set(layer, ticket);

  try{
    const before = preview ? null : snapshot(layer.canvas);
    const prevAmount = entry.amount ?? 100;
    const t = amount / 100;
    const src = preview ? proxyOf(base.canvas) : base.canvas;
    let out = null;

    /* Mientras se ARRASTRA no se recalcula el filtro: se mezcla el
       original con el resultado al 100 % —una interpolación por píxel
       sobre una copia reducida, del orden de un milisegundo—. Antes se
       volvía a ejecutar el filtro entero en cada movimiento del dedo,
       y con algo como Realify (treinta y una etapas por pasada) el
       deslizador iba a tirones o directamente se quedaba clavado.
       Al SOLTAR sí se recalcula con los mandos escalados, que es el
       resultado bueno y el que se guarda: lo que se ve arrastrando es
       una aproximación, lo que queda al soltar no.

       Se decide por adelantado si hará falta el resultado completo
       para esa mezcla: hay que deducirlo ANTES de tocar los píxeles. */
    const scaled = preview ? null : scaleParams(entry.id, entry.params, t);
    let full = null;
    if(!scaled) full = fullResult(layer, base);

    if(scaled){
      if(t >= 0.995 && layer._fxFull && !preview) out = layer._fxFull;
      else{
        if(!preview) status(`${entry.name || entry.id} · ${amount} %…`);
        out = await renderFilter(entry.id, src, scaled, !preview);
        if(!out && !full) full = fullResult(layer, base);
      }
    }
    if(!out){
      if(!full){ busy.delete(layer); return false; }
      const fullSrc = preview ? proxyOf(full) : full;
      out = mixCanvas(src, fullSrc, t);
    }
    if(tickets.get(layer) !== ticket) return true;   // llegó otra petición más nueva

    writeInto(layer, out);
    if(!preview && scaled && t >= 0.995 && out !== layer._fxFull) layer._fxFull = snapshot(layer.canvas);
    emit("doc:change");

    if(!preview){
      const after = snapshot(layer.canvas);
      entry.amount = amount;
      const put = (snap, a) => {
        writeInto(layer, snap);
        const f = filterOf(layer); if(f) f.amount = a;
        emit("doc:structure"); emit("doc:change");
      };
      record(`${entry.name || "Filtro"} · ${amount} %`,
        () => put(before, prevAmount), () => put(after, amount));
      status("");
      emit("doc:structure");
    }
    return true;
  }catch(err){
    console.error("[filteramount]", err);
    status("");
    return false;
  }finally{
    busy.delete(layer);
    const next = pendingPreview.get(layer);
    if(next !== undefined){
      pendingPreview.delete(layer);
      if(tickets.get(layer) === ticket) setFilterAmount(layer, next, { preview: true });
    }
  }
}
