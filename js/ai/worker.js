/* ═══════════════════════════════════════════════════════════════
   IA · WORKER
   ONNX Runtime Web (js/vendor/ort) y los modelos viven aquí, fuera del
   hilo de la interfaz. WebGPU si el navegador la tiene; si no, o si el
   modelo no arranca con ella, WebAssembly en la CPU.

   Los modelos remotos se descargan una sola vez y se guardan en
   IndexedDB —no en la Cache API: el service worker borra en cada
   versión todas las cachés que no son la suya (ver sw.js), y volver a
   bajar 200 MB por cada despliegue sería inaceptable—.

   Tareas:
     · matte    → alfa de un modelo de segmentación (eliminar fondo)
     · inpaint  → LaMa sobre un recorte ya preparado a 512×512
     · restore  → SCUNet / FBCNN por teselas sobre la imagen entera
   ═══════════════════════════════════════════════════════════════ */

/* Los dos módulos del motor van con extensión .js y no con la .mjs
   con la que se publican: los módulos exigen un tipo MIME de
   JavaScript, y el nginx de producción sirve .mjs como
   application/octet-stream, así que el worker no llegaba ni a arrancar
   («El motor de IA ha fallado»). Con .js no depende de la configuración
   del servidor. Por eso también se le dan a ONNX Runtime las dos rutas
   explícitas, en vez de la carpeta: por sí mismo buscaría el .mjs. */
import * as ort from "../vendor/ort/ort.webgpu.min.js";
import { rgbToLab, rgbfToLab, labToRgb } from "./lab.js";

ort.env.wasm.wasmPaths = {
  mjs:  new URL("../vendor/ort/ort-wasm-simd-threaded.asyncify.js", import.meta.url).href,
  wasm: new URL("../vendor/ort/ort-wasm-simd-threaded.asyncify.wasm", import.meta.url).href
};
// Sin aislamiento de origen no hay SharedArrayBuffer ni, por tanto,
// hilos: se pide uno explícitamente para que no lo intente y avise.
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
ort.env.logLevel = "error";

const DB_NAME = "realify-ai", STORE = "models";
const sessions = new Map();   // id → { session, backend }

function post(msg, transfer){ self.postMessage(msg, transfer || []); }

