/* ═══════════════════════════════════════════════════════════════
   RESTAURAR · MOTOR SOBRE PIXELES RGBA DE 8 BITS (puro, sin DOM)
   Para los diálogos clásicos que trabajan con Uint8ClampedArray (p. ej. «Reducción de ruido»): pasa a luz lineal, aplica el motor y devuelve
   una copia RGBA con el mismo alfa y tramado. Entradas: RGBA, ancho, alto y valores. Salida: Uint8ClampedArray nuevo.
   ═══════════════════════════════════════════════════════════════ */
import { toPlanes, fromPlanes } from "../../portrait/shared/planes.js";
import { limpiarRuido } from "../engine/limpiar.js";

export function limpiarParaRealify(rgba, w, h, fuerza){
  const out = new Uint8ClampedArray(rgba), p = toPlanes(out, w, h);
  limpiarRuido(p, { fuerza });
  fromPlanes(p, out);
  return out;
}
