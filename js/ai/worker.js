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
  const local = new URL(model.url).origin === self.location.origin;
  if(!local){
    const cached = await dbGet(model.url);
    if(cached) return new Uint8Array(await cached.arrayBuffer());
  }
  const res = await fetch(model.url);
  if(!res.ok) throw new Error(`No se pudo descargar el modelo (${res.status}).`);
  const total = +res.headers.get("content-length") || model.size || 0;
  const reader = res.body.getReader();
  const chunks = []; let loaded = 0, last = 0;
  for(;;){
    const { done, value } = await reader.read();
    if(done) break;
    chunks.push(value); loaded += value.length;
    const now = performance.now();
    if(now - last > 150){ last = now; post({ type:"download", model:id, loaded, total }); }
  }
  post({ type:"download", model:id, loaded, total: total || loaded });
  const blob = new Blob(chunks);
  if(!local) await dbPut(model.url, blob);
  return new Uint8Array(await blob.arrayBuffer());
}

/* Modelos que ya fallaron en WebGPU durante esta sesión (p. ej. «Too
   many storage buffers» en GPUs con límites bajos): no se reintenta. */
const gpuFailed = new Set();

async function getSession(id, model){
  if(sessions.has(id)) return sessions.get(id);
  // Un solo modelo en memoria a la vez: dos de 200 MB juntos tumban
  // la pestaña en un móvil.
  for(const [k, s] of sessions){ try{ await s.session.release(); }catch{} sessions.delete(k); }

  const bytes = await fetchModel(id, model);
  post({ type:"stage", model:id, stage:"load" });
  const opts = { graphOptimizationLevel: "all", logSeverityLevel: 3 };
  let session = null, backend = "wasm";
  // `model.cpu`: modelos cuyo resultado con WebGPU no es fiable.
  if(self.navigator?.gpu && !model.cpu && !gpuFailed.has(id)){
    try{
      session = await ort.InferenceSession.create(bytes, { ...opts, executionProviders: ["webgpu", "wasm"] });
      backend = "webgpu";
    }catch{ session = null; gpuFailed.add(id); }
  }
  // En la CPU la memoria es el límite (WebAssembly de 32 bits: 4 GB en
  // total). Sin arena ni patrón de memoria el pico baja mucho a cambio
  // de algo de velocidad, que es lo que permite a BiRefNet trabajar a
  // 1024 px sin «bad_alloc».
  if(!session) session = await ort.InferenceSession.create(bytes, { ...opts,
    executionProviders: ["wasm"], enableCpuMemArena: false, enableMemPattern: false });
  const entry = { session, backend };
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
  const mask = new Uint8ClampedArray(n);
  for(let i = 0; i < n; i++){
    const v = logits ? 1 / (1 + Math.exp(-vals[i])) : vals[i];
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

async function probe({ model, id }){
  const { session, backend } = await getSession(id, model);
  return { backend, inputs: session.inputMetadata || session.inputNames,
           outputs: session.outputMetadata || session.outputNames };
}

const TASKS = { matte, inpaint, restore, probe };

self.onmessage = async e => {
  const m = e.data || {};
  if(m.type === "cached"){
    post({ type:"cached", req: m.req, cached: new URL(m.url).origin === self.location.origin || await dbHas(m.url) });
    return;
  }
  const task = TASKS[m.type];
  if(!task) return;
  try{
    const t0 = performance.now();
    const res = await task(m);
    const backend = sessions.get(m.id)?.backend;
    const transfer = [res.mask?.buffer, res.rgba?.buffer].filter(Boolean);
    post({ type:"result", req: m.req, ...res, backend, ms: Math.round(performance.now() - t0) }, transfer);
  }catch(err){
    post({ type:"error", req: m.req, message: String(err?.message || err) });
  }
};