/* ── Caché de modelos en IndexedDB ─────────────────────────────── */
function openDb(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbGet(key){
  try{
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }catch{ return null; }
}
async function dbPut(key, blob){
  try{
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  }catch{ /* sin IndexedDB (navegación privada): se volverá a descargar la próxima vez */ }
}
async function dbHas(key){
  try{
    const db = await openDb();
    return await new Promise(resolve => {
      const r = db.transaction(STORE).objectStore(STORE).count(key);
      r.onsuccess = () => resolve(r.result > 0);
      r.onerror = () => resolve(false);
    });
  }catch{ return false; }
}

async function fetchModel(id, model){
  // `store`: modelo grande servido por la propia web (SAM…); se guarda en
  // IndexedDB igual que los de Hugging Face, para no volver a bajarlo.
  const local = new URL(model.url).origin === self.location.origin && !model.store;
  if(!local){
    const cached = await dbGet(model.url);
    if(cached) return new Uint8Array(await cached.arrayBuffer());
  }
  // `parts`: el archivo viene en trozos (GitHub no admite más de 100 MB
  // por archivo); se bajan uno tras otro y se guardan unidos con `url`.
  const urls = model.parts || [model.url];
  let chunks = [], loaded = 0, last = 0, total = model.parts ? model.size || 0 : 0;
  /* Memoria: si se sabe el tamaño exacto (`model.size`), cada trozo se
     copia al momento a UN búfer final y se suelta; antes se juntaban
     todos, luego un Blob y luego otra copia: tres veces el modelo a la
     vez, lo que en un iPhone bastaba para quedarse sin memoria. */
  let buf = model.size ? new Uint8Array(model.size) : null;
  for(const u of urls){
    const res = await fetch(u);
    if(!res.ok) throw new Error(`No se pudo descargar el modelo (${res.status}).`);
    if(!model.parts) total = +res.headers.get("content-length") || model.size || 0;
    const reader = res.body.getReader();
    for(;;){
      const { done, value } = await reader.read();
      if(done) break;
      if(buf && loaded + value.length <= buf.length) buf.set(value, loaded);
      else{
        if(buf){ chunks.push(buf.subarray(0, loaded)); buf = null; }   // el tamaño no cuadraba
        chunks.push(value);
      }
      loaded += value.length;
      const now = performance.now();
      if(now - last > 150){ last = now; post({ type:"download", model:id, loaded, total }); }
    }
  }
  post({ type:"download", model:id, loaded, total: total || loaded });
  let bytes;
  if(buf && loaded === buf.length) bytes = buf;
  else if(buf) bytes = buf.subarray(0, loaded);
  else{ const b = new Blob(chunks); chunks = null; bytes = new Uint8Array(await b.arrayBuffer()); }
  chunks = null; buf = null;
  if(!local) await dbPut(model.url, new Blob([bytes]));
  return bytes;
}

/* Modelos que ya fallaron en WebGPU durante esta sesión (p. ej. «Too
   many storage buffers» en GPUs con límites bajos): no se reintenta. */
const gpuFailed = new Set();

/* ¿Hay de verdad una GPU utilizable? Con WebGPU en el navegador pero sin
   adaptador (sin GPU, controlador bloqueado), ONNX Runtime pasa a la CPU
   sin avisar y la sesión parecía «webgpu»: el tamaño de los bloques y su
   número se elegían como si hubiera GPU. */
let gpuAdapter = null;
function hasGpuAdapter(){
  if(!gpuAdapter) gpuAdapter = Promise.resolve().then(() => self.navigator.gpu.requestAdapter()).then(a => !!a).catch(() => false);
  return gpuAdapter;
}

async function getSession(id, model){
  if(sessions.has(id)) return sessions.get(id);
  // Un solo modelo en memoria a la vez: dos de 200 MB juntos tumban
  // la pestaña en un móvil. Salvo los de un mismo `group`, que trabajan
  // juntos (codificador y decodificador de SAM).
  for(const [k, s] of sessions){
    if(model.group && s.group === model.group) continue;
    try{ await s.session.release(); }catch{} sessions.delete(k);
  }

  const bytes = await fetchModel(id, model);
  post({ type:"stage", model:id, stage:"load" });
  const opts = { graphOptimizationLevel: "all", logSeverityLevel: 3 };
  let session = null, backend = "wasm";
  // `model.cpu`: modelos cuyo resultado con WebGPU no es fiable.
  if(self.navigator?.gpu && !model.cpu && !gpuFailed.has(id) && await hasGpuAdapter()){
    try{
      session = await ort.InferenceSession.create(bytes, { ...opts, executionProviders: ["webgpu", "wasm"] });
      backend = "webgpu";
    }catch{ session = null; gpuFailed.add(id); }
  }
  // En la CPU la memoria es el límite (WebAssembly de 32 bits: 4 GB en
  // total). Sin arena ni patrón de memoria el pico baja mucho a cambio
  // de algo de velocidad, que es lo que permite a BiRefNet trabajar a
  // 1024 px sin «bad_alloc».
  // Modelos grandes (ISNet, LaMa): sin «prepacking», que guarda una
  // segunda copia de los pesos reordenada y casi duplica la memoria.
  const big = (model.size || 0) > 100e6;
  if(!session) session = await ort.InferenceSession.create(bytes, { ...opts,
    executionProviders: ["wasm"], enableCpuMemArena: false, enableMemPattern: false,
    ...(big ? { extra: { session: { disable_prepacking: "1" } } } : {}) });
  const entry = { session, backend, group: model.group || null };
  sessions.set(id, entry);
  return entry;
}

/* `session.run` con red de seguridad: si WebGPU falla al ejecutar —hay
   errores que sólo aparecen aquí, no al crear la sesión—, se rehace la
   sesión en la CPU y se repite la misma llamada. */
async function runSession(id, model, feeds){
  const entry = await getSession(id, model);
  try{
    return await entry.session.run(feeds);
  }catch(err){
    if(entry.backend !== "webgpu") throw err;
    gpuFailed.add(id);
    try{ await entry.session.release(); }catch{}
    sessions.delete(id);
    const cpu = await getSession(id, model);
    post({ type:"stage", model:id, stage:"run" });
    return await cpu.session.run(feeds);
  }
}

/* ── float16 ↔ float32 ─────────────────────────────────────────── */
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
function toHalf(v){
  f32[0] = v; const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  let exp = ((x >>> 23) & 0xff) - 112, mant = x & 0x7fffff;
  if(exp <= 0){
    if(exp < -10) return sign;
    mant = (mant | 0x800000) >> (1 - exp);
    return sign | ((mant + 0x1000) >> 13);
  }
  if(exp >= 31) return sign | 0x7c00;
  const h = sign | (exp << 10) | ((mant + 0x1000) >> 13);
  return h;
}
function fromHalf(h){
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if(e === 0) return s * m * 5.960464477539063e-8;
  if(e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * Math.pow(2, e - 15);
}
function makeTensor(type, data, dims){
  if(type === "float16"){
    const h = new Uint16Array(data.length);
    for(let i = 0; i < data.length; i++) h[i] = toHalf(data[i]);
    return new ort.Tensor("float16", h, dims);
  }
  return new ort.Tensor("float32", data, dims);
}
function readFloats(t){
  const d = t.data;
  if(t.type === "float16"){
    if(d instanceof Uint16Array){
      const out = new Float32Array(d.length);
      for(let i = 0; i < d.length; i++) out[i] = fromHalf(d[i]);
      return out;
    }
    return Float32Array.from(d);   // Float16Array nativo
  }
  return d instanceof Float32Array ? d : Float32Array.from(d);
}
function inputType(session, name){
  const meta = session.inputMetadata?.find?.(m => m.name === name);
  return meta?.type === "float16" ? "float16" : "float32";
}

/* ── Utilidades de píxeles ─────────────────────────────────────── */
/* `norm` = [media, desviación] por si el modelo no lleva la
   normalización dentro del grafo (MODNet espera -1…1). */
function rgbaToPlanar(rgba, n, norm){
  const out = new Float32Array(3 * n);
  const [mean, std] = norm || [0, 1];
  for(let p = 0, i = 0; p < n; p++, i += 4){
    out[p]         = (rgba[i]     / 255 - mean) / std;
    out[n + p]     = (rgba[i + 1] / 255 - mean) / std;
    out[2 * n + p] = (rgba[i + 2] / 255 - mean) / std;
  }
  return out;
}

/* ── Tareas ────────────────────────────────────────────────────── */
async function matte({ model, id, rgba, size }){
  const { session } = await getSession(id, model);
  const n = size * size;
  const name = session.inputNames[0];
  const feeds = { [name]: makeTensor(inputType(session, name), rgbaToPlanar(rgba, n, model.norm), [1, 3, size, size]) };
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, feeds);
  const vals = readFloats(out[session.outputNames[0]]);
  // Algunos modelos devuelven probabilidad (0-1) y otros logits: si
  // hay valores fuera de rango claro, se pasan por una sigmoide.
  let lo = Infinity, hi = -Infinity;
  for(let i = 0; i < n; i++){ const v = vals[i]; if(v < lo) lo = v; if(v > hi) hi = v; }
  const logits = lo < -0.5 || hi > 1.5;
  // `minmax`: la salida se estira entre su mínimo y su máximo (ISNet).
  const span = model.minmax && !logits && hi - lo > 1e-6 ? hi - lo : 0;
  const mask = new Uint8ClampedArray(n);
  for(let i = 0; i < n; i++){
    const v = logits ? 1 / (1 + Math.exp(-vals[i])) : span ? (vals[i] - lo) / span : vals[i];
    mask[i] = Math.round(v * 255);
  }
  return { mask };
}

async function inpaint({ model, id, rgba, hole, size }){
  const { session } = await getSession(id, model);
  const n = size * size;
  const [imgName, maskName] = session.inputNames.includes("image")
    ? ["image", "mask"] : session.inputNames;
  const m = new Float32Array(n);
  for(let i = 0; i < n; i++) m[i] = hole[i] ? 1 : 0;
  const feeds = {
    [imgName]:  makeTensor(inputType(session, imgName), rgbaToPlanar(rgba, n), [1, 3, size, size]),
    [maskName]: makeTensor(inputType(session, maskName), m, [1, 1, size, size])
  };
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, feeds);
  const vals = readFloats(out[session.outputNames[0]]);
  // LaMa_512 devuelve 0-255; las variantes «FAST», 0-1.
  let hi = 0;
  for(let i = 0; i < vals.length; i++) if(vals[i] > hi) hi = vals[i];
  const amp = hi <= 1.5 ? 255 : 1;
  const res = new Uint8ClampedArray(n * 4);
  for(let p = 0, i = 0; p < n; p++, i += 4){
    res[i] = vals[p] * amp; res[i + 1] = vals[n + p] * amp; res[i + 2] = vals[2 * n + p] * amp; res[i + 3] = 255;
  }
  return { rgba: res };
}

