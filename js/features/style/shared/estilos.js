/* ═══════════════════════════════════════════════════════════════
   ESTILO · MIS ESTILOS (almacén y archivo)
   Un estilo guardado es { id, nombre, tipo: "color", stats } (las estadísticas de una foto de referencia, unos pocos cientos de bytes). Se guardan
   en localStorage de este navegador y se pasan a otra persona como archivo `.realify-estilo.json`. Entradas: estilos, archivos JSON.
   Salidas: lista(), guardar(), borrar(), aArchivo(id), deArchivo(texto). Sin DOM salvo localStorage.
   ═══════════════════════════════════════════════════════════════ */
const CLAVE = "realify.misEstilos.v1";

const leer = () => { try{ const v = JSON.parse(localStorage.getItem(CLAVE) || "[]"); return Array.isArray(v) ? v : []; } catch{ return []; } };
const escribir = l => { try{ localStorage.setItem(CLAVE, JSON.stringify(l)); return true; } catch{ return false; } };

export const lista = () => leer();
export const buscar = id => leer().find(e => e.id === id) || null;

export function validos(s){
  return !!s && s.version === 1 && s.global && Array.isArray(s.global.media) && s.zonas && typeof s.zonas === "object"
    && Object.values(s.zonas).every(z => Array.isArray(z.q) && z.q.length === 33 && Array.isArray(z.media) && Array.isArray(z.desv))
    && Array.isArray(s.global.q) && s.global.q.length === 33;
}

export function guardar(nombre, stats){
  if(!validos(stats)) throw new Error("Estadísticas no válidas");
  const l = leer(), nom = (nombre || "Mi estilo").trim().slice(0, 60) || "Mi estilo", e = { id: "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nombre: nom, tipo: "color", stats };
  l.push(e); if(!escribir(l)) throw new Error("No se pudo guardar en este navegador"); return e;
}

export function borrar(id){ escribir(leer().filter(e => e.id !== id)); }

export function aArchivo(id){
  const e = buscar(id); if(!e) return null;
  return { nombre: e.nombre.replace(/[^\w.-]+/g, "_") + ".realify-estilo.json", texto: JSON.stringify({ realifyEstilo: 1, nombre: e.nombre, tipo: e.tipo, stats: e.stats }, null, 1) };
}

export function deArchivo(texto){
  let j; try{ j = JSON.parse(texto); } catch{ throw new Error("El archivo no es un estilo de Realify"); }
  if(!j || j.realifyEstilo !== 1 || !validos(j.stats)) throw new Error("El archivo no es un estilo de Realify");
  return guardar(j.nombre || "Estilo importado", j.stats);
}
