/* ═══════════════════════════════════════════════════════════════
   TIPOGRAFÍAS LIBRES (alojadas en /fonts/)
   Todo el catálogo de Google Fonts —unas 1900 familias con licencias
   libres (SIL OFL, Apache, UFL), que permiten redistribuirlas— servido
   desde el propio sitio: /fonts/<id>/<id>-<peso>.woff2, con el índice
   en /fonts/catalog.json. No se conecta con Google ni con ningún otro
   tercero, así que no hace falta pedir permiso a nadie, y funcionan sin
   conexión (el service worker las guarda en cuanto se usan).

   Cada familia se registra con la API FontFace sólo cuando se usa, y el
   navegador descarga únicamente el peso que se dibuja. De cada familia
   hay alfabeto latino (español incluido) en normal (400) y, si existe,
   negrita (700); la cursiva y los pesos intermedios los sintetiza el
   navegador. Las pocas familias sin letras latinas (coreano, jemer…)
   vienen troceadas por rangos de caracteres.

   Lo usan la herramienta Texto (listas de fuentes y buscador), el
   creador de memes y el collage (ver memes/fonts.js).
   ═══════════════════════════════════════════════════════════════ */

const CUSTOM_KEY = "realify.googleFonts.custom";   // familias elegidas en el buscador

/* [familia, categoría CSS de reserva] — las más usadas, que salen
   directamente en las listas de fuentes. El resto, en el buscador. */
const BASE = [
  ["Roboto", "sans-serif"], ["Open Sans", "sans-serif"], ["Lato", "sans-serif"], ["Montserrat", "sans-serif"],
  ["Poppins", "sans-serif"], ["Inter", "sans-serif"], ["Nunito", "sans-serif"], ["Raleway", "sans-serif"],
  ["Work Sans", "sans-serif"], ["Rubik", "sans-serif"], ["Ubuntu", "sans-serif"], ["Quicksand", "sans-serif"],
  ["Fira Sans", "sans-serif"], ["Barlow", "sans-serif"], ["Mulish", "sans-serif"], ["Josefin Sans", "sans-serif"],
  ["Oswald", "sans-serif"], ["Bebas Neue", "sans-serif"], ["Anton", "sans-serif"], ["Archivo Black", "sans-serif"],
  ["Roboto Condensed", "sans-serif"], ["Fredoka", "sans-serif"], ["Righteous", "sans-serif"], ["Russo One", "sans-serif"],
  ["Playfair Display", "serif"], ["Merriweather", "serif"], ["Lora", "serif"], ["PT Serif", "serif"],
  ["Libre Baskerville", "serif"], ["EB Garamond", "serif"], ["Cormorant Garamond", "serif"], ["Crimson Text", "serif"],
  ["Roboto Slab", "serif"], ["Arvo", "serif"], ["Abril Fatface", "serif"], ["DM Serif Display", "serif"],
  ["Cinzel", "serif"], ["Old Standard TT", "serif"], ["Bitter", "serif"], ["Zilla Slab", "serif"],
  ["Roboto Mono", "monospace"], ["Source Code Pro", "monospace"], ["JetBrains Mono", "monospace"], ["Space Mono", "monospace"],
  ["Special Elite", "monospace"], ["Press Start 2P", "monospace"], ["VT323", "monospace"],
  ["Dancing Script", "cursive"], ["Pacifico", "cursive"], ["Caveat", "cursive"], ["Great Vibes", "cursive"],
  ["Satisfy", "cursive"], ["Sacramento", "cursive"], ["Kaushan Script", "cursive"], ["Shadows Into Light", "cursive"],
  ["Indie Flower", "cursive"], ["Amatic SC", "cursive"], ["Permanent Marker", "cursive"], ["Rock Salt", "cursive"],
  ["Lobster", "cursive"], ["Comfortaa", "cursive"], ["Bangers", "fantasy"], ["Luckiest Guy", "fantasy"],
  ["Lilita One", "fantasy"], ["Alfa Slab One", "fantasy"], ["Black Ops One", "fantasy"], ["Bungee", "fantasy"],
  ["Monoton", "fantasy"], ["Creepster", "fantasy"], ["Rye", "fantasy"], ["UnifrakturMaguntia", "fantasy"],
  ["Shrikhand", "fantasy"], ["Titan One", "fantasy"], ["Bowlby One SC", "fantasy"]
];

let custom = [];
try{ custom = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]").filter(f => typeof f === "string"); }catch{}