/* Inicio de cada tesela a lo largo de un eje: paso fijo y la última
   pegada al borde, para que TODAS midan `tile` (una tesela estrecha
   rellenada por repetición deja franjas que el modelo no limpia). */
function starts(len, tile, overlap){
  if(len <= tile) return [0];
  const out = [], step = tile - overlap;
  for(let x = 0; x + tile < len; x += step) out.push(x);
  out.push(len - tile);
  return out;
}
/* Relleno en espejo para imágenes menores que el mínimo del modelo. */
function mirror(i, len){
  if(len === 1) return 0;
  const period = 2 * (len - 1), k = i % period;
  return k < len ? k : period - k;
}

/* Teselas con solape, como el AiProcessor de ImageToolbox: si la
   imagen es menor que una tesela se amplía en espejo hasta un múltiplo
   de 8 (y al mínimo que pida el modelo), y en la costura con la
   tesela anterior se mezcla con un «smoothstep» para que no quede
   rejilla visible. */
async function restore({ model, id, rgba, w, h, strength = 50 }){
  const { session, backend } = await getSession(id, model);
  const name = session.inputNames[0];
  const type = inputType(session, name);
  // En la GPU caben teselas mayores: menos costuras y ~30 % más rápido.
  const tile = backend === "webgpu" ? (model.tileGpu || model.tile) : model.tile, overlap = 32;
  const xs = starts(w, tile, overlap), ys = starts(h, tile, overlap);
  const total = xs.length * ys.length;
  const out = new Uint8ClampedArray(rgba.length);
  const extra = session.inputNames.filter(nm => nm !== name);
  let done = 0;
  post({ type:"stage", model:id, stage:"run" });

  for(let r = 0; r < ys.length; r++) for(let c = 0; c < xs.length; c++){
    const x0 = xs[c], y0 = ys[r];
    const tw = Math.min(tile, w), th = Math.min(tile, h);
    // Solape REAL con la tesela anterior: la última se pega al borde,
    // así que puede solapar más de `overlap`.
    const ovL = c ? xs[c - 1] + tw - x0 : 0, ovT = r ? ys[r - 1] + th - y0 : 0;
    const align = v => Math.max(model.minSide || 0, Math.ceil(v / 8) * 8);
    const pw = align(tw), ph = align(th), n = pw * ph;
    const input = new Float32Array(3 * n);
    for(let y = 0; y < ph; y++){
      const sy = y0 + mirror(y, th);
      for(let x = 0; x < pw; x++){
        const si = (sy * w + x0 + mirror(x, tw)) * 4, p = y * pw + x;
        input[p] = rgba[si] / 255; input[n + p] = rgba[si + 1] / 255; input[2 * n + p] = rgba[si + 2] / 255;
      }
    }
    const feeds = { [name]: makeTensor(type, input, [1, 3, ph, pw]) };
    for(const nm of extra) feeds[nm] = makeTensor(inputType(session, nm), new Float32Array([strength / 100]), [1, 1]);
    const res = await runSession(id, model, feeds);
    const vals = readFloats(res[session.outputNames[0]]);

    for(let y = 0; y < th; y++) for(let x = 0; x < tw; x++){
      const p = y * pw + x, di = ((y0 + y) * w + x0 + x) * 4;
      let a = 1;
      if(x < ovL){ const t = x / Math.max(1, ovL - 1); a = Math.min(a, t * t * (3 - 2 * t)); }
      if(y < ovT){ const t = y / Math.max(1, ovT - 1); a = Math.min(a, t * t * (3 - 2 * t)); }
      const rr = vals[p] * 255, gg = vals[n + p] * 255, bb = vals[2 * n + p] * 255;
      out[di]     = a === 1 ? rr : out[di]     * (1 - a) + rr * a;
      out[di + 1] = a === 1 ? gg : out[di + 1] * (1 - a) + gg * a;
      out[di + 2] = a === 1 ? bb : out[di + 2] * (1 - a) + bb * a;
      out[di + 3] = rgba[di + 3];
    }
    done++;
    post({ type:"tiles", model:id, done, total });
  }
  return { rgba: out };
}

