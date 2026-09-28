/* ═══════════════════════════════════════════════════════════════
   MEMES · TIPOGRAFÍAS
   Tipografías libres (del catálogo de Google Fonts, licencia OFL)
   alojadas en /fonts/ del propio sitio: ver js/editor/gfonts.js. Se
   descargan sólo al usarlas, sin contactar con Google ni con nadie
   más. Mientras llegan, el lienzo usa la alternativa de cada una.
   También las usa el collage (socialmediapost/).
   ═══════════════════════════════════════════════════════════════ */

import { loadFamily } from "../js/editor/gfonts.js";

/* [familia (en /fonts/), pesos, alternativa, etiqueta] */
export const FONTS = [
  ["Anton", "400", "Impact, 'Arial Narrow Bold', sans-serif", "Anton (clásica de meme)"],
  ["Impact", null, "Haettenschweiler, 'Arial Narrow Bold', sans-serif", "Impact (del sistema)"],
  ["Bebas Neue", "400", "Impact, sans-serif", "Bebas Neue"],
  ["Oswald", "400;700", "'Arial Narrow', sans-serif", "Oswald"],
  ["Roboto", "400;700;900", "Arial, sans-serif", "Roboto"],
  ["Montserrat", "400;700;900", "Arial, sans-serif", "Montserrat"],
  ["Inter", "400;700;900", "system-ui, sans-serif", "Inter"],
  ["Bangers", "400", "'Comic Sans MS', cursive", "Bangers (cómic)"],
  ["Luckiest Guy", "400", "'Comic Sans MS', cursive", "Luckiest Guy"],
  ["Comic Neue", "400;700", "'Comic Sans MS', cursive", "Comic Neue"],
  ["Fredoka", "400;700", "'Arial Rounded MT Bold', sans-serif", "Fredoka (redondeada)"],
  ["Permanent Marker", "400", "'Comic Sans MS', cursive", "Permanent Marker (rotulador)"],
  ["Caveat", "400;700", "cursive", "Caveat (a mano)"],
  ["Pacifico", "400", "cursive", "Pacifico"],
  ["Lobster", "400", "cursive", "Lobster"],
  ["Playfair Display", "400;700;900", "Georgia, serif", "Playfair Display (elegante)"],
  ["Abril Fatface", "400", "Georgia, serif", "Abril Fatface"],
  ["Merriweather", "400;700", "Georgia, serif", "Merriweather"],
  ["Special Elite", "400", "'Courier New', monospace", "Special Elite (máquina de escribir)"],
  ["Press Start 2P", "400", "monospace", "Press Start 2P (videojuego)"],
  ["Righteous", "400", "sans-serif", "Righteous (retro)"],
  ["Monoton", "400", "sans-serif", "Monoton (neón)"],
  ["Black Ops One", "400", "Impact, sans-serif", "Black Ops One (militar)"],
  ["Creepster", "400", "fantasy", "Creepster (terror)"],
  ["Shrikhand", "400", "Georgia, serif", "Shrikhand"],
  ["Rubik Mono One", "400", "sans-serif", "Rubik Mono One"],
  ["Rye", "400", "Georgia, serif", "Rye (del oeste)"],
  ["UnifrakturMaguntia", "400", "'Old English Text MT', serif", "UnifrakturMaguntia (periódico)"],
  ["Old Standard TT", "400;700", "Georgia, serif", "Old Standard TT (prensa antigua)"]
];

export const fontStack = name => {
  const f = FONTS.find(x => x[0] === name);
  return f ? `"${f[0]}", ${f[2]}` : `"${name}", sans-serif`;
};

/* Las tipografías se sirven desde /fonts/ (ver js/editor/gfonts.js):
   nada que enlazar ni permiso que pedir. Se mantiene `linkFonts` por
   compatibilidad con quien la llama al abrir el editor. */
export function linkFonts(){ return Promise.resolve(); }

/** Promesa que se resuelve cuando la fuente está lista (o falla). */
const ready = new Map();
export function loadFont(name, weight = 400, italic = false){
  const key = `${name}|${weight}|${italic}`;
  if(!ready.has(key)) ready.set(key, loadFamily(name, weight, italic).catch(() => {}));
  return ready.get(key);
}
