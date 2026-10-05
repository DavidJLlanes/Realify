/* ═══════════════════════════════════════════════════════════════
   REMUESTREO DE CALIDAD
   Envoltorio del worker (resample-worker.js): recibe un lienzo y
   devuelve otro al tamaño pedido, calculado fuera del hilo de la
   interfaz. Con `method = "browser"` se usa el `drawImage` del
   navegador de siempre (y es también la red de seguridad si el
   navegador no tiene workers de módulo).
   ═══════════════════════════════════════════════════════════════ */

export const RESAMPLE_METHODS = [
  ["lanczos3",   "Lanczos 3 · máxima nitidez"],
  ["mitchell",   "Mitchell · equilibrado"],
  ["catmullrom", "Catmull-Rom · nítido"],
  ["bilinear",   "Bilineal · suave"],
  ["browser",    "Navegador · rápido"]
];

let worker = null, nextId = 1;
const pending = new Map();

function ensureWorker(){
  if(worker) return worker;
  worker = new Worker(new URL("./resample-worker.js", import.meta.url), { type: "module" });
  worker.onmessage = e => {
    const m = e.data || {};
    const p = pending.get(m.id);
    if(!p) return;
    if(m.type === "progress"){ p.onProgress?.(m.frac); return; }
    pending.delete(m.id);
    if(m.type === "error") p.reject(new Error(m.message));
    else p.resolve(m.data);
  };
  worker.onerror = ev => {
    const err = new Error(ev.message || "El remuestreo ha fallado.");
    for(const p of pending.values()) p.reject(err);
    pending.clear();
    worker = null;
  };
  return worker;
}

function browserResize(src, w, h){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, w, h);
  return c;
}

/** Devuelve un lienzo nuevo de `w`×`h` con el contenido de `src`. */
export async function resampleCanvas(src, w, h, method = "lanczos3", onProgress){
  if(method === "browser" || typeof Worker === "undefined") return browserResize(src, w, h);
  const sw = src.width, sh = src.height;
  const data = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
  let out;
  try{
    out = await new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, onProgress });
      ensureWorker().postMessage({ id, data, sw, sh, dw: w, dh: h, method }, [data.buffer]);
    });
  }catch{
    return browserResize(src, w, h);
  }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);
  return c;
}

/** Remuestrea el origen de 16 bits de una capa (RGB `Uint16Array`, el alfa sale del lienzo) con el mismo método y en coma flotante, y devuelve
 *  el lienzo nuevo —el redondeo de los 16 bits, como exige la invariante de core/hisrc.js— junto al origen nuevo; o null si no se puede
 *  (método «navegador», sin worker, o demasiado grande). */
export async function resampleHi(layer, w, h, method = "lanczos3", onProgress){
  const hs = layer.hiSrc, sw = layer.canvas.width, sh = layer.canvas.height;
  if(method === "browser" || typeof Worker === "undefined" || !hs?.data || sw * sh > 24e6 || w * h > 24e6) return null;
  const px = layer.ctx.getImageData(0, 0, sw, sh).data, rgb = hs.data, rgba = new Uint16Array(sw * sh * 4);
  for(let i = 0, j = 0, q = 0; i < sw * sh; i++, j += 3, q += 4){ rgba[q] = rgb[j]; rgba[q + 1] = rgb[j + 1]; rgba[q + 2] = rgb[j + 2]; rgba[q + 3] = px[q + 3]; }
  let out;
  try{
    out = await new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, onProgress });
      ensureWorker().postMessage({ id, data: rgba, sw, sh, dw: w, dh: h, method, maxv: 65535 }, [rgba.buffer]);
    });
  }catch{ return null; }
  const { hiToCanvas8 } = await import("../core/hisrc.js");
  const dither = !!hs.dither, hi = new Uint16Array(w * h * 3), img = new ImageData(w, h), d = img.data;
  for(let y = 0, i = 0; y < h; y++) for(let x = 0; x < w; x++, i++){
    const q = i * 4, j = i * 3; hi[j] = out[q]; hi[j + 1] = out[q + 1]; hi[j + 2] = out[q + 2]; d[q + 3] = out[q + 3];
    if(d[q + 3]){ d[q] = hiToCanvas8(hi[j], x, y, 0, dither); d[q + 1] = hiToCanvas8(hi[j + 1], x, y, 1, dither); d[q + 2] = hiToCanvas8(hi[j + 2], x, y, 2, dither); }
  }
  const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").putImageData(img, 0, 0);
  return { canvas: c, hiSrc: { data: hi, w, h, dither, x: 0, y: 0, canvasW: w, canvasH: h } };
}
