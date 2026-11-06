/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · PROTOCOLO DE LOS WORKERS (puro, sin DOM)
   Mensajes tipados y con versión entre el hilo principal y el worker de medios. Petición: { v, id, tipo, ...datos }. Respuesta: { v, id, tipo:"ok"|"error"|"progreso"|"fotograma", ... }.
   Tipos de petición: abrir (File → info), fotograma (t → ImageBitmap), codificar-inicio (config), codificar-fotograma (ImageBitmap, t), codificar-fin (→ Blob), cancelar, cerrar.
   Entradas/salidas: funciones que crean y comprueban mensajes. El worker y el cliente usan las MISMAS, así que no pueden desacordarse.
   ═══════════════════════════════════════════════════════════════ */
export const VERSION = 1;
export const PETICIONES = ["abrir", "fotograma", "codificar-inicio", "codificar-fotograma", "codificar-fin", "cancelar", "cerrar"];
export const RESPUESTAS = ["ok", "error", "progreso", "fotograma"];

export const peticion = (id, tipo, datos = {}) => ({ ...datos, v: VERSION, id, tipo });
export const respuesta = (id, tipo, datos = {}) => ({ ...datos, v: VERSION, id, tipo });
export function validarPeticion(m){
  if(!m || typeof m !== "object") return "mensaje vacío";
  if(m.v !== VERSION) return `versión de protocolo ${m.v} (se esperaba ${VERSION})`;
  if(!PETICIONES.includes(m.tipo)) return `petición desconocida: ${m.tipo}`;
  if(typeof m.id !== "number") return "falta el id";
  return null;
}
