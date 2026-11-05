/* ═══════════════════════════════════════════════════════════════
   BUSCAR FOTOS · ÍNDICE EN INDEXEDDB
   Guarda por foto un registro pequeño (lo que vio la IA + una miniatura de 160 px), nunca la foto. Todo queda en este navegador.
   Entradas: registros { clave, nombre, tam, fecha, reg, mini }. Salidas: promesas. Sin DOM; la base se llama «realify-biblioteca».
   Límites: si IndexedDB no existe (modo privado de algunos navegadores) las funciones no fallan: el índice dura sólo la sesión.
   ═══════════════════════════════════════════════════════════════ */
const DB = "realify-biblioteca", ALMACEN = "fotos";
let memoria = new Map();

const abrir = () => new Promise((ok, no) => {
  if(typeof indexedDB === "undefined") return no(new Error("sin IndexedDB"));
  const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN, { keyPath: "clave" });
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
});
const pedir = async (modo, fn) => { const db = await abrir(); return new Promise((ok, no) => { const tx = db.transaction(ALMACEN, modo), q = fn(tx.objectStore(ALMACEN)); tx.oncomplete = () => ok(q && q.result); tx.onerror = () => no(tx.error); }); };

export const claveDe = f => `${f.name}|${f.size}|${f.lastModified || 0}`;

export async function guardar(rec){ memoria.set(rec.clave, rec); try{ await pedir("readwrite", s => s.put(rec)); }catch{} }
export async function todos(){ try{ const l = await pedir("readonly", s => s.getAll()); if(l) l.forEach(r => memoria.set(r.clave, r)); }catch{} return [...memoria.values()]; }
export async function conocida(clave){ if(memoria.has(clave)) return memoria.get(clave); try{ const r = await pedir("readonly", s => s.get(clave)); if(r) memoria.set(clave, r); return r || null; }catch{ return null; } }
export async function borrar(clave){ memoria.delete(clave); try{ await pedir("readwrite", s => s.delete(clave)); }catch{} }
export async function vaciar(){ memoria = new Map(); try{ await pedir("readwrite", s => s.clear()); }catch{} }