/* ── Ampliar ─────────────────────────────────────────────────
   Teselas con solape como `restore`, pero la salida es `scale` veces
   mayor (se mide en la primera tesela, por si el modelo no es el que
   dice el catálogo). El alfa se amplía aparte, sin IA. */
async function upscale({ model, id, rgba, w, h }){
  const { session } = await getSession(id, model);
  const name = session.inputNames[0], type = inputType(session, name);
  const tile = Math.min(model.tile || 192, Math.max(w, h)), overlap = 12;
  const xs = starts(w, Math.min(tile, w), overlap), ys = starts(h, Math.min(tile, h), overlap);
  const total = xs.length * ys.length;
  let S = model.scale || 4, W = 0, H = 0, out = null, done = 0;
  post({ type:"stage", model:id, stage:"run" });
  for(let r = 0; r < ys.length; r++) for(let c = 0; c < xs.length; c++){
    const x0 = xs[c], y0 = ys[r], tw = Math.min(tile, w), th = Math.min(tile, h), n = tw * th;
    const input = new Float32Array(3 * n);
    for(let y = 0; y < th; y++) for(let x = 0; x < tw; x++){
      const si = ((y0 + y) * w + x0 + x) * 4, p = y * tw + x;
      input[p] = rgba[si] / 255; input[n + p] = rgba[si + 1] / 255; input[2 * n + p] = rgba[si + 2] / 255;
    }
    const res = await runSession(id, model, { [name]: makeTensor(type, input, [1, 3, th, tw]) });
    const t = res[session.outputNames[0]], vals = readFloats(t);
    const oh = t.dims[2], ow = t.dims[3];
    if(!out){ S = Math.round(ow / tw) || S; W = w * S; H = h * S; out = new Uint8ClampedArray(W * H * 4); }
    const on = ow * oh, ovL = c ? (xs[c - 1] + tw - x0) * S : 0, ovT = r ? (ys[r - 1] + th - y0) * S : 0;
    for(let y = 0; y < oh; y++) for(let x = 0; x < ow; x++){
      const p = y * ow + x, di = ((y0 * S + y) * W + x0 * S + x) * 4;
      let a = 1;
      if(x < ovL){ const k = x / Math.max(1, ovL - 1); a = Math.min(a, k * k * (3 - 2 * k)); }
      if(y < ovT){ const k = y / Math.max(1, ovT - 1); a = Math.min(a, k * k * (3 - 2 * k)); }
      const rr = vals[p] * 255, gg = vals[on + p] * 255, bb = vals[2 * on + p] * 255;
      out[di]     = a === 1 ? rr : out[di]     * (1 - a) + rr * a;
      out[di + 1] = a === 1 ? gg : out[di + 1] * (1 - a) + gg * a;
      out[di + 2] = a === 1 ? bb : out[di + 2] * (1 - a) + bb * a;
      out[di + 3] = 255;
    }
    done++; post({ type:"tiles", model:id, done, total });
  }
  // Alfa (vecino más próximo): sólo si la imagen tenía transparencia
  let hasAlpha = false; for(let i = 3; i < rgba.length; i += 4) if(rgba[i] < 255){ hasAlpha = true; break; }
  if(hasAlpha) for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) out[(y * W + x) * 4 + 3] = rgba[(((y / S) | 0) * w + ((x / S) | 0)) * 4 + 3];
  return { rgba: out, w: W, h: H, scale: S };
}

/* ── Colorear ─────────────────────────────────────────────────
   Devuelve sólo el color (a, b de Lab) a la resolución de trabajo; la
   luminancia la pone quien llama, de la foto original. */
