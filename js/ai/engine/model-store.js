/* ═══════════════════════════════════════════════════════════════
   IA · WORKER · ALMACÉN DE MODELOS
   Descarga cada modelo una sola vez y lo guarda en IndexedDB (no en la Cache API: el service worker la vacía en cada versión).
   Entradas: id y descriptor del modelo. Salidas: bytes del modelo; lista y borrado de lo guardado.
   Límite: los modelos servidos por la propia web no se guardan, se leen de su URL.
   ═══════════════════════════════════════════════════════════════ */

import { post } from "./post.js";

const DB_NAME = "realify-ai", STORE = "models";

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

export async function dbHas(key){
  try{
    const db = await openDb();
    return await new Promise(resolve => {
      const r = db.transaction(STORE).objectStore(STORE).count(key);
      r.onsuccess = () => resolve(r.result > 0);
      r.onerror = () => resolve(false);
    });
  }catch{ return false; }
}

export async function fetchModel(id, model){
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
  // Integridad: si el catálogo declara `sha256`, el archivo debe coincidir (los pesos vienen de terceros).
  if(model.sha256 && !local){
    const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hex = Array.from(d, b => b.toString(16).padStart(2, "0")).join("");
    if(hex !== String(model.sha256).toLowerCase()) throw new Error("El modelo descargado no coincide con su huella SHA-256; se ha descartado.");
  }
  if(!local) await dbPut(model.url, new Blob([bytes]));
  return bytes;
}

/* ── Modelos guardados en este navegador (Ayuda › Diagnóstico) ── */
export async function listStored(){
  try{
    const db = await openDb();
    return await new Promise(resolve => {
      const out = [], r = db.transaction(STORE).objectStore(STORE).openCursor();
      r.onsuccess = () => { const c = r.result; if(!c){ resolve(out); return; } out.push({ url: c.key, size: c.value?.size || 0 }); c.continue(); };
      r.onerror = () => resolve(out);
    });
  }catch{ return []; }
}

export async function deleteStored(url){
  try{
    const db = await openDb();
    await new Promise(resolve => { const tx = db.transaction(STORE, "readwrite"); url ? tx.objectStore(STORE).delete(url) : tx.objectStore(STORE).clear(); tx.oncomplete = tx.onerror = () => resolve(); });
  }catch{}
}
