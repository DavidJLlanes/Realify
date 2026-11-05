/* ═══════════════════════════════════════════════════════════════
   PERSONAS · CACHÉ DEL ANÁLISIS
   Guarda el análisis de personas por «revisión» de la imagen visible para que varias herramientas (retoque, cuerpo, ropa,
   selección de partes) lo reutilicen sin repetir la pasada de los modelos. Cualquier cambio del documento sube la revisión
   y el análisis anterior deja de valer. El resultado se guarda por calidad: uno hecho en «mejor» sirve para «bueno».
   Entradas: la revisión (número) y la calidad. Salidas: createPeopleCache(), peopleCache (instancia del documento abierto) y
   bumpRevision() (lo llama el enlace con el bus; las pruebas lo llaman a mano). Sin DOM.
   ═══════════════════════════════════════════════════════════════ */

const RANK = { bueno: 1, mejor: 2 };

export function createPeopleCache(){
  let revision = 0;
  let entry = null;                       // { revision, quality, result }
  const pending = new Map();              // calidad → promesa en curso (dos herramientas a la vez comparten la misma pasada)

  return {
    get revision(){ return revision; },
    bump(){ revision++; entry = null; pending.clear(); return revision; },
    /** Resultado guardado válido para esa calidad (el de «mejor» sirve para «bueno»), o null. */
    get(quality = "bueno"){
      return entry && entry.revision === revision && RANK[entry.quality] >= RANK[quality] ? entry.result : null;
    },
    set(quality, result, forRevision = revision){
      if(forRevision !== revision) return false;          // el documento cambió mientras se analizaba: se descarta
      entry = { revision, quality, result };
      return true;
    },
    /** Devuelve el análisis guardado o lo calcula con `compute()` (una sola vez aunque lo pidan varios a la vez). */
    async getOrCompute(quality, compute){
      const hit = this.get(quality);
      if(hit) return hit;
      const rev = revision;
      let p = pending.get(quality);
      if(!p){
        p = (async () => { try { const r = await compute(); this.set(quality, r, rev); return r; } finally { if(rev === revision) pending.delete(quality); } })();
        pending.set(quality, p);
      }
      return p;
    }
  };
}

export const peopleCache = createPeopleCache();

/** Enlaza la caché con el bus del documento (cualquier cambio invalida). Se llama una vez desde analyze.js en el navegador. */
export async function linkToDocument(cache = peopleCache){
  const { on } = await import("../../core/bus.js");
  on("doc:change", () => cache.bump());
  on("doc:structure", () => cache.bump());
}
