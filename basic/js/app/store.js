/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · ESTADO
   Un único objeto de estado de la interfaz y la forma de avisar de que cambió. La sesión (app/session.js) y la interfaz
   (ui/) se hablan sólo a través de él.
   Entradas: poner(parche). Salidas: leer() → estado · suscribir(fn) → función para darse de baja.
   Límites: sólo guarda datos sencillos; los píxeles viven en app/session.js, no aquí.
   ═══════════════════════════════════════════════════════════════ */
const estado = {
  foto: null,            // { nombre, tipo, ancho, alto } mientras haya una foto abierta
  version: 0,            // sube cada vez que cambia la imagen actual (la vista la repinta)
  puedeDeshacer: false,
  puedeRehacer: false,
  sucio: false,          // hay cambios sin guardar
  pestana: "ajustar",
  barras: true,          // false = barras ocultas para ver la foto sola
};
const oyentes = new Set();

export const leer = () => estado;
export function poner(parche) {
  Object.assign(estado, parche);
  oyentes.forEach(fn => fn(estado));
}
export function suscribir(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