async function colorize({ model, id, rgba, w, h }){
  const { session } = await getSession(id, model);
  const name = session.inputNames[0], type = inputType(session, name);
  const ab = new Float32Array(w * h * 2);
  post({ type:"stage", model:id, stage:"run" });
  if(model.colorize === "ab"){
    // DDColor: la luminancia en RGB (a = b = 0) a N × N, salida a y b.
    const N = model.input || 512, n = N * N, input = new Float32Array(3 * n);
    for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
      const sx = Math.min(w - 1, (x * w / N) | 0), sy = Math.min(h - 1, (y * h / N) | 0), si = (sy * w + sx) * 4;
      const L = rgbToLab(rgba[si], rgba[si + 1], rgba[si + 2])[0], [r, g, b] = labToRgb(L, 0, 0), p = y * N + x;
      input[p] = r / 255; input[n + p] = g / 255; input[2 * n + p] = b / 255;
    }
    const res = await runSession(id, model, { [name]: makeTensor(type, input, [1, 3, N, N]) });
    const t = res[session.outputNames[0]], v = readFloats(t), oh = t.dims[2], ow = t.dims[3], on = ow * oh;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const sx = Math.min(ow - 1, (x * ow / w) | 0), sy = Math.min(oh - 1, (y * oh / h) | 0), p = sy * ow + sx, o = (y * w + x) * 2;
      ab[o] = v[p]; ab[o + 1] = v[on + p];
    }
    return { ab, w, h };
  }
  // Modelos «1x»: la foto en gris, por teselas; del resultado sólo el color.
  const gray = new Uint8ClampedArray(rgba.length);
  for(let i = 0; i < rgba.length; i += 4){ const L = rgbToLab(rgba[i], rgba[i + 1], rgba[i + 2])[0], [r, g, b] = labToRgb(L, 0, 0); gray[i] = r; gray[i + 1] = g; gray[i + 2] = b; gray[i + 3] = 255; }
  const tile = Math.min(model.tile || 512, Math.max(w, h)), overlap = 32;
  const xs = starts(w, Math.min(tile, w), overlap), ys = starts(h, Math.min(tile, h), overlap);
  const total = xs.length * ys.length; let done = 0;
  for(let r = 0; r < ys.length; r++) for(let c = 0; c < xs.length; c++){
    const x0 = xs[c], y0 = ys[r], tw = Math.min(tile, w), th = Math.min(tile, h);
    const pw = Math.ceil(tw / 8) * 8, ph = Math.ceil(th / 8) * 8, n = pw * ph, input = new Float32Array(3 * n);
    for(let y = 0; y < ph; y++) for(let x = 0; x < pw; x++){
      const si = ((y0 + mirror(y, th)) * w + x0 + mirror(x, tw)) * 4, p = y * pw + x;
      input[p] = gray[si] / 255; input[n + p] = gray[si + 1] / 255; input[2 * n + p] = gray[si + 2] / 255;
    }
    const res = await runSession(id, model, { [name]: makeTensor(type, input, [1, 3, ph, pw]) });
    const t = res[session.outputNames[0]], v = readFloats(t), ow = t.dims[3], on = t.dims[2] * ow;
    const ovL = c ? xs[c - 1] + tw - x0 : 0, ovT = r ? ys[r - 1] + th - y0 : 0;
    for(let y = 0; y < th; y++) for(let x = 0; x < tw; x++){
      const p = y * ow + x, o = ((y0 + y) * w + x0 + x) * 2;
      const [, A, B] = rgbfToLab(v[p], v[on + p], v[2 * on + p]);
      let a = 1;
      if(x < ovL){ const k = x / Math.max(1, ovL - 1); a = Math.min(a, k * k * (3 - 2 * k)); }
      if(y < ovT){ const k = y / Math.max(1, ovT - 1); a = Math.min(a, k * k * (3 - 2 * k)); }
      ab[o] = a === 1 ? A : ab[o] * (1 - a) + A * a; ab[o + 1] = a === 1 ? B : ab[o + 1] * (1 - a) + B * a;
    }
    done++; post({ type:"tiles", model:id, done, total });
  }
  return { ab, w, h };
}

async function probe({ model, id }){
  const { session, backend } = await getSession(id, model);
  return { backend, inputs: session.inputMetadata || session.inputNames,
           outputs: session.outputMetadata || session.outputNames };
}

/* ── Segment Anything (MobileSAM + decodificador de SAM) ──────────
   El codificador analiza la foto UNA vez (lado mayor a 1024, normalizada
   como ImageNet, rellena abajo/derecha hasta 1024×1024) y su resultado
   se queda aquí; cada toque sólo ejecuta el decodificador, que tarda
   milisegundos. `key` identifica la foto codificada. */
let samCache = null;
async function samEncode({ model, id, rgba, w, h, key }){
  const { session } = await getSession(id, model);
  const S = 1024, n = S * S, x = new Float32Array(3 * n);
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for(let c = 0; c < 3; c++) x.fill(-mean[c] / std[c], c * n, (c + 1) * n);
  for(let y = 0; y < h; y++) for(let xx = 0; xx < w; xx++){
    const i = (y * w + xx) * 4, p = y * S + xx;
    x[p] = (rgba[i] / 255 - mean[0]) / std[0];
    x[n + p] = (rgba[i + 1] / 255 - mean[1]) / std[1];
    x[2 * n + p] = (rgba[i + 2] / 255 - mean[2]) / std[2];
  }
  const name = session.inputNames[0];
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, { [name]: makeTensor(inputType(session, name), x, [1, 3, S, S]) });
  const t = out[session.outputNames[0]];
  samCache = { key, data: readFloats(t), dims: t.dims.slice() };
  return { ok: true };
}
async function samDecode({ model, id, key, coords, labels, w, h, maskInput }){
  if(!samCache || samCache.key !== key) throw new Error("la foto no está analizada (vuelve a abrir la herramienta)");
  const { session } = await getSession(id, model);
  const np = labels.length;
  const hasMask = !!maskInput;
  const feeds = {
    image_embeddings: new ort.Tensor("float32", samCache.data, samCache.dims),
    point_coords: new ort.Tensor("float32", Float32Array.from(coords), [1, np, 2]),
    point_labels: new ort.Tensor("float32", Float32Array.from(labels), [1, np]),
    mask_input: new ort.Tensor("float32", hasMask ? maskInput : new Float32Array(256 * 256), [1, 1, 256, 256]),
    has_mask_input: new ort.Tensor("float32", new Float32Array([hasMask ? 1 : 0]), [1]),
    orig_im_size: new ort.Tensor("float32", new Float32Array([h, w]), [2])
  };
  const out = await runSession(id, model, feeds);
  const masks = out.masks, iou = readFloats(out.iou_predictions), low = out.low_res_masks;
  const K = masks.dims[1], mh = masks.dims[2], mw = masks.dims[3], plane = mh * mw;
  const all = readFloats(masks), lowAll = readFloats(low);
  // La de más calidad según el propio modelo; con un solo punto, SAM da
  // varias candidatas (parte, objeto, todo) y ésta suele ser el objeto.
  let best = 0;
  for(let k = 1; k < K; k++) if(iou[k] > iou[best]) best = k;
  const logits = all.slice(best * plane, (best + 1) * plane);
  const lowRes = lowAll.slice(best * 65536, (best + 1) * 65536);
  return { logits, lowRes, mw, mh, score: iou[best] };
}

