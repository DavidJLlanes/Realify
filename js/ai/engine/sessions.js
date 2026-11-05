/* ═══════════════════════════════════════════════════════════════
   IA · WORKER · SESIONES DE ONNX RUNTIME
   Crea y reutiliza las sesiones: WebGPU si hay adaptador real; si no, o si el modelo no arranca con ella, WebAssembly.
   Entradas: id y descriptor del modelo; los tensores de entrada. Salidas: la sesión y su backend; el resultado de la inferencia.
   Límite: un modelo que falla en GPU se recuerda (gpuFailed) y no vuelve a intentarlo en esa sesión del worker.
   ═══════════════════════════════════════════════════════════════ */

import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { fetchModel } from "./model-store.js";
import { post } from "./post.js";

export const sessions = new Map();   // id → { session, backend }

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

export async function getSession(id, model){
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
export async function runSession(id, model, feeds){
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

/* ── Restaurar caras (GFPGAN v1.4, en dos mitades) ────────────────
   El modelo va partido en codificador (la cara → código latente y las
   15 «condiciones» que guían al generador) y decodificador (StyleGAN,
   que pinta la cara de 512×512): el mismo resultado exacto que el
   modelo entero, pero cada mitad cabe sola en memoria. Con `lowMem`
   (móviles) se suelta cada mitad antes de cargar la otra: el pico baja
   de ~1 GB a ~600 MB y un iPhone ya no se queda sin memoria.
   Entrada: `crops`, caras alineadas a 512×512 (plantilla FFHQ), RGBA.
   Salida: `outs`, RGBA 512×512. */
export async function release(id){
  const e = sessions.get(id);
  if(!e) return;
  try{ await e.session.release(); }catch{}
  sessions.delete(id);
}
