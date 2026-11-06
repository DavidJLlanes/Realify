/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · MODELO DEL PROYECTO (puro, sin DOM)
   Un proyecto es JSON plano con versión (docs/VIDEO.md, sección 4): salida, medios (sólo huella y metadatos, nunca el archivo), pistas y clips.
   Tiempos en segundos. Un clip muestra del medio el tramo [dentro, fuera] a `velocidad`, colocado en la pista desde `inicio`.
   Entradas: datos de los medios y las pistas. Salidas: objetos del proyecto. Sin estado global: los ids los da un generador que se puede fijar (pruebas).
   ═══════════════════════════════════════════════════════════════ */
import { SCHEMA_VERSION } from "../manifest.js";

export const FPS_VALIDOS = [24, 25, 30, 50, 60];
let contador = 0;
export const nuevoId = (pre = "x") => `${pre}_${Date.now().toString(36)}${(contador++).toString(36)}`;
export const reiniciarIds = () => { contador = 0; };

export function crearProyecto({ nombre = "Mi vídeo", ancho = 1080, alto = 1920, fps = 30, ahora = Date.now() } = {}){
  return { schemaVersion: SCHEMA_VERSION, id: nuevoId("p"), nombre, creado: ahora, modificado: ahora, salida: { ancho, alto, fps }, medios: {}, pistas: [] };
}

/** Huella de un archivo: lo bastante para reconocerlo al reabrir, sin guardar el archivo. */
export const huella = f => `${f.name}|${f.size}|${f.lastModified || 0}`;

export function crearMedio({ nombre, tipo = "video", duracion = 0, ancho = 0, alto = 0, fps = 0, huella: h = "", audio = false }){
  return { nombre, tipo, duracion, ancho, alto, fps, huella: h, ...(audio ? { audio: true } : {}) };   // `audio`: el archivo trae sonido (opcional: los proyectos viejos no lo tienen)
}

export function crearPista(tipo = "video", { id = nuevoId("t"), volumen = 1 } = {}){
  return tipo === "audio" ? { id, tipo, clips: [], volumen } : { id, tipo, clips: [] };
}

export function crearClip({ medio, inicio = 0, dentro = 0, fuera, velocidad = 1, id = nuevoId("c") }){
  return { id, medio, inicio, dentro, fuera, velocidad, efectos: [] };
}

/** Duración del clip en la línea de tiempo: el tramo del medio dividido por la velocidad. */
/** Volumen del clip (1 = tal cual; los clips antiguos no lo tienen). */
export const volumenClip = c => c.volumen ?? 1;
export const duracionClip = c => (c.fuera - c.dentro) / c.velocidad;
export const finClip = c => c.inicio + duracionClip(c);
export const duracionPista = t => t.clips.reduce((m, c) => Math.max(m, finClip(c)), 0);
export const duracionProyecto = p => p.pistas.reduce((m, t) => Math.max(m, duracionPista(t)), 0);
export const aFotograma = (t, fps) => Math.round(t * fps);
export const deFotograma = (n, fps) => n / fps;

export function buscarClip(p, idClip){
  for(const t of p.pistas){ const i = t.clips.findIndex(c => c.id === idClip); if(i >= 0) return { pista: t, indice: i, clip: t.clips[i] }; }
  return null;
}
/** Clip de una pista que está sonando/viéndose en el instante t (o null). */
export const clipEn = (pista, t) => pista.clips.find(c => t >= c.inicio && t < finClip(c)) || null;
/** Instante del medio que corresponde al instante t de la línea de tiempo dentro de un clip. */
export const tiempoEnMedio = (c, t) => c.dentro + (t - c.inicio) * c.velocidad;

/** Comprobación de coherencia: lista de problemas (vacía = bien). */
export function problemas(p){
  const out = [];
  if(!p || typeof p !== "object") return ["no es un proyecto"];
  if(!Number.isInteger(p.schemaVersion)) out.push("falta schemaVersion");
  if(!p.salida || !(p.salida.ancho > 0) || !(p.salida.alto > 0) || !(p.salida.fps > 0)) out.push("salida inválida");
  const ids = new Set();
  for(const t of p.pistas || []){
    const orden = [...t.clips].sort((a, b) => a.inicio - b.inicio);
    t.clips.forEach(c => {
      if(ids.has(c.id)) out.push(`id repetido ${c.id}`); ids.add(c.id);
      if(!p.medios[c.medio]) out.push(`${c.id}: medio desconocido`);
      if(!(c.fuera > c.dentro) || c.dentro < 0) out.push(`${c.id}: tramo inválido`);
      if(!(c.velocidad > 0)) out.push(`${c.id}: velocidad inválida`);
      const m = p.medios[c.medio]; if(m && m.duracion && c.fuera > m.duracion + 1e-6) out.push(`${c.id}: se pasa del final del medio`);
    });
    for(let i = 1; i < orden.length; i++) if(orden[i].inicio < finClip(orden[i - 1]) - 1e-9) out.push(`solape en ${t.id}: ${orden[i - 1].id} y ${orden[i].id}`);
  }
  return out;
}
