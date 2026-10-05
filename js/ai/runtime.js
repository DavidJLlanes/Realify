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

/* ── Aviso de trabajo en curso ──────────────────────────────────
   La barra de estado no existe en el móvil y la píldora que la
   sustituye se esconde a los 2,4 s: con un modelo que tarda medio
   minuto, el diálogo se cerraba y no quedaba NADA a la vista, como si
   no hubiera hecho nada. Este aviso se queda mientras trabaja, con el
   paso actual, el tiempo y un botón para cancelar (que es también la
   salida si el navegador se queda sin memoria y el motor no responde). */
let busy = null;
function showBusy(title){
  hideBusy();
  const el = document.createElement("div");
  el.className = "ai-busy";
  el.setAttribute("role", "status");
  el.innerHTML = `<span class="ai-busy-spin" aria-hidden="true"></span>
    <div class="ai-busy-text"><b></b><span class="ai-busy-msg">Preparando…</span>
    <small class="ai-busy-hint" hidden>Si no avanza, cancela y prueba con un modelo más ligero.</small></div>
    <span class="ai-busy-time mono">0 s</span>
    <button type="button" class="ai-busy-cancel">Cancelar</button>`;
  el.querySelector("b").textContent = title;
  el.querySelector(".ai-busy-cancel").addEventListener("click", cancelAll);
  document.body.appendChild(el);
  const t0 = performance.now();
  const timer = setInterval(() => {
    const s = Math.round((performance.now() - t0) / 1000);
    el.querySelector(".ai-busy-time").textContent = s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
    if(s >= 60) el.querySelector(".ai-busy-hint").hidden = false;
  }, 1000);
  busy = { el, timer };
}
function busyMsg(msg){ if(busy) busy.el.querySelector(".ai-busy-msg").textContent = msg; }
function hideBusy(){
  if(!busy) return;
  clearInterval(busy.timer); busy.el.remove(); busy = null;
}

/* Cancelar: se para el worker en seco (una inferencia de ONNX no se
   puede interrumpir de otro modo) y se arranca otro la próxima vez. */
let session = null;   // { cancelled } mientras dura una operación de varias pasadas
function cancelAll(){
  if(session) session.cancelled = true;
  if(worker){ worker.terminate(); worker = null; }
  const err = new Error("cancelado");
  err.cancelled = true;
  for(const p of pending.values()) p.reject(err);
  pending.clear();
  hideBusy();
}

const TITLES = { matte: "Eliminando fondo con IA", inpaint: "Rellenando con IA", restore: "Procesando con IA", upscale: "Ampliando con IA", colorize: "Coloreando con IA", samEncode: "Analizando la foto con IA", faceRestore: "Restaurando caras con IA", clipseg: "Buscando en la foto con IA" };

/* ── Red de seguridad para modelos pesados ──────────────────────
   Un modelo grande (ISNet, LaMa…) puede agotar la memoria de la
   pestaña; entonces el navegador la mata y la recarga, y con ella se
   iba la imagen abierta. Antes de lanzarlo se guardan las pestañas
   (io/project.js) y se deja una marca; si la página vuelve a arrancar
   con la marca puesta es que se cayó a mitad: se reabren y se recuerda
   que ese modelo no cabe en este dispositivo. */
const HEAVY = 80e6, STASH_KEY = "before-ai", RUNNING = "realify.aiRunning", CRASHED = "realify.aiCrashed";
const readCrashed = () => { try{ return JSON.parse(localStorage.getItem(CRASHED) || "{}"); }catch{ return {}; } };
const writeCrashed = v => { try{ localStorage.setItem(CRASHED, JSON.stringify(v)); }catch{} };

/** ¿Se cerró la página la última vez que se usó este modelo aquí? */
export const crashedBefore = id => !!readCrashed()[id];

async function guardHeavy(id, model, title){
  if(crashedBefore(id)){
    const ok = await confirmDlg("Modelo muy pesado para este dispositivo",
      `La última vez, <b>${model.label}</b> cerró la página por falta de memoria en este
       dispositivo. Puedes probar otra vez (tu imagen se guarda antes y se recupera si vuelve
       a pasar) o cancelar y usar un modelo más ligero.`, "Probar otra vez");
    if(!ok){ const e = new Error("cancelado"); e.cancelled = true; throw e; }
  }
  showBusy(title);
  busyMsg("Guardando una copia de tu imagen por seguridad…");
  try{ const { stashForUpdate } = await import("../io/project.js"); await stashForUpdate(STASH_KEY); }catch{}
  try{ localStorage.setItem(RUNNING, JSON.stringify({ id, t: Date.now() })); }catch{}
}
function releaseHeavy(id, ok){
  try{ localStorage.removeItem(RUNNING); }catch{}
  if(ok){ const c = readCrashed(); if(c[id]){ delete c[id]; writeCrashed(c); } }
  import("../io/project.js").then(m => m.discardStash(STASH_KEY)).catch(() => {});
}

