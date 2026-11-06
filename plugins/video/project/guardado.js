/* ═══════════════════════════════════════════════════════════════
   PROYECTO DE VÍDEO · GUARDADO ENTRE SESIONES
   Guarda en IndexedDB el proyecto (JSON con versión) y una copia de cada vídeo importado, para que al volver a abrir el editor siga todo donde lo dejaste. Todo queda en el dispositivo.
   Entradas: guardar(proyecto, archivos:Map id→File), leer(), borrar(). Salidas: promesas; leer() da { proyecto, archivos:Map } o null. Nunca lanza: si IndexedDB no está disponible o está llena, devuelve false/null.
   Límite: los vídeos ocupan espacio del navegador (las copias sólo se guardan una vez); borrar() libera todo.
   ═══════════════════════════════════════════════════════════════ */
const BD = "realify-video", ALMACEN = "kv";

const abrir = () => new Promise((ok, mal) => {
  const r = indexedDB.open(BD, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN);
  r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
});
const tx = (db, modo, f) => new Promise((ok, mal) => { const t = db.transaction(ALMACEN, modo), s = t.objectStore(ALMACEN); let res; Promise.resolve(f(s)).then(v => { res = v; }); t.oncomplete = () => ok(res); t.onerror = t.onabort = () => mal(t.error); });
const req = r => new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });

export async function guardar(proyecto, archivos){
  try{
    const db = await abrir();
    const claves = await req(db.transaction(ALMACEN).objectStore(ALMACEN).getAllKeys());
    await tx(db, "readwrite", async s => {
      const ids = [...archivos.keys()];
      s.put({ json: JSON.stringify(proyecto), ids, t: Date.now() }, "proyecto");
      for(const id of ids) if(!claves.includes("medio:" + id)) s.put(archivos.get(id), "medio:" + id);
      for(const k of claves) if(String(k).startsWith("medio:") && !ids.includes(String(k).slice(6))) s.delete(k);
    });
    db.close(); return true;
  }catch{ return false; }
}

export async function leer(){
  try{
    const db = await abrir(), s = db.transaction(ALMACEN).objectStore(ALMACEN), reg = await req(s.get("proyecto"));
    if(!reg) { db.close(); return null; }
    const archivos = new Map();
    for(const id of reg.ids){ const f = await req(db.transaction(ALMACEN).objectStore(ALMACEN).get("medio:" + id)); if(f) archivos.set(id, f); }
    db.close(); return { proyecto: JSON.parse(reg.json), archivos, t: reg.t };
  }catch{ return null; }
}

export async function borrar(){
  try{ const db = await abrir(); await tx(db, "readwrite", s => { s.clear(); }); db.close(); return true; }catch{ return false; }
}
