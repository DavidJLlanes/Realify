/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · MIGRACIONES DEL PROYECTO (puro, sin DOM)
   Cada migración lleva un proyecto de la versión n a la n+1; se aplican en cadena hasta SCHEMA_VERSION. Un proyecto de una versión MÁS NUEVA que
   la conocida no se toca: se abre en sólo lectura con aviso. Toda migración nueva necesita su archivo de ejemplo en tests/video/fixtures/.
   Entradas: JSON (texto u objeto). Salida: { proyecto, soloLectura, avisos:[texto] }. Lanza Error si no es un proyecto.
   ═══════════════════════════════════════════════════════════════ */
import { SCHEMA_VERSION } from "../manifest.js";
import { problemas } from "./modelo.js";

/* v0 = formato de prototipo: { clips:[{ archivo, desde, hasta, en }], fps, nombre }. Una sola pista de vídeo. */
export const MIGRACIONES = {
  0: p => {
    const medios = {}, clips = [];
    (p.clips || []).forEach((c, i) => {
      const id = `m${Object.keys(medios).length + 1}`, ya = Object.entries(medios).find(([, m]) => m.nombre === c.archivo);
      const mid = ya ? ya[0] : id; if(!ya) medios[id] = { nombre: c.archivo, tipo: "video", duracion: c.hasta, ancho: 0, alto: 0, fps: p.fps || 30, huella: "" }; else ya[1].duracion = Math.max(ya[1].duracion, c.hasta);
      clips.push({ id: `c${i + 1}`, medio: mid, inicio: c.en || 0, dentro: c.desde || 0, fuera: c.hasta, velocidad: 1, efectos: [] });
    });
    return { schemaVersion: 1, id: p.id || "p_migrado", nombre: p.nombre || "Mi vídeo", creado: p.creado || 0, modificado: p.modificado || 0, salida: { ancho: p.ancho || 1080, alto: p.alto || 1920, fps: p.fps || 30 }, medios, pistas: [{ id: "v1", tipo: "video", clips }] };
  }
};

export function abrirProyecto(entrada){
  let p; try{ p = typeof entrada === "string" ? JSON.parse(entrada) : structuredClone(entrada); }catch{ throw new Error("El archivo no es un proyecto de vídeo válido"); }
  if(!p || typeof p !== "object") throw new Error("El archivo no es un proyecto de vídeo válido");
  const avisos = []; let v = Number.isInteger(p.schemaVersion) ? p.schemaVersion : (Array.isArray(p.clips) ? 0 : null);
  if(v === null) throw new Error("El archivo no es un proyecto de vídeo de Realify");
  if(v > SCHEMA_VERSION) return { proyecto: p, soloLectura: true, avisos: [`Este proyecto es de una versión más nueva (${v}) que la de Realify (${SCHEMA_VERSION}): se abre sólo para verlo.`] };
  while(v < SCHEMA_VERSION){ if(!MIGRACIONES[v]) throw new Error(`No sé migrar el proyecto desde la versión ${v}`); p = MIGRACIONES[v](p); v = p.schemaVersion; avisos.push(`Proyecto actualizado a la versión ${v}.`); }
  const malos = problemas(p); if(malos.length) avisos.push(...malos.map(m => "Aviso: " + m));
  return { proyecto: p, soloLectura: false, avisos };
}

export const aTexto = p => JSON.stringify(p);