/* ── Caras (YuNet, OpenCV Zoo) ──────────────────────────────────
   Entrada BGR 0-255 (blobFromImage sin escala ni media) rellena hasta
   múltiplo de 32; salidas cls/obj/bbox/kps a pasos 8, 16 y 32, que se
   decodifican como en FaceDetectorYN de OpenCV. Devuelve cajas y los 5
   puntos (ojo derecho, ojo izquierdo, nariz, comisuras) en píxeles de
   la imagen recibida, sin supresión de solapes (la hace quien llama). */
async function faces({ model, id, rgba, w, h, threshold = 0.6 }){
  const { session } = await getSession(id, model);
  // Esta exportación tiene la entrada fija a 640×640: se rellena hasta ahí
  const pw = Math.max(640, Math.ceil(w / 32) * 32), ph = Math.max(640, Math.ceil(h / 32) * 32), n = pw * ph;
  const x = new Float32Array(3 * n);
  for(let y = 0; y < h; y++) for(let xx = 0; xx < w; xx++){
    const i = (y * w + xx) * 4, p = y * pw + xx;
    x[p] = rgba[i + 2]; x[n + p] = rgba[i + 1]; x[2 * n + p] = rgba[i];
  }
  const name = session.inputNames[0];
  const out = await runSession(id, model, { [name]: new ort.Tensor("float32", x, [1, 3, ph, pw]) });
  const list = [];
  for(const s of [8, 16, 32]){
    const cls = readFloats(out["cls_" + s]), obj = readFloats(out["obj_" + s]);
    const bb = readFloats(out["bbox_" + s]), kp = readFloats(out["kps_" + s]);
    const cols = pw / s, rows = ph / s;
    for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
      const k = r * cols + c;
      const score = Math.sqrt(Math.min(1, Math.max(0, cls[k])) * Math.min(1, Math.max(0, obj[k])));
      if(score < threshold) continue;
      const cx = (c + bb[k * 4]) * s, cy = (r + bb[k * 4 + 1]) * s;
      const bw = Math.exp(bb[k * 4 + 2]) * s, bh = Math.exp(bb[k * 4 + 3]) * s;
      const pts = [];
      for(let j = 0; j < 5; j++) pts.push([(kp[k * 10 + 2 * j] + c) * s, (kp[k * 10 + 2 * j + 1] + r) * s]);
      list.push({ x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, pts, score });
    }
  }
  return { faces: list };
}

/* ── Zonas de la cara (BiSeNet, face parsing) ────────────────────
   Recorte de la cara a 512×512, RGB normalizado como ImageNet; salida
   1×19×512×512 (fondo, piel, cejas, ojos, gafas, orejas, pendiente,
   nariz, boca, labios, cuello, collar, ropa, pelo, sombrero). Se
   devuelven las PROBABILIDADES (softmax) de cada zona que usa el
   retoque, 0-255, para que los bordes salgan suaves. */
const PARSE_GROUPS = { skin: [1, 7, 8, 10, 14], brows: [2, 3], eyes: [4, 5], mouth: [11], lips: [12, 13], hair: [17] };
async function parse({ model, id, rgba, parts }){
  const { session } = await getSession(id, model);
  const S = 512, n = S * S;
  const name = session.inputNames[0];
  const x = new Float32Array(3 * n), mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for(let p = 0, i = 0; p < n; p++, i += 4){
    x[p] = (rgba[i] / 255 - mean[0]) / std[0]; x[n + p] = (rgba[i + 1] / 255 - mean[1]) / std[1]; x[2 * n + p] = (rgba[i + 2] / 255 - mean[2]) / std[2];
  }
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, { [name]: makeTensor(inputType(session, name), x, [1, 3, S, S]) });
  const t = out[session.outputNames[0]], v = readFloats(t), C = t.dims[1];
  // `parts`: { nombre: [canales…] } a petición (selección por texto: pelo, orejas, cuello…); si no, los grupos del retoque
  const G = parts || PARSE_GROUPS, groups = {};
  for(const k in G) groups[k] = new Uint8ClampedArray(n);
  const e = new Float32Array(C);
  for(let p = 0; p < n; p++){
    let mx = -Infinity;
    for(let c = 0; c < C; c++){ e[c] = v[c * n + p]; if(e[c] > mx) mx = e[c]; }
    let sum = 0;
    for(let c = 0; c < C; c++){ e[c] = Math.exp(e[c] - mx); sum += e[c]; }
    for(const k in G){ let s = 0; for(const c of G[k]) s += e[c]; groups[k][p] = Math.round(s / sum * 255); }
  }
  return { groups };
}

/* ── Profundidad (Depth Anything V2 Small) ──────────────────────
   Entrada 1×3×518×518 RGB normalizado como ImageNet; salida 1×518×518
   de profundidad relativa INVERSA (mayor = más cerca). Se devuelve
   normalizada a 0-1 (1 = lo más cercano). */
async function depth({ model, id, rgba }){
  const { session, backend } = await getSession(id, model);
  const S = 518, n = S * S, x = new Float32Array(3 * n), mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for(let p = 0, i = 0; p < n; p++, i += 4){
    x[p] = (rgba[i] / 255 - mean[0]) / std[0]; x[n + p] = (rgba[i + 1] / 255 - mean[1]) / std[1]; x[2 * n + p] = (rgba[i + 2] / 255 - mean[2]) / std[2];
  }
  const name = session.inputNames[0];
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, { [name]: makeTensor(inputType(session, name), x, [1, 3, S, S]) });
  const v = readFloats(out[session.outputNames[0]]);
  let lo = Infinity, hi = -Infinity;
  for(let i = 0; i < n; i++){ if(v[i] < lo) lo = v[i]; if(v[i] > hi) hi = v[i]; }
  const d = new Float32Array(n), span = Math.max(1e-6, hi - lo);
  for(let i = 0; i < n; i++) d[i] = (v[i] - lo) / span;
  return { depth: d, size: S, backend };
}

