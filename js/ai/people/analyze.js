/* ═══════════════════════════════════════════════════════════════
   PERSONAS · ANÁLISIS (API única)
   Dice quién hay en la foto y dónde está cada parte: por persona { caja, cara, manos, pose, partes, proporciones }.
   Procesado Premium: «bueno» = una pasada; «mejor» = además teselas para personas pequeñas y borde refinado (lo hace cada
   proveedor con la `calidad` que recibe). Los modelos se enchufan con `registerProvider` (landmarks, manos, poses, partes):
   mientras no estén, el análisis devuelve las caras (YuNet, ya incluido) y la caja estimada de cada persona.
   Cancelación: si `signal` se aborta, se detiene entre proveedores y lanza un AbortError. Varias herramientas a la vez
   comparten una sola pasada y el resultado se guarda hasta que el documento cambia (cache.js).
   Entradas: lienzo `source`, { quality, signal, kinds }. Salida: { revision, calidad, w, h, personas }.
   ═══════════════════════════════════════════════════════════════ */
import { buildPersons } from "./assemble.js";
import { peopleCache, linkToDocument } from "./cache.js";

const providers = new Map();            // tipo → { run(ctx) → lista }
export const KINDS = ["landmarks", "manos", "poses", "partes"];

/** Enchufa un modelo: `run({ source, caras, quality, signal })` devuelve la lista de su tipo (ver assemble.js). */
export function registerProvider(kind, run){
  if(!KINDS.includes(kind)) throw new Error("Tipo de proveedor desconocido: " + kind);
  providers.set(kind, run);
}
export const hasProvider = kind => providers.has(kind);

const abortIf = signal => { if(signal && signal.aborted) throw new DOMException("Análisis cancelado", "AbortError"); };

let linked = false;
export async function analyze(source, { quality = "bueno", signal, kinds = KINDS, cache = peopleCache, faces } = {}){
  if(!linked && cache === peopleCache && typeof document !== "undefined"){ linked = true; await linkToDocument(); }
  abortIf(signal);
  const compute = async () => {
    const caras = faces || await (await import("../faces.js")).detectFaces(source);
    abortIf(signal);
    const res = {};
    for(const k of KINDS){
      if(!kinds.includes(k) || !providers.has(k)) continue;
      abortIf(signal);
      res[k] = await providers.get(k)({ source, caras, quality, signal, partial: res });
    }
    return { revision: cache.revision, calidad: quality, w: source.width, h: source.height,
             personas: buildPersons(caras, res, source.width, source.height) };
  };
  // Con una selección parcial de tipos no se guarda en la caché (el resultado no está completo)
  if(kinds.length !== KINDS.length) return compute();
  return cache.getOrCompute(quality, compute);
}
