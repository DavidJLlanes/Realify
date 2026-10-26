/* ═══════════════════════════════════════════════════════════════
   LIBRERÍAS DE TERCEROS BAJO DEMANDA
   heic2any (HEIC), UTIF (TIFF/DNG) y ag-psd (PSD/PSB) suman 2,3 MB de JavaScript y sólo hacen falta cuando se abre
   o exporta uno de esos formatos. Antes eran <script> de index.html: bloqueaban la página y retrasaban el arranque de
   TODOS los usuarios. Ahora cada punto de entrada que las usa hace «await ensureVendor(…)» (o vendorReady) antes de
   tocar el global, y el navegador las descarga la primera vez que se necesitan.

   Siguen siendo scripts clásicos que definen un global (heic2any, UTIF, agPsd), así que el código que las usa no cambia:
   sólo se asegura de que ya están cargadas.
   ═══════════════════════════════════════════════════════════════ */

const BASE = new URL("../vendor/", import.meta.url);
const LIBS = {
  heic2any: { file: "heic2any.min.js", global: "heic2any" },
  utif:     { file: "utif.js",         global: "UTIF" },
  agpsd:    { file: "ag-psd.js",       global: "agPsd" }
};
const pending = new Map();

/** Carga la librería (una sola vez) y devuelve su global. Rechaza si no se puede cargar. */
export function ensureVendor(id){
  const lib = LIBS[id];
  if(!lib) return Promise.reject(new Error("Librería desconocida: " + id));
  if(globalThis[lib.global]) return Promise.resolve(globalThis[lib.global]);
  if(pending.has(id)) return pending.get(id);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL(lib.file, BASE).href;
    s.async = true;
    s.onload = () => globalThis[lib.global] ? resolve(globalThis[lib.global]) : (pending.delete(id), reject(new Error(lib.file + " cargó pero no define " + lib.global)));
    s.onerror = () => { pending.delete(id); s.remove(); reject(new Error("No se pudo cargar " + lib.file)); };
    document.head.appendChild(s);
  });
  pending.set(id, p);
  return p;
}

/** Como ensureVendor, pero nunca rechaza: devuelve si la librería quedó disponible. Para los sitios que ya comprobaban
    «¿existe el global?» y reaccionan a que no esté (cada uno conserva su comprobación y su mensaje). */
export const vendorReady = id => ensureVendor(id).then(() => true, () => false);