/** Varias llamadas seguidas a un modelo pesado bajo UNA sola copia de
    seguridad (p. ej. «Expandir» por teselas): dentro de `fn`, usar
    runModel(…, { noGuard: true }). */
export async function withHeavyGuard(id, title, fn){
  const model = MODELS[id];
  if(!model) throw new Error("Modelo desconocido: " + id);
  await confirmDownload(id);
  const heavy = model.size > HEAVY;
  let ok = false;
  try{
    if(heavy) await guardHeavy(id, model, title);
    const r = await fn();
    ok = true;
    return r;
  }finally{ if(heavy) releaseHeavy(id, ok); hideBusy(); }
}

const cancelledError = () => { const e = new Error("cancelado"); e.cancelled = true; return e; };

/** Operación de IA de varias pasadas (bloques, varias caras…) con UN
    solo aviso «trabajando», un progreso continuo y un Cancelar que la
    para entera: `fn(step)` llama a runModel tantas veces como quiera y
    a `step(hechos, total)` al acabar cada bloque (`unit`: «bloque»,
    «cara»…, para el texto del aviso). Al cancelar, la
    llamada en curso y todas las siguientes fallan con `err.cancelled`. */
export async function aiSession(title, fn, { unit = "bloque" } = {}){
  if(session) return fn(() => {});              // anidada: la de fuera manda
  const s = session = { title, cancelled: false, heavy: new Set() };
  showBusy(title);
  progress(0.02);
  let ok = false;
  const step = (done, total) => {
    if(s.cancelled) throw cancelledError();
    const msg = `Procesando la imagen… ${unit} ${Math.min(done + 1, total)} de ${total}`;
    status(msg); busyMsg(done >= total ? "Terminando…" : msg);
    progress(0.05 + 0.9 * done / Math.max(1, total));
  };
  try{ const r = await fn(step); if(s.cancelled) throw cancelledError(); ok = true; return r; }
  finally{
    for(const id of s.heavy) releaseHeavy(id, ok);
    session = null;
    hideBusy(); progress(null); status("");
  }
}

/** Al arrancar (main.js): si la página se cayó con un modelo pesado en
    marcha, reabre lo que había y lo explica. */
export async function recoverAfterCrash(){
  let run = null;
  try{ run = JSON.parse(localStorage.getItem(RUNNING) || "null"); localStorage.removeItem(RUNNING); }catch{}
  if(!run) return;
  const c = readCrashed(); c[run.id] = true; writeCrashed(c);
  let n = 0;
  try{ const { restoreAfterUpdate } = await import("../io/project.js"); n = await restoreAfterUpdate(STASH_KEY); }catch{}
  const { toast } = await import("../ui/toast.js");
  toast(`${MODELS[run.id]?.label || "El modelo de IA"} necesitó más memoria de la que tiene este dispositivo y la página se cerró.` +
        (n ? " Tu imagen se ha recuperado." : "") + " Prueba con un modelo más ligero.", "err");
}

