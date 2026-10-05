/* ═══════════════════════════════════════════════════════════════
   MÁSCARA POR PROFUNDIDAD «VIVA» (Premium 👑 · fase 5 de PENDIENTE.md)
   La máscara por profundidad (depthzones.js) se calculaba una vez. Ahora
   la capa recuerda cómo se hizo (`layer.depthMask`: zona, intervalo,
   suavidad, invertir) y, si la foto de debajo cambia, la máscara se
   recalcula sola:

     · Fuente: lo que hay DEBAJO de esa capa. Una capa de ajuste se
       evalúa sin ella (su propio efecto no cambia la distancia); una
       capa de imagen, con su máscara apagada.
     · Cuándo: tras un rato sin tocar nada (1,5 s), si el contenido de
       esa fuente ha cambiado de verdad (firma de 32×24 luminosidades:
       ajustar el tamaño de un pincel o mover la máscara no la dispara).
     · Zonas «primer plano / medio / fondo»: se reparten por cantidad de
       píxeles de la foto nueva, no con los números de la anterior.
     · Sin entradas en el historial (deshacer la edición de debajo ya
       devuelve la foto y, con ella, la máscara).
   Se guarda en el proyecto (.realify) con la capa.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { emit } from "../core/bus.js";
import { zoneAlpha, presetZone } from "../ai/depthmath.js";
import { setMaskFromArray } from "../editor/masks.js";

const IDLE_MS = 1500, SIG_W = 32, SIG_H = 24, SIG_LIMIT = 1.5;
const half = soft => soft / 200;

/** ¿Tiene la capa una máscara por profundidad viva? */
export const isLive = l => !!(l && l.depthMask && l.mask);

/** Lo que hay debajo de la capa, en un lienzo legible (tamaño del documento). */
export async function liveSource(layer){
  const { flatten } = await import("../editor/layertree.js");
  let c;
  if(layer.type === "adjust") c = flatten(null, doc.layers.filter(l => l !== layer));
  else {
    const was = layer.maskEnabled; layer.maskEnabled = false;
    try{ c = flatten(); } finally { layer.maskEnabled = was; }
  }
  const r = document.createElement("canvas"); r.width = c.width; r.height = c.height;
  r.getContext("2d", { willReadFrequently: true }).drawImage(c, 0, 0);
  return r;
}

/** Firma de contenido: luminosidades de una rejilla 32×24. */
export function signature(canvas){
  const c = document.createElement("canvas"); c.width = SIG_W; c.height = SIG_H;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high"; x.drawImage(canvas, 0, 0, SIG_W, SIG_H);
  const d = x.getImageData(0, 0, SIG_W, SIG_H).data, out = new Uint8Array(SIG_W * SIG_H);
  for(let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = d[j] * 0.2126 + d[j + 1] * 0.7152 + d[j + 2] * 0.0722;
  return out;
}
export function signatureDiff(a, b){
  if(!a || !b || a.length !== b.length) return Infinity;
  let s = 0; for(let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

/** Deja la máscara de `layer` marcada como viva con estos parámetros. `sig`: firma de su fuente actual. */
export function makeLive(layer, p, sig){
  layer.depthMask = { zone: p.zone, from: p.from, to: p.to, soft: p.soft, invert: !!p.invert, auto: p.auto !== false };
  Object.defineProperty(layer.depthMask, "sig", { value: sig || null, writable: true, enumerable: false });
  emit("doc:structure");
}
export function release(layer){ if(layer) { delete layer.depthMask; emit("doc:structure"); } }

let busy = false, pending = false, timer = 0;

/** Recalcula la máscara de `layer` con su foto de debajo. Devuelve true si se actualizó. */
export async function updateLive(layer, { quiet = false } = {}){
  if(!isLive(layer)) return false;
  const [{ depthMap }, { depthField, fieldToArray }] = await Promise.all([import("../ai/depth.js"), import("./depthzones.js")]);
  const src = await liveSource(layer), sig = signature(src);
  if(src.width * src.height !== layer.canvas.width * layer.canvas.height) return false;
  let map;
  try{ map = await depthMap(src); }
  catch(err){ if(!err.cancelled && !quiet){ const { toast } = await import("../ui/toast.js"); toast("No se pudo actualizar la máscara por profundidad: " + err.message, "err"); } return false; }
  const field = depthField(src, map), p = layer.depthMask;
  if(p.zone !== "manual"){
    const z = presetZone(p.zone, field.d);
    if(z){ p.from = Math.round(z[0] * 100); p.to = Math.round(z[1] * 100); }
  }
  const arr = await fieldToArray(field, u => { const a = zoneAlpha(u, p.from / 100, p.to / 100, half(p.soft)); return p.invert ? 1 - a : a; });
  const keep = layer.depthMask;
  setMaskFromArray(layer, arr, "Máscara por profundidad", { record: false });
  layer.depthMask = keep; keep.sig = sig;
  emit("doc:structure");
  return true;
}

/** Comprueba todas las capas vivas con «mantener al día» y actualiza las que cambiaron. */
async function check(){
  if(busy){ pending = true; return; }
  busy = true;
  try{
    for(const l of doc.layers.filter(x => isLive(x) && x.depthMask.auto)){
      const sig = signature(await liveSource(l));
      if(!l.depthMask.sig){ l.depthMask.sig = sig; continue; }      // recién abierta de un proyecto: se da por al día
      if(signatureDiff(sig, l.depthMask.sig) < SIG_LIMIT) continue;
      const { toast } = await import("../ui/toast.js");
      toast("Actualizando la máscara por profundidad…");
      if(await updateLive(l, { quiet: true })) toast("Máscara por profundidad actualizada", "ok");
    }
  } finally {
    busy = false;
    if(pending){ pending = false; schedule(); }
  }
}
export function schedule(){
  clearTimeout(timer);
  if(!doc.open || !doc.layers.some(l => isLive(l) && l.depthMask.auto)) return;
  timer = setTimeout(check, IDLE_MS);
}
/** Para la prueba: ejecuta la comprobación ya, sin esperar. */
export const checkNow = () => check();