const GENERIC = { "sans-serif": "sans-serif", serif: "serif", monospace: "monospace", handwriting: "cursive", display: "fantasy" };
const CATEGORY_LABEL = { "sans-serif": "Sans", serif: "Serif", monospace: "Monoespaciada", handwriting: "Manuscrita", display: "Display" };

export const stackOf = (family, generic = "sans-serif") => `'${family}', ${generic}`;
const familyOf = stack => { const m = /^\s*'([^']+)'/.exec(String(stack || "")); return m ? m[1] : null; };

/* ── catálogo ───────────────────────────────────────────────── */
const FONTS_URL = new URL("../../fonts/", import.meta.url);
let catalogP = null, byName = null;
/** Índice de todas las familias: [{ f, id, c, w:[pesos], sc?, s? }]. */
export function catalog(){
  if(!catalogP){
    catalogP = fetch(new URL("catalog.json", FONTS_URL))
      .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(list => { byName = new Map(list.map(e => [e.f, e])); return list; })
      .catch(() => { catalogP = null; return []; });
  }
  return catalogP;
}
catalog();   // se pide ya: es pequeño y así las listas saben qué hay

const genericOf = family => {
  const b = BASE.find(x => x[0] === family); if(b) return b[1];
  return GENERIC[byName?.get(family)?.c] || "sans-serif";
};

/** Entradas [stack, etiqueta] para las listas de fuentes. */
export function googleFontItems(){
  const seen = new Set();
  return [...BASE.map(b => b[0]), ...custom].filter(f => !seen.has(f) && seen.add(f))
    .map(f => [stackOf(f, genericOf(f)), f]);
}
const known = () => new Set([...BASE.map(b => b[0]), ...custom, ...(byName ? byName.keys() : [])]);
export const isGoogleStack = stack => { const f = familyOf(stack); return !!f && known().has(f); };

/* ── carga ──────────────────────────────────────────────────── */
const FORMAT = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" };
const families = new Map();   // familia → Promise<boolean>
/* Registra las caras de la familia (sin descargarlas todavía). */
function registerFamily(family){
  if(!families.has(family)){
    families.set(family, (async () => {
      await catalog();
      const e = byName?.get(family);
      if(!e) return false;
      const dir = new URL(`${e.id}/`, FONTS_URL);
      /* `s`: lista explícita de archivos [archivo, peso, rango|null] —las
         familias sin letras latinas, troceadas por rangos de caracteres,
         y las pocas que Google sirve en .ttf—; si no, un .woff2 por peso. */
      const faces = e.s || e.w.map(w => [`${e.id}-${w}.woff2`, w, null]);
      for(const [file, w, u] of faces){
        const desc = { weight: String(w), style: "normal", display: "swap" };
        if(u) desc.unicodeRange = u;
        const fmt = FORMAT[file.split(".").pop()] || "woff2";
        document.fonts.add(new FontFace(family, `url("${new URL(file, dir)}") format("${fmt}")`, desc));
      }
      return true;
    })().then(ok => { if(!ok) families.delete(family); return ok; }));
  }
  return families.get(family);
}

/** Deja lista `family` en `weight`/cursiva. Promesa que se cumple cuando está (o falla). */
export async function loadFamily(family, weight = 400, italic = false, text = undefined){
  if(!await registerFamily(family)) return false;
  try{ await document.fonts.load(`${italic ? "italic " : ""}${weight} 40px '${family}'`, text); return true; }catch{ return false; }
}

/**
 * Deja lista la fuente de `stack` si es una de las alojadas.
 * Devuelve true si hay que volver a dibujar (acaba de cargarse).
 */
export async function ensureFont(stack, { weight = 400, italic = false } = {}){
  const family = familyOf(stack);
  if(!family) return false;
  const spec = `${italic ? "italic " : ""}${weight} 40px '${family}'`;
  /* Ojo: `document.fonts.check()` responde «sí» para una familia que el
     navegador aún no conoce (no hay nada pendiente de cargar), así que
     no sirve para saber si ya se descargó. Se lleva la cuenta aquí. */
  if(loadedSpecs.has(spec)) return false;
  if(!await loadFamily(family, weight, italic)) return false;
  loadedSpecs.add(spec);
  return true;
}
const loadedSpecs = new Set();

/* Valor de la entrada «Más fuentes…» de las listas. */
export const GOOGLE_OTHER = "__google_other__";
export const MORE_FONTS_LABEL = "Más fuentes (buscar entre 1900)…";

/**
 * Lo que hay que hacer cuando alguien elige `value` en una lista de
 * fuentes. Devuelve la fuente a aplicar, o null para dejar la de antes
 * (separador o buscador cancelado).
 */
