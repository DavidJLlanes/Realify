/* ═══════════════════════════════════════════════════════════════
   BUSCAR FOTOS · PUNTUACIÓN CON CLIP (motor puro, sin DOM)
   Mezcla la puntuación de palabras de consulta.js (tipo de foto, clases, colores, marcas) con la semejanza de CLIP entre la frase y cada
   foto (vector de 512 números guardado en el índice). Entradas: registros (con `clip` si se indexaron con CLIP), frase y vector de la frase.
   Salida: [{ i, puntos, cos }] ordenada. Límites: las fotos sin vector sólo cuentan por palabras; con CLIP sólo cuentan las de semejanza ≥ 0,21.
   ═══════════════════════════════════════════════════════════════ */
import { buscar } from "./consulta.js";
import { semejanza } from "../../../../ai/clip.js";

export const UMBRAL = 0.21, PESO = 60, BASE = 0.17;

export function buscarConClip(registros, texto, qvec, max = 200){
  const lex = new Map(buscar(registros, texto, registros.length).map(x => [x.i, x.puntos]));
  const filas = [];
  registros.forEach((r, i) => {
    const cos = r.clip && qvec ? semejanza(qvec, r.clip) : null, l = lex.get(i) || 0;
    if(l > 0 || (cos != null && cos >= UMBRAL)) filas.push({ i, puntos: +(l + (cos != null ? Math.max(0, cos - BASE) * PESO : 0)).toFixed(2), cos });
  });
  return filas.sort((a, b) => b.puntos - a.puntos).slice(0, max);
}
