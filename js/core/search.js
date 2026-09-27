/* ═══════════════════════════════════════════════════════════════
   BÚSQUEDA TOLERANTE
   La usan el cajón de Herramientas (móvil) y el catálogo de stickers.
   Un texto coincide con la consulta si CADA palabra de la consulta:
     · aparece en cualquier punto del texto («luz» encuentra «Fugas de
       luz», no sólo lo que empieza por «luz»), o
     · se parece a alguna palabra del texto con pocas erratas
       («saturasion», «desenfoqe», «viñetado»): distancia de edición
       con transposiciones, contra la palabra entera o contra su
       principio del mismo largo (para lo que aún se está escribiendo).
   Todo sin acentos ni mayúsculas: «vinetas» = «Viñetas».
   ═══════════════════════════════════════════════════════════════ */

export const fold = s => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* Erratas admitidas según el largo de la palabra buscada. */
const allowed = n => n <= 3 ? 0 : n <= 5 ? 1 : 2;

/* Distancia de Damerau-Levenshtein (versión «óptima»), con corte
   temprano: devuelve `max + 1` en cuanto sabe que se pasa. */
function distance(a, b, max){
  if(Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  let prev2 = null, prev = Array.from({ length: n + 1 }, (_, j) => j), cur;
  for(let i = 1; i <= m; i++){
    cur = [i];
    let rowMin = i;
    for(let j = 1; j <= n; j++){
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if(prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if(v < rowMin) rowMin = v;
    }
    if(rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[n];
}

/** Prepara un texto para buscar en él muchas veces. */
export function searchable(text){
  const t = fold(text);
  return { text: t, words: t.split(" ").filter(Boolean) };
}

/**
 * 0 = no coincide; 2 = todas las palabras aparecen tal cual; 1 =
 * alguna sólo con erratas. `target` puede ser un texto o el resultado
 * de `searchable()`.
 */
export function matchScore(query, target){
  const q = fold(query);
  if(!q) return 2;
  const t = typeof target === "string" ? searchable(target) : target;
  let score = 2;
  for(const token of q.split(" ")){
    if(t.text.includes(token)) continue;
    const max = allowed(token.length);
    if(!max) return 0;
    const near = t.words.some(w =>
      distance(token, w, max) <= max ||
      (w.length > token.length && distance(token, w.slice(0, token.length), max) <= max));
    if(!near) return 0;
    score = 1;
  }
  return score;
}