/* ── Restaurar caras (GFPGAN v1.4, en dos mitades) ────────────────
   El modelo va partido en codificador (la cara → código latente y las
   15 «condiciones» que guían al generador) y decodificador (StyleGAN,
   que pinta la cara de 512×512): el mismo resultado exacto que el
   modelo entero, pero cada mitad cabe sola en memoria. Con `lowMem`
   (móviles) se suelta cada mitad antes de cargar la otra: el pico baja
   de ~1 GB a ~600 MB y un iPhone ya no se queda sin memoria.
   Entrada: `crops`, caras alineadas a 512×512 (plantilla FFHQ), RGBA.
   Salida: `outs`, RGBA 512×512. */
async function release(id){
  const e = sessions.get(id);
  if(!e) return;
  try{ await e.session.release(); }catch{}
  sessions.delete(id);
}
async function faceRestore({ model, id, crops, dec, decId, lowMem }){
  const S = 512, n = S * S, outs = [];
  post({ type:"stage", model:id, stage:"run" });
  for(const rgba of crops){
    const x = new Float32Array(3 * n);
    for(let p = 0, i = 0; p < n; p++, i += 4){ x[p] = rgba[i] / 127.5 - 1; x[n + p] = rgba[i + 1] / 127.5 - 1; x[2 * n + p] = rgba[i + 2] / 127.5 - 1; }
    const enc = (await getSession(id, model)).session;
    const mid = await runSession(id, model, { [enc.inputNames[0]]: makeTensor(inputType(enc, enc.inputNames[0]), x, [1, 3, S, S]) });
    if(lowMem) await release(id);
    const d = (await getSession(decId, dec)).session;
    const feeds = {};
    for(const name of d.inputNames) feeds[name] = mid[name];
    const out = await runSession(decId, dec, feeds);
    for(const k in mid){ try{ mid[k].dispose?.(); }catch{} }
    if(lowMem) await release(decId);
    const v = readFloats(out[d.outputNames[0]]), o = new Uint8ClampedArray(4 * n);
    for(let p = 0, i = 0; p < n; p++, i += 4){
      o[i] = (Math.max(-1, Math.min(1, v[p])) + 1) * 127.5;
      o[i + 1] = (Math.max(-1, Math.min(1, v[n + p])) + 1) * 127.5;
      o[i + 2] = (Math.max(-1, Math.min(1, v[2 * n + p])) + 1) * 127.5;
      o[i + 3] = 255;
    }
    outs.push(o);
  }
  if(lowMem){ await release(id); await release(decId); }
  return { outs };
}

/* ── Antiguos modelos de TensorFlow.js (ver models.js) ────────────── */
/* Photo Lens: las 10 clases de ImageNet más probables */
async function classify({ model, id, rgba }){
  const { session } = await getSession(id, model);
  const n = 224 * 224, x = new Float32Array(3 * n);
  for(let p = 0, i = 0; p < n; p++, i += 4){ x[p * 3] = rgba[i] / 127.5 - 1; x[p * 3 + 1] = rgba[i + 1] / 127.5 - 1; x[p * 3 + 2] = rgba[i + 2] / 127.5 - 1; }
  const name = session.inputNames[0];
  const out = await runSession(id, model, { [name]: new ort.Tensor("float32", x, [1, 224, 224, 3]) });
  const probs = readFloats(out[session.outputNames[0]]);
  const idx = Array.from(probs.keys()).sort((a, b) => probs[b] - probs[a]).slice(0, 10);
  return { top: idx.map(i => [i, probs[i]]) };
}

/* Cielo: probabilidad (0-1) en la rejilla de los logits, recortada a
   la parte que ocupa la imagen (el grafo la rellena hasta 513) */
async function segSky({ model, id, rgba, w, h, classes }){
  const { session } = await getSession(id, model);
  const x = new Uint8Array(w * h * 3);
  for(let p = 0, i = 0; p < w * h; p++, i += 4){ x[p * 3] = rgba[i]; x[p * 3 + 1] = rgba[i + 1]; x[p * 3 + 2] = rgba[i + 2]; }
  const name = session.inputNames[0];
  const out = await runSession(id, model, { [name]: new ort.Tensor("uint8", x, [1, h, w, 3]) });
  const t = out[session.outputNames[0]], [, C, GH, GW] = t.dims, v = readFloats(t), N = GH * GW;
  // Rejilla con esquinas alineadas: la celda r corresponde al píxel r·512/(GH−1)
  const st = 512 / (GH - 1), rh = Math.min(GH, Math.floor((h - 1) / st) + 1), rw = Math.min(GW, Math.floor((w - 1) / st) + 1);
  const prob = new Float32Array(rw * rh); let skyN = 0;
  const cls = classes?.length ? classes : [3];
  for(let r = 0; r < rh; r++) for(let c = 0; c < rw; c++){
    const q = r * GW + c; let mx = -Infinity, arg = 0;
    for(let k = 0; k < C; k++){ const val = v[k * N + q]; if(val > mx){ mx = val; arg = k; } }
    let s = 0; for(let k = 0; k < C; k++) s += Math.exp(v[k * N + q] - mx);
    // `classes`: canales de ADE20K a sumar (por defecto sólo el cielo, 3); la unión de varias clases
    // es la probabilidad de «cualquiera de ellas» (las clases son excluyentes: se suman)
    let pc = 0; for(const k of cls) pc += Math.exp(v[k * N + q] - mx);
    prob[r * rw + c] = pc / s;
    if(cls.includes(arg)) skyN++;
  }
  return { prob, w: rw, h: rh, hasSky: skyN > 0 };
}