function ensureWorker(){
  if(worker) return worker;
  if(typeof Worker === "undefined") throw new Error("Este navegador no tiene Web Workers.");
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = e => {
    const m = e.data || {};
    if(m.type === "download"){
      const f = m.total ? m.loaded / m.total : 0;
      const msg = `Descargando modelo ${MODELS[m.model]?.label || ""}… ${mb(m.loaded)}` +
                  (m.total ? ` de ${mb(m.total)}` : "");
      status(msg); busyMsg(msg);
      progress(f * 0.5);
      return;
    }
    if(m.type === "stage"){
      const msg = m.stage === "load" ? "Preparando el modelo…" : "Procesando la imagen…";
      status(msg); busyMsg(msg);
      progress(m.stage === "load" ? 0.55 : 0.6);
      return;
    }
    if(m.type === "tiles"){
      const msg = `Procesando la imagen… ${m.done} / ${m.total}`;
      status(msg); busyMsg(msg);
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
    const err = new Error(ev.message || "el motor de IA se ha detenido (posiblemente por falta de memoria)");
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
export async function runModel(type, id, payload, transfer, opts = {}){
  const model = MODELS[id];
  if(!model) throw new Error("Modelo desconocido: " + id);
  await confirmDownload(id);
  if(session?.cancelled) throw cancelledError();
  // `opts.quiet`: llamadas rapidísimas y repetidas (cada toque con SAM):
  // sin aviso, progreso ni barra de estado.
  if(opts.quiet){
    try{ return await call({ type, id, model, ...payload }, transfer); }
    catch(err){ if(/bad_alloc|out of memory|memory access out of bounds/i.test(err.message)) err.message = "no hay memoria suficiente en este dispositivo"; throw err; }
  }
  // `opts.noGuard`: pasadas 2ª y siguientes de una misma operación (la
  // copia de seguridad ya se hizo en la primera). `opts.title`: aviso.
  /* Dentro de una sesión (aiSession): el aviso, el progreso y la copia
     de seguridad son de la sesión; aquí sólo se llama al modelo. */
  if(session){
    if(session.cancelled) throw cancelledError();
    if(model.size > HEAVY && !session.heavy.has(id)){ session.heavy.add(id); await guardHeavy(id, model, session.title); }
    try{ return await call({ type, id, model, ...payload }, transfer); }
    catch(err){
      if(session.cancelled) throw cancelledError();
      if(/bad_alloc|out of memory|memory access out of bounds|Aborted\(|RangeError: Array buffer allocation/i.test(err.message))
        err.message = "no hay memoria suficiente en este dispositivo para el modelo " + model.label + ". Prueba con uno más ligero";
      throw err;
    }
  }
  const heavy = model.size > HEAVY && !opts.noGuard;
  let ok = false;
  progress(0.02);
  try{
    if(heavy) await guardHeavy(id, model, TITLES[type] || "Procesando con IA");
    if(busy) busyMsg("Preparando…"); else showBusy(opts.title || TITLES[type] || "Procesando con IA");
    const res = await call({ type, id, model, ...payload }, transfer);
    ok = true;
    return res;
  }catch(err){
    /* Mensajes del motor que no dicen nada a quien edita una foto. */
    if(!err.cancelled && /bad_alloc|out of memory|memory access out of bounds|Aborted\(|RangeError: Array buffer allocation/i.test(err.message))
      err.message = "no hay memoria suficiente en este dispositivo para el modelo " + model.label + ". Prueba con uno más ligero";
    throw err;
  }finally{
    if(heavy) releaseHeavy(id, ok);
    hideBusy();
    progress(null);
    status("");
  }
}

/* Los modelos remotos pesan de 26 a 208 MB y se bajan de Hugging
   Face la primera vez. Antes empezaba la descarga sin decir nada: en
   datos móviles o sin conexión eso era una sorpresa (o un fallo sin
   explicación). Ahora se avisa del tamaño y del origen y se pide
   permiso una sola vez por modelo; si ya está en el equipo, nada. Los
   modelos de un mismo `group` (codificador y decodificador de SAM) se
   piden juntos, con un solo aviso y el tamaño total. */
const approved = new Set();
const isLocal = m => new URL(m.url).origin === location.origin && !m.store;
async function confirmDownload(id){
  const m = MODELS[id];
  if(isLocal(m) || approved.has(id)) return;
  const ids = m.group ? Object.keys(MODELS).filter(k => MODELS[k].group === m.group) : [id];
  const missing = [];
  for(const k of ids) if(!approved.has(k) && !(await isModelCached(k))) missing.push(k);
  if(!missing.length){ ids.forEach(k => approved.add(k)); return; }
  const total = missing.reduce((a, k) => a + MODELS[k].size, 0);
  const names = missing.map(k => MODELS[k].label).join(" + ");
  const from = new URL(m.url).origin === location.origin ? "realify.es" : "Hugging Face";
  if(typeof navigator !== "undefined" && navigator.onLine === false)
    throw new Error(`hace falta conexión para descargar una vez el modelo ${names} (${mb(total)})`);
  const ok = await confirmDlg("Descargar modelo de IA",
    `Para esto hace falta el modelo <b>${names}</b>, de <b>${mb(total)}</b>. Se descarga
     una sola vez desde ${from} y se guarda en este navegador para las
     siguientes veces, también sin conexión. Tu imagen no se envía a ningún
     sitio: se procesa en tu equipo. Si usas datos móviles, mejor con wifi.`,
    "Descargar");
  if(!ok) throw new Error("descarga del modelo cancelada");
  ids.forEach(k => approved.add(k));
}

/** ¿Está el modelo ya en el equipo? (local o descargado antes). */
export function isModelCached(id){
  const model = MODELS[id];
  if(!model) return Promise.resolve(false);
  return call({ type:"cached", url: model.url, store: !!model.store }).then(m => !!m.cached).catch(() => false);
}

/** Texto corto para las opciones de un selector: «incluido» si viaja
    con la app, «descargado» si ya se bajó antes, «descarga 26 MB» si
    no. Consulta IndexedDB, de ahí que sea asíncrona. */
export async function sizeNote(id){
  const m = MODELS[id];
  if(isLocal(m)) return "incluido";
  return await isModelCached(id) ? "descargado" : "descarga " + mb(m.size);
}

/** Modelos descargados en este navegador (Ayuda › Diagnóstico):
    [{ id, label, size, premium }], con lo que ocupan de verdad. */
export async function storedModels(){
  const { list } = await call({ type:"stored" });
  return list.map(({ url, size }) => {
    const id = Object.keys(MODELS).find(k => MODELS[k].url === url);
    const m = id ? MODELS[id] : null;
    return { url, id, size, label: m ? m.label : url.split("/").pop(), premium: !!m?.premium };
  });
}
/** Borra un modelo descargado (o todos, sin `url`). */
export async function forgetModel(url){
  await call({ type:"forget", url });
  approved.clear();
}
