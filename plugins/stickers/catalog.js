/* ═══════════════════════════════════════════════════════════════
   STICKERS · CATÁLOGO
   1.595 emojis de Fluent Emoji (Microsoft, licencia MIT) guardados en
   plugins/stickers/emoji/ por tools/build_index.py, en cuatro estilos y, los
   que los tienen, en seis tonos de piel. El índice (index.json) trae
   nombre y palabras clave en español (anotaciones CLDR) e inglés.
   ═══════════════════════════════════════════════════════════════ */

import { matchScore, searchable } from "../../js/core/search.js";

export const GROUP_LABELS = ["Caras y emociones", "Personas y cuerpo", "Animales y naturaleza", "Comida y bebida",
  "Viajes y lugares", "Actividades", "Objetos", "Símbolos", "Banderas", "Componentes"];

export const STYLES = [["3d", "3D"], ["color", "Color"], ["flat", "Plano"], ["hc", "Alto contraste"]];
export const TONES = [["", "Por defecto"], ["light", "Claro"], ["medium-light", "Medio claro"],
  ["medium", "Medio"], ["medium-dark", "Medio oscuro"], ["dark", "Oscuro"]];

/* Valor «de mentira» del desplegable de tono cuando no se puede usar (alto
   contraste, o un sticker/lista sin tonos de piel): se ve «Sin tonos» en vez
   de un tono que no hace nada. Nunca se guarda como tono. */
export const TONE_NA = "na";

/** ¿Este estilo y este emoji admiten tono de piel? El alto contraste no tiene. */
export const toneApplies = (style, hasTones) => !!hasTones && style !== "hc";

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

/* Lado (px) al que se rasteriza un sticker vectorial: el siguiente tamaño de
   la serie que cubre `need`, con un tope. Los PNG 3D tienen su propio tamaño
   (256 px) y no pasan por aquí. */
const RASTER_SIZES = [128, 256, 512, 1024, 2048, 4096];
export const rasterSize = need => RASTER_SIZES.find(n => n >= need) || RASTER_SIZES[RASTER_SIZES.length - 1];
export const isSvg = url => /\.svg(\?|$)/i.test(url);

/* Un SVG con width/height pequeños (aquí 32 px) se dibuja en el lienzo
   rasterizado a su tamaño propio y luego se estira —Safari lo hace siempre—,
   así que se veía borroso o a trozos según el navegador. Aquí se cambia su
   tamaño por el que hace falta y se rasteriza UNA vez a un lienzo, que es lo
   que se dibuja después en cualquier navegador. */
async function rasterSvg(url, px){
  const r = await fetch(url);
  if(!r.ok) throw new Error("No se pudo cargar el sticker");
  const text = await r.text();
  const sized = text.replace(/<svg\b[^>]*>/, tag =>
    tag.replace(/\s(?:width|height)="[^"]*"/g, "").replace("<svg", `<svg width="${px}" height="${px}"`));
  const blobUrl = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  try{
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo cargar el sticker"));
      i.src = blobUrl;
    });
    const c = document.createElement("canvas");
    c.width = c.height = px;
    c.getContext("2d").drawImage(img, 0, 0, px, px);
    return c;
  } finally { URL.revokeObjectURL(blobUrl); }
}

/* Imágenes ya cargadas, por ruta (y, si son vectoriales, por tamaño). Para un
   SVG, `px` es el lado al que se rasteriza (ver rasterSize); devuelve una
   imagen o un lienzo, que se dibujan igual con drawImage. */
const images = new Map();
export function loadImage(url, px = 0){
  const svg = isSvg(url), size = svg ? rasterSize(px || 512) : 0;
  const key = svg ? `${url}@${size}` : url;
  if(!images.has(key)){
    const p = svg ? rasterSvg(url, size) : new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo cargar el sticker"));
      img.src = url;
    });
    images.set(key, p);
    p.catch(() => images.delete(key));
  }
  return images.get(key);
}