export async function chooseFontValue(value){
  if(!value || value.startsWith("__sep")) return null;
  if(value === GOOGLE_OTHER){
    const family = await pickFont();
    if(!family) return null;
    return addCustomGoogleFont(family);
  }
  if(isGoogleStack(value)) ensureFont(value);
  return value;
}

/** Añade una familia del catálogo a las listas (y la deja cargando). */
export async function addCustomGoogleFont(name){
  const family = String(name || "").trim();
  await catalog();
  if(!byName?.has(family)) throw new Error(`No hay ninguna fuente llamada «${family}».`);
  if(!BASE.some(b => b[0] === family) && !custom.includes(family)){
    custom.push(family);
    try{ localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom.slice(-60))); }catch{}
  }
  loadFamily(family);
  return stackOf(family, genericOf(family));
}

/* ── buscador ───────────────────────────────────────────────── */
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Diálogo para buscar en todo el catálogo. Devuelve la familia elegida o null. */
export async function pickFont(){
  const [{ dialog }, list] = await Promise.all([import("../ui/dialog.js"), catalog()]);
  if(!list.length){
    const { toast } = await import("../ui/toast.js");
    toast("No se pudo cargar el catálogo de fuentes", "err");
    return null;
  }
  const body = document.createElement("div");
  body.className = "font-picker";
  body.innerHTML = `
    <input type="search" class="fp-q" placeholder="Buscar fuente (p. ej. Lobster, Roboto…)" aria-label="Buscar fuente" autocomplete="off">
    <div class="seg fp-cats">${[["", "Todas"], ...Object.entries(CATEGORY_LABEL)].map(([k, l]) => `<button type="button" data-c="${k}"${k ? "" : ' class="on"'}>${l}</button>`).join("")}</div>
    <p class="hint fp-count"></p>
    <div class="fp-list" role="listbox" aria-label="Fuentes"></div>`;
  const q = body.querySelector(".fp-q"), listEl = body.querySelector(".fp-list"), count = body.querySelector(".fp-count");
  let cat = "", chosen = null, closeDlg = null;
  /* Cada nombre se ve con su propia fuente, que se descarga sólo
     cuando su fila entra en pantalla. */
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if(!en.isIntersecting) return;
    io.unobserve(en.target);
    const fam = en.target.dataset.f;
    loadFamily(fam, 400, false, fam).then(() => { en.target.querySelector("b").style.fontFamily = `'${fam}', ${genericOf(fam)}`; });
  }), { root: listEl, rootMargin: "120px" });
  const render = () => {
    const words = norm(q.value).split(/\s+/).filter(Boolean);
    const hits = list.filter(e => (!cat || e.c === cat) && words.every(w => norm(e.f).includes(w)));
    count.textContent = `${hits.length} fuente${hits.length === 1 ? "" : "s"}${hits.length > 120 ? " · se muestran las 120 primeras: escribe para afinar" : ""}`;
    io.disconnect(); listEl.innerHTML = "";
    for(const e of hits.slice(0, 120)){
      const b = document.createElement("button");
      b.type = "button"; b.className = "fp-item"; b.dataset.f = e.f; b.setAttribute("role", "option");
      b.innerHTML = `<b></b><span>${CATEGORY_LABEL[e.c] || ""}${e.sc ? " · " + e.sc : ""}</span>`;
      b.querySelector("b").textContent = e.f;
      listEl.appendChild(b); io.observe(b);
    }
  };
  q.addEventListener("input", render);
  body.querySelector(".fp-cats").addEventListener("click", e => {
    const b = e.target.closest("[data-c]"); if(!b) return;
    cat = b.dataset.c;
    body.querySelectorAll(".fp-cats button").forEach(x => x.classList.toggle("on", x === b));
    render();
  });
  listEl.addEventListener("click", e => { const b = e.target.closest(".fp-item"); if(!b) return; chosen = b.dataset.f; closeDlg?.(); });
  q.addEventListener("keydown", e => { if(e.key === "Enter"){ const first = listEl.querySelector(".fp-item"); if(first){ e.preventDefault(); chosen = first.dataset.f; closeDlg?.(); } } });
  render();
  await dialog({ title: "Todas las fuentes", body, wide: true, cls: "dlg-fonts",
    onOpen: (_, api) => { closeDlg = () => api.close(null); setTimeout(() => q.focus(), 50); },
    buttons: [{ label: "Cancelar", value: null }] });
  io.disconnect();
  return chosen;
}
