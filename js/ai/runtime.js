/* ═══════════════════════════════════════════════════════════════
   IA · ORQUESTADOR
   Mismo papel que filters/segment/segment.js: arranca el worker de
   ONNX Runtime una sola vez, le pasa píxeles y devuelve el resultado.
   Mientras tanto informa en la barra de estado y en la barra de
   progreso de la app —descarga del modelo, carga y teselas—, porque
   un modelo de 200 MB sin ninguna señal parece una página colgada.
   ═══════════════════════════════════════════════════════════════ */

import { MODELS, mb } from "./models.js";
import { status, progress } from "../ui/toast.js";
import { confirmDlg } from "../ui/dialog.js";

let worker = null, nextReq = 1;
const pending = new Map();

function ensureWorker(){
  if(worker) return worker;
  if(typeof Worker === "undefined") throw new Error("Este navegador no tiene Web Workers.");
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = e => {
    const m = e.data || {};
    if(m.type === "download"){
      const f = m.total ? m.loaded / m.total : 0;
      status(`Descargando modelo ${MODELS[m.model]?.label || ""}… ${mb(m.loaded)}` +
             (m.total ? ` de ${mb(m.total)}` : ""));
      progress(f * 0.5);
      return;
    }
    if(m.type === "stage"){
      status(m.stage === "load" ? "Preparando el modelo…" : "Procesando con IA…");
      progress(m.stage === "load" ? 0.55 : 0.6);
      return;
    }
    if(m.type === "tiles"){
      status(`Procesando con IA… ${m.done} / ${m.total}`);
      progress(0.6 + 0.4 * m.done / m.total);
      return;
    }
    const p = pending.get(m.req);
    if(!p) return;
    pending.delete(m.req);
    if(m.type === "error") p.reject(new Error(m.message));
    else p.resolve(m);
  };
  worker.onerror = ev => {
    const err = new Error(ev.message || "El motor de IA ha fallado.");
    for(const p of pending.values()) p.reject(err);
    pending.clear();
    worker = null;
  };
  return worker;
}

function call(msg, transfer){
  const w = ensureWorker();
  const req = nextReq++;
  return new Promise((resolve, reject) => {
    pending.set(req, { resolve, reject });
    w.postMessage({ ...msg, req }, transfer || []);
  });
}

/** Ejecuta una tarea del worker (`matte`, `inpaint`, `restore`) con
    el modelo `id` del catálogo. Limpia estado y progreso al acabar. */
export async function runModel(type, id, payload, transfer){
  const model = MODELS[id];
  if(!model) throw new Error("Modelo desconocido: " + id);
  await confirmDownload(id);
  progress(0.02);
  try{
    return await call({ type, id, model, ...payload }, transfer);
  }finally{
    progress(null);
    status("");
  }
}

/* Los modelos remotos pesan de 26 a 208 MB y se bajan de Hugging
   Face la primera vez. Antes empezaba la descarga sin decir nada: en
   datos móviles o sin conexión eso era una sorpresa (o un fallo sin
   explicación). Ahora se avisa del tamaño y del origen y se pide
   permiso una sola vez por modelo; si ya está en el equipo, nada. */
const approved = new Set();
async function confirmDownload(id){
  const m = MODELS[id];
  if(new URL(m.url).origin === location.origin || approved.has(id)) return;
  if(await isModelCached(id)){ approved.add(id); return; }
  if(typeof navigator !== "undefined" && navigator.onLine === false)
    throw new Error(`hace falta conexión para descargar una vez el modelo ${m.label} (${mb(m.size)})`);
  const ok = await confirmDlg("Descargar modelo de IA",
    `Para esto hace falta el modelo <b>${m.label}</b>, de <b>${mb(m.size)}</b>. Se descarga
     una sola vez desde Hugging Face y se guarda en este navegador para las
     siguientes veces, también sin conexión. Tu imagen no se envía a ningún
     sitio: se procesa en tu equipo. Si usas datos móviles, mejor con wifi.`,
    "Descargar");
  if(!ok) throw new Error("descarga del modelo cancelada");
  approved.add(id);
}

/** ¿Está el modelo ya en el equipo? (local o descargado antes). */
export function isModelCached(id){
  const model = MODELS[id];
  if(!model) return Promise.resolve(false);
  return call({ type:"cached", url: model.url }).then(m => !!m.cached).catch(() => false);
}

/** Texto corto para las opciones de un selector: «incluido» si viaja
    con la app, «descargado» si ya se bajó antes, «descarga 26 MB» si
    no. Consulta IndexedDB, de ahí que sea asíncrona. */
export async function sizeNote(id){
  const m = MODELS[id];
  if(new URL(m.url).origin === location.origin) return "incluido";
  return await isModelCached(id) ? "descargado" : "descarga " + mb(m.size);
}
