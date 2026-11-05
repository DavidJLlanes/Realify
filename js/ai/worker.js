/* ═══════════════════════════════════════════════════════════════
   IA · WORKER
   ONNX Runtime Web (js/vendor/ort) y los modelos viven aquí, fuera del
   hilo de la interfaz. WebGPU si el navegador la tiene; si no, o si el
   modelo no arranca con ella, WebAssembly en la CPU.

   Los modelos remotos se descargan una sola vez y se guardan en
   IndexedDB —no en la Cache API: el service worker borra en cada
   versión todas las cachés que no son la suya (ver sw.js), y volver a
   bajar 200 MB por cada despliegue sería inaceptable—.

   Este archivo es sólo el despachador (Fase 0 del plan de IA): configura
   ONNX Runtime, la tabla TASKS y onmessage. El resto vive aparte:
     · js/ai/engine/ → mensajes, almacén de modelos, sesiones, tensores, teselas
     · js/ai/tasks/  → una tarea por archivo (matte, inpaint, restore, upscale,
                       colorize, probe, sam, faces, parse, depth, face-restore,
                       classify, sky, person, clipseg, landmarks, hands, pose, humanparse)
   Una tarea nueva = un archivo en tasks/ y una línea en TASKS.
   ═══════════════════════════════════════════════════════════════ */

/* Los dos módulos del motor van con extensión .js y no con la .mjs
   con la que se publican: los módulos exigen un tipo MIME de
   JavaScript, y el nginx de producción sirve .mjs como
   application/octet-stream, así que el worker no llegaba ni a arrancar
   («El motor de IA ha fallado»). Con .js no depende de la configuración
   del servidor. Por eso también se le dan a ONNX Runtime las dos rutas
   explícitas, en vez de la carpeta: por sí mismo buscaría el .mjs. */

import * as ort from "../vendor/ort/ort.webgpu.min.js";
import "./lab.js";
import { deleteStored, dbHas, listStored } from "./engine/model-store.js";
import { clipseg } from "./tasks/clipseg.js";
import { matte } from "./tasks/matte.js";
import { inpaint } from "./tasks/inpaint.js";
import { restore } from "./tasks/restore.js";
import { upscale } from "./tasks/upscale.js";
import { colorize } from "./tasks/colorize.js";
import { probe } from "./tasks/probe.js";
import { samEncode, samDecode, clearSamCache } from "./tasks/sam.js";
import { faces } from "./tasks/faces.js";
import { parse } from "./tasks/parse.js";
import { depth } from "./tasks/depth.js";
import { faceRestore } from "./tasks/face-restore.js";
import { classify } from "./tasks/classify.js";
import { segSky } from "./tasks/sky.js";
import { segPerson } from "./tasks/person.js";
import { landmarks } from "./tasks/landmarks.js";
import { handDetect, handLandmarks } from "./tasks/hands.js";
import { pose } from "./tasks/pose.js";
import { humanParse } from "./tasks/humanparse.js";
import { post } from "./engine/post.js";
import { sessions } from "./engine/sessions.js";

ort.env.wasm.wasmPaths = {
  mjs:  new URL("../vendor/ort/ort-wasm-simd-threaded.asyncify.js", import.meta.url).href,
  wasm: new URL("../vendor/ort/ort-wasm-simd-threaded.asyncify.wasm", import.meta.url).href
};

// Sin aislamiento de origen no hay SharedArrayBuffer ni, por tanto,
// hilos: se pide uno explícitamente para que no lo intente y avise.
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

ort.env.logLevel = "error";

/* Modelos sustituidos por otros: se borran de IndexedDB para no dejar
   cientos de MB huérfanos (GFPGAN entero → GFPGAN en dos mitades). */
const OBSOLETE = ["gfpgan/gfpgan_1.4_fp16.onnx"].map(p => new URL("../../assets/models/" + p, import.meta.url).href);

setTimeout(() => { for(const u of OBSOLETE) deleteStored(u).catch?.(() => {}); }, 3000);

const TASKS = { clipseg, matte, inpaint, restore, upscale, colorize, probe, samEncode, samDecode, faces, parse, depth, faceRestore, classify, segSky, segPerson, landmarks, handDetect, handLandmarks, pose, humanParse };

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
    clearSamCache();
    post({ type:"forgot", req: m.req }); return;
  }
  const task = TASKS[m.type];
  if(!task) return;
  try{
    const t0 = performance.now();
    const res = await task(m);
    const backend = sessions.get(m.id)?.backend;
    const transfer = [res.mask?.buffer, res.rgba?.buffer, res.ab?.buffer, res.logits?.buffer, res.lowRes?.buffer, res.depth?.buffer, res.prob?.buffer, res.pts?.buffer, res.probs?.buffer,
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
