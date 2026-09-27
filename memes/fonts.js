/* ═══════════════════════════════════════════════════════════════
   MEMES · TIPOGRAFÍAS
   Fuentes libres de Google Fonts (licencia OFL), cargadas sólo al
   abrir el creador de memes, y sólo con permiso de quien usa la app
   (el mismo que pide la herramienta de texto: ver js/editor/gfonts.js),
   porque Google recibe la IP de quien descarga la fuente. La CSP ya
   permite fonts.googleapis.com y fonts.gstatic.com. Sin permiso o sin
   conexión, el lienzo usa la alternativa del sistema de cada una.
   ═══════════════════════════════════════════════════════════════ */

import { ensureConsent } from "../js/editor/gfonts.js";

/* [nombre en Google Fonts, pesos, alternativa, etiqueta] */
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

let linked = null;
/** Enlaza la hoja de Google Fonts una sola vez. Devuelve una promesa
    que se cumple cuando la hoja ha llegado (o ha fallado): hasta
    entonces el navegador no conoce las @font-face y pedir una fuente
    se resolvería al instante sin cargar nada. */
export function linkFonts(){
  if(linked) return linked;
  // Sin permiso no se enlaza nada; se olvida el intento para que, si
  // luego se concede, la siguiente vez sí se cargue.
  linked = ensureConsent().then(ok => { if(!ok){ linked = null; return; } return appendSheet(); });
  return linked;
}
function appendSheet(){
  const families = FONTS.filter(f => f[1]).map(f =>
    `family=${f[0].replace(/ /g, "+")}${f[1].includes(";") ? `:wght@${f[1]}` : ""}`).join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  const ready = new Promise(resolve => { link.onload = link.onerror = () => resolve(); });
  document.head.appendChild(link);
  return ready;
}

/** Promesa que se resuelve cuando la fuente está lista (o falla). */
const ready = new Map();
export function loadFont(name, weight = 400, italic = false){
  const key = `${name}|${weight}|${italic}`;
  if(!ready.has(key)){
    const spec = `${italic ? "italic " : ""}${weight} 40px "${name}"`;
    ready.set(key, linkFonts().then(() => document.fonts?.load(spec)).catch(() => {}));
  }
  return ready.get(key);
}
