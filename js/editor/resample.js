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
