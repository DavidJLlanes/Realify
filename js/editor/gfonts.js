/* ═══════════════════════════════════════════════════════════════
   GOOGLE FONTS
   Tipografías libres servidas por Google Fonts para la herramienta de
   texto (y para el creador de memes, ver memes/fonts.js).

   Privacidad: descargar una fuente de fonts.googleapis.com /
   fonts.gstatic.com hace que el navegador envíe a Google la dirección
   IP y el agente de usuario de quien la pide. Por eso nada se descarga
   sin permiso: la primera vez que alguien elige una fuente de Google
   se le explica y se le pregunta, y la respuesta se recuerda en este
   navegador (localStorage, «realify.googleFonts»). Sin permiso, las
   entradas de Google siguen en la lista pero se dibujan con su
   alternativa del sistema. Se puede cambiar de opinión desde la
   Política de privacidad.
   ═══════════════════════════════════════════════════════════════ */

const KEY = "realify.googleFonts";
const CUSTOM_KEY = "realify.googleFonts.custom";

/* [familia, categoría CSS de reserva] — las más usadas de Google Fonts */
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

export const stackOf = (family, generic = "sans-serif") => `'${family}', ${generic}`;
const familyOf = stack => { const m = /^\s*'([^']+)'/.exec(String(stack || "")); return m ? m[1] : null; };

/** Entradas [stack, etiqueta] para las listas de fuentes. */
export function googleFontItems(){
  return [...BASE, ...custom.map(f => [f, "sans-serif"])].map(([f, g]) => [stackOf(f, g), `${f} · Google`]);
}
const known = () => new Set([...BASE.map(b => b[0]), ...custom]);
export const isGoogleStack = stack => { const f = familyOf(stack); return !!f && known().has(f); };

/* ── consentimiento ─────────────────────────────────────────── */
export const consent = () => { try{ return localStorage.getItem(KEY) || ""; }catch{ return ""; } };
export function setConsent(v){ try{ v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); }catch{} }

let asking = null;
/** Pregunta una vez; devuelve true si se permite descargar de Google Fonts. */
export async function ensureConsent(){
  const c = consent();
  if(c === "granted") return true;
  if(c === "denied") return false;
  if(asking) return asking;
  asking = (async () => {
    const { dialog } = await import("../ui/dialog.js");
    const res = await dialog({
      title: "Usar tipografías de Google Fonts",
      body: `<p class="hint">Las fuentes de Google se descargan de los servidores de Google
          (<code>fonts.googleapis.com</code> y <code>fonts.gstatic.com</code>). Para servirlas,
          Google recibe la <b>dirección IP</b> y el <b>navegador</b> de quien las pide. Tus imágenes
          y tus textos <b>no</b> se envían: sólo la petición de la fuente.</p>
        <p class="hint">Si no lo permites, esas fuentes se dibujan con una parecida del sistema.
          Puedes cambiar de opinión cuando quieras en la Política de privacidad.</p>`,
      buttons: [{ label: "No, gracias", value: "denied" }, { label: "Permitir Google Fonts", primary: true, value: "granted" }]
    });
    const v = res === "granted" ? "granted" : "denied";
    setConsent(v);
    return v === "granted";
  })();
  try{ return await asking; } finally{ asking = null; }
}

/* ── carga ──────────────────────────────────────────────────── */
const sheets = new Map();   // familia → Promise<boolean>
function linkSheet(href){
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = href;
    link.onload = () => resolve(true);
    link.onerror = () => { link.remove(); resolve(false); };
    document.head.appendChild(link);
  });
}
/* Pide los cuatro estilos (normal, negrita y sus cursivas). Muchas
   familias sólo tienen uno: Google responde con error a una petición
   de estilos que no existen, y entonces se pide sólo la regular (el
   navegador sintetiza la negrita y la cursiva). */
function loadSheet(family){
  if(!sheets.has(family)){
    const q = encodeURIComponent(family).replace(/%20/g, "+");
    sheets.set(family, (async () =>
      await linkSheet(`https://fonts.googleapis.com/css2?family=${q}:ital,wght@0,400;0,700;1,400;1,700&display=swap`) ||
      await linkSheet(`https://fonts.googleapis.com/css2?family=${q}&display=swap`))());
    sheets.get(family).then(ok => { if(!ok) sheets.delete(family); });
  }
  return sheets.get(family);
}

/**
 * Deja lista la fuente de `stack` si es de Google y hay permiso.
 * Devuelve true si hay que volver a dibujar (acaba de cargarse).
 * `ask`: si no hay decisión todavía, preguntar (sólo desde un gesto
 * del usuario, nunca al abrir un proyecto).
 */
export async function ensureFont(stack, { weight = 400, italic = false, ask = false } = {}){
  const family = familyOf(stack);
  if(!family || !known().has(family)) return false;
  if(consent() !== "granted" && !(ask && await ensureConsent())) return false;
  const spec = `${italic ? "italic " : ""}${weight} 40px '${family}'`;
  /* Ojo: `document.fonts.check()` responde «sí» para una familia que el
     navegador aún no conoce (no hay nada pendiente de cargar), así que
     no sirve para saber si ya se descargó. Se lleva la cuenta aquí. */
  if(loadedSpecs.has(spec)) return false;
  if(!await loadSheet(family)) return false;
  try{ await document.fonts.load(spec); }catch{ return false; }
  loadedSpecs.add(spec);
  return true;
}
const loadedSpecs = new Set();

/* Valor de la entrada «Otra fuente de Google Fonts…» de las listas. */
export const GOOGLE_OTHER = "__google_other__";

/**
 * Lo que hay que hacer cuando alguien elige `value` en una lista de
 * fuentes. Devuelve la fuente a aplicar, o null para dejar la de antes
 * (separador, permiso denegado, cancelado). Pregunta el permiso la
 * primera vez que se elige una de Google y la deja cargada.
 */
export async function chooseFontValue(value){
  const { toast } = await import("../ui/toast.js");
  if(!value || value.startsWith("__sep")) return null;
  if(value === GOOGLE_OTHER){
    const { promptDlg } = await import("../ui/dialog.js");
    const name = await promptDlg("Otra fuente de Google Fonts", "Nombre exacto de la familia (como aparece en fonts.google.com)", "");
    if(!name) return null;
    try{
      const stack = await addCustomGoogleFont(name);
      if(!stack){ toast("Sin permiso para usar Google Fonts"); return null; }
      toast(`Fuente añadida: ${name.trim()}`, "ok");
      return stack;
    }catch(e){ toast(e.message, "err"); return null; }
  }
  if(isGoogleStack(value)){
    if(!await ensureConsent()){ toast("Sin permiso para usar Google Fonts: se mantiene la fuente anterior"); return null; }
    ensureFont(value);
  }
  return value;
}

/** Añade una familia cualquiera de Google Fonts por su nombre exacto. */
export async function addCustomGoogleFont(name){
  const family = String(name || "").trim().replace(/\s+/g, " ").replace(/['"<>;{}]/g, "");
  if(!family) return null;
  if(!await ensureConsent()) return null;
  if(!await loadSheet(family)) throw new Error(`Google Fonts no tiene ninguna familia llamada «${family}». Comprueba el nombre en fonts.google.com.`);
  if(!BASE.some(b => b[0] === family) && !custom.includes(family)){
    custom.push(family);
    try{ localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom)); }catch{}
  }
  try{ await document.fonts.load(`400 40px '${family}'`); }catch{}
  return stackOf(family, (BASE.find(b => b[0] === family) || [0, "sans-serif"])[1]);
}
