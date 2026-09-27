/* ═══════════════════════════════════════════════════════════════
   STICKERS · CATÁLOGO
   1.595 emojis de Fluent Emoji (Microsoft, licencia MIT) guardados en
   stickers/emoji/ por tools/build_index.py, en cuatro estilos y, los
   que los tienen, en seis tonos de piel. El índice (index.json) trae
   nombre y palabras clave en español (anotaciones CLDR) e inglés.
   ═══════════════════════════════════════════════════════════════ */

import { matchScore, searchable } from "../js/core/search.js";

export const GROUP_LABELS = ["Caras y emociones", "Personas y cuerpo", "Animales y naturaleza", "Comida y bebida",
  "Viajes y lugares", "Actividades", "Objetos", "Símbolos", "Banderas", "Componentes"];

export const STYLES = [["3d", "3D"], ["color", "Color"], ["flat", "Plano"], ["hc", "Alto contraste"]];
export const TONES = [["", "Amarillo"], ["light", "Claro"], ["medium-light", "Medio claro"],
  ["medium", "Medio"], ["medium-dark", "Medio oscuro"], ["dark", "Oscuro"]];

let loading = null;

/** Carga el índice una sola vez. Cada emoji: { id, es, en, g, k, c, t }. */
export function loadCatalog(){
  if(!loading){
    loading = fetch(new URL("./emoji/index.json", import.meta.url))
      .then(r => { if(!r.ok) throw new Error("No se pudo cargar la biblioteca de stickers"); return r.json(); })
      .then(data => {
        const list = data.emoji.map(e => ({ ...e, name: searchable(e.es), search: searchable(`${e.es} ${e.en} ${e.k}`) }));
        return { list, byId: new Map(list.map(e => [e.id, e])) };
      });
    loading.catch(() => { loading = null; });
  }
  return loading;
}

/** Ruta del archivo de un emoji. El alto contraste no tiene tonos. */
export function emojiUrl(id, style = "3d", tone = "", hasTones = true){
  const t = style !== "hc" && hasTones && tone ? `-${tone}` : "";
  return new URL(`./emoji/${id}/${style}${t}.${style === "3d" ? "png" : "svg"}`, import.meta.url).href;
}

/** Lo que coincide con `query` (todo el catálogo) o, sin búsqueda, un grupo. */
export function filterCatalog(list, query, group){
  if(!query.trim()) return list.filter(e => e.g === group);
  // Primero lo que coincide por su NOMBRE en español, después por las
  // palabras clave y, al final, lo que sólo se parece (erratas).
  const scored = [];
  for(const e of list){
    const s = matchScore(query, e.search);
    if(s) scored.push([e, s === 2 && matchScore(query, e.name) === 2 ? 3 : s]);
  }
  return [3, 2, 1].flatMap(rank => scored.filter(x => x[1] === rank).map(x => x[0]));
}

/* Imágenes ya cargadas, por ruta. */
const images = new Map();
export function loadImage(url){
  if(!images.has(url)){
    images.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => { images.delete(url); reject(new Error("No se pudo cargar el sticker")); };
      img.src = url;
    }));
  }
  return images.get(url);
}