/* Persona (BodyPix): probabilidad en la rejilla de salida (stride 16) */
async function segPerson({ model, id, rgba, w, h }){
  const { session } = await getSession(id, model);
  const x = new Float32Array(w * h * 3);
  for(let p = 0, i = 0; p < w * h; p++, i += 4){ x[p * 3] = rgba[i] / 127.5 - 1; x[p * 3 + 1] = rgba[i + 1] / 127.5 - 1; x[p * 3 + 2] = rgba[i + 2] / 127.5 - 1; }
  const name = session.inputNames[0];
  const out = await runSession(id, model, { [name]: new ort.Tensor("float32", x, [1, h, w, 3]) });
  const key = session.outputNames.find(o => /float_segments/.test(o));
  const t = out[key], [, GH, GW] = t.dims, v = readFloats(t);
  const prob = new Float32Array(GH * GW);
  for(let i = 0; i < prob.length; i++) prob[i] = 1 / (1 + Math.exp(-v[i]));
  return { prob, w: GW, h: GH };
}

/* ── Modelos guardados en este navegador (Ayuda › Diagnóstico) ── */
async function listStored(){
  try{
    const db = await openDb();
    return await new Promise(resolve => {
      const out = [], r = db.transaction(STORE).objectStore(STORE).openCursor();
      r.onsuccess = () => { const c = r.result; if(!c){ resolve(out); return; } out.push({ url: c.key, size: c.value?.size || 0 }); c.continue(); };
      r.onerror = () => resolve(out);
    });
  }catch{ return []; }
}
async function deleteStored(url){
  try{
    const db = await openDb();
    await new Promise(resolve => { const tx = db.transaction(STORE, "readwrite"); url ? tx.objectStore(STORE).delete(url) : tx.objectStore(STORE).clear(); tx.oncomplete = tx.onerror = () => resolve(); });
  }catch{}
}

/* Modelos sustituidos por otros: se borran de IndexedDB para no dejar
   cientos de MB huérfanos (GFPGAN entero → GFPGAN en dos mitades). */
const OBSOLETE = ["gfpgan/gfpgan_1.4_fp16.onnx"].map(p => new URL("../../assets/models/" + p, import.meta.url).href);
setTimeout(() => { for(const u of OBSOLETE) deleteStored(u).catch?.(() => {}); }, 3000);

/* ── CLIPSeg (descripción libre): una o varias vistas de 352×352 de la misma foto con el mismo texto; devuelve los «logits» de cada una ── */
async function clipseg({ model, id, tiles, ids, mask }){
  const { session } = await getSession(id, model);
  const S = 352, n = S * S, mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  const toBig = a => BigInt64Array.from(Array.from(a, v => BigInt(v)));
  const outs = [];
  post({ type:"stage", model:id, stage:"run" });
  for(const rgba of tiles){
    const x = new Float32Array(3 * n);
    for(let p = 0, i = 0; p < n; p++, i += 4){
      x[p] = (rgba[i] / 255 - mean[0]) / std[0]; x[n + p] = (rgba[i + 1] / 255 - mean[1]) / std[1]; x[2 * n + p] = (rgba[i + 2] / 255 - mean[2]) / std[2];
    }
    const out = await runSession(id, model, {
      input_ids: new ort.Tensor("int64", toBig(ids), [1, ids.length]),
      pixel_values: new ort.Tensor("float32", x, [1, 3, S, S]),
      attention_mask: new ort.Tensor("int64", toBig(mask), [1, mask.length])
    });
    outs.push(Float32Array.from(readFloats(out[session.outputNames[0]]).subarray(0, n)));
  }
  return { outs };
}

const TASKS = { clipseg, matte, inpaint, restore, upscale, colorize, probe, samEncode, samDecode, faces, parse, depth, faceRestore, classify, segSky, segPerson };

self.onmessage = async e => {
  const m = e.data || {};
  if(m.type === "cached"){
    post({ type:"cached", req: m.req, cached: (new URL(m.url).origin === self.location.origin && !m.store) || await dbHas(m.url) });
    return;
  }
  if(m.type === "stored"){ post({ type:"stored", req: m.req, list: await listStored() }); return; }
  if(m.type === "forget"){
    await deleteStored(m.url);
    for(const [k, s] of sessions){ try{ await s.session.release(); }catch{} sessions.delete(k); }
    samCache = null;
    post({ type:"forgot", req: m.req }); return;
  }
  const task = TASKS[m.type];
  if(!task) return;
  try{
    const t0 = performance.now();
    const res = await task(m);
    const backend = sessions.get(m.id)?.backend;
    const transfer = [res.mask?.buffer, res.rgba?.buffer, res.ab?.buffer, res.logits?.buffer, res.lowRes?.buffer, res.depth?.buffer, res.prob?.buffer,
                      ...(res.outs || []).map(o => o.buffer),
                      ...Object.values(res.groups || {}).map(g => g.buffer)].filter(Boolean);
    post({ type:"result", req: m.req, ...res, backend, ms: Math.round(performance.now() - t0) }, transfer);
    // Un modelo grande no se queda ocupando cientos de MB después de usarlo.
    if((m.model?.size || 0) > 100e6 && sessions.has(m.id)){
      try{ await sessions.get(m.id).session.release(); }catch{}
      sessions.delete(m.id);
    }
  }catch(err){
    post({ type:"error", req: m.req, message: String(err?.message || err) });
  }
};
