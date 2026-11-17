/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · SESIÓN DE EDICIÓN
   Guarda la foto abierta y su historial (deshacer y rehacer). Cada paso es un lienzo completo e inmutable; el 0 es siempre
   el original. Las pestañas guardan su resultado con confirmar(lienzo).
   Entradas: iniciar(lienzo, datos) · confirmar(lienzo) · deshacer() · rehacer() · volverAlOriginal() · cerrar().
   Salidas: actual() · original() y el estado de app/store.js (foto, version, puedeDeshacer, puedeRehacer, sucio).
   Límites: máximo 12 pasos (se descarta el más antiguo después del original).
   ═══════════════════════════════════════════════════════════════ */
import { poner } from "./store.js";

const MAX_PASOS = 12;
let pila = [], i = -1, datos = null, version = 0;

export const actual = () => pila[i] || null;
export const original = () => pila[0] || null;

function avisar() {
  const l = actual();
  poner({
    foto: l ? { ...datos, ancho: l.width, alto: l.height } : null,
    version: ++version,
    puedeDeshacer: i > 0, puedeRehacer: i >= 0 && i < pila.length - 1, sucio: i > 0,
  });
}

export function iniciar(lienzo, info) { pila = [lienzo]; i = 0; datos = info; avisar(); poner({ barras: true }); }

export function confirmar(lienzo) {
  pila = pila.slice(0, i + 1); pila.push(lienzo);
  if (pila.length > MAX_PASOS) pila.splice(1, 1);
  i = pila.length - 1; avisar();
}

export function deshacer() { if (i > 0) { i--; avisar(); } }
export function rehacer() { if (i < pila.length - 1) { i++; avisar(); } }
export function volverAlOriginal() { if (i > 0) { confirmar(original()); } }
export function cerrar() { pila = []; i = -1; datos = null; avisar(); }
