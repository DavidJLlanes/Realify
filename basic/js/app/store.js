/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · ESTADO
   Un único objeto de estado de la interfaz y la forma de avisar de que cambió. La sesión (app/session.js), el pintado
   (app/render.js) y la interfaz (ui/, tabs/) se hablan sólo a través de él.
   Entradas: poner(parche). Salidas: leer() → estado · suscribir(fn) → función para darse de baja.
   Límites: sólo guarda datos sencillos; los píxeles viven en app/session.js y app/render.js, no aquí.
   ═══════════════════════════════════════════════════════════════ */
const estado = {
  foto: null,            // { nombre, tipo, ancho, alto } mientras haya una foto abierta
  version: 0,            // sube con cada cambio de la receta o de la foto
  vistaV: 0,             // sube cada vez que se repinta la vista previa
  dims: null,            // { w, h }: tamaño lógico de lo que se ve, en píxeles de la foto original (el marco entero al recortar)
  puedeDeshacer: false,
  puedeRehacer: false,
  sucio: false,          // la receta no es neutra (hay cambios sin guardar)
  pestana: "ajustar",
  barras: true,          // false = barras ocultas para ver la foto sola
  procesando: false,     // hay un cálculo largo en marcha (guardar a resolución completa)
};
const oyentes = new Set();

export const leer = () => estado;
export function poner(parche) {
  Object.assign(estado, parche);
  oyentes.forEach(fn => fn(estado));
}
export function suscribir(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
