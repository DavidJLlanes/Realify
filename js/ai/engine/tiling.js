/* ═══════════════════════════════════════════════════════════════
   IA · WORKER · TESELAS
   Posiciones de las teselas solapadas y reflejo de bordes para procesar imágenes grandes por bloques.
   Entradas: longitud, tamaño de tesela y solape. Salidas: lista de inicios; índice reflejado.
   ═══════════════════════════════════════════════════════════════ */

/* Inicio de cada tesela a lo largo de un eje: paso fijo y la última
   pegada al borde, para que TODAS midan `tile` (una tesela estrecha
   rellenada por repetición deja franjas que el modelo no limpia). */
export function starts(len, tile, overlap){
  if(len <= tile) return [0];
  const out = [], step = tile - overlap;
  for(let x = 0; x + tile < len; x += step) out.push(x);
  out.push(len - tile);
  return out;
}

/* Relleno en espejo para imágenes menores que el mínimo del modelo. */
export function mirror(i, len){
  if(len === 1) return 0;
  const period = 2 * (len - 1), k = i % period;
  return k < len ? k : period - k;
}
