/* ═══════════════════════════════════════════════════════════════
   BUSCAR FOTOS · CONSULTA Y PUNTUACIÓN (motor puro, sin DOM)
   Entiende una frase corta en español («perro en la playa», «cielo azul», «retrato en blanco y negro», «foto de noche») y puntúa cada
   registro del índice. Cada término puede venir de: el tipo de foto que dio la lente (92 tipos, en español), las 10 clases más probables
   de MobileNet (se traduce la palabra al inglés con js/ai/es2en.js), los colores dominantes o una marca de la foto (noche, blanco y negro, retrato).
   Entradas: texto y registros { cat, catEtiqueta, grupo, top:[{label,p}], colores, brillo, bn, piel }. Salida: lista ordenada { i, puntos }.
   Límites: no es CLIP; entiende objetos, escenas y colores, no relaciones («un perro a la izquierda»). Sin resultados con todos los
   términos, se enseñan los que cumplen alguno.
   ═══════════════════════════════════════════════════════════════ */
import { toEnglish } from "../../../../ai/es2en.js";
import { NOMBRES } from "./color.js";

export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();
const VACIAS = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "con", "en", "y", "o", "a", "foto", "fotos", "imagen", "imagenes", "que", "tenga", "tengan", "donde", "hay", "sale", "salen", "mi", "mis", "por", "para", "al"]);
const COLOR_ALIAS = { marron: "marron", cafe: "marron", gris: "gris", grises: "gris", dorado: "amarillo", amarilla: "amarillo", amarillo: "amarillo", roja: "rojo", rojos: "rojo", rojas: "rojo", rojo: "rojo", azul: "azul", azules: "azul", verde: "verde", verdes: "verde", naranja: "naranja", naranjas: "naranja", morado: "morado", morada: "morado", violeta: "morado", lila: "morado", rosa: "rosa", rosas: "rosa", rosado: "rosa", turquesa: "turquesa", cian: "turquesa", blanca: "blanco", blanco: "blanco", blancos: "blanco", negra: "negro", negro: "negro", negros: "negro" };
const MARCAS = [
  { re: /^(blanco y negro|monocromo|monocroma|bn|b n)$/, id: "bn", texto: "blanco y negro" },
  { re: /^(noche|nocturna|nocturno|oscura|oscuro|oscuras|oscuros)$/, id: "noche", texto: "de noche" },
  { re: /^(luminosa|luminoso|clara|claro|brillante|soleada|soleado)$/, id: "clara", texto: "luminosa" },
  { re: /^(retrato|retratos|persona|personas|gente|cara|caras|rostro|selfie|selfies)$/, id: "personas", texto: "con personas" }
];

/** «perro en la playa» → [{ tipo, valor, es, en }…]. Los colores y las marcas no se traducen; el resto va al inglés palabra a palabra. */
export function interpretar(texto){
  const n = norm(texto).replace(/\bblanco y negro\b/g, "bn"), palabras = n.split(" ").filter(w => w && !VACIAS.has(w)), out = [];
  for(const w of palabras){
    const marca = MARCAS.find(m => m.re.test(w));
    if(marca){ if(!out.some(t => t.valor === marca.id)) out.push({ tipo: "marca", valor: marca.id, es: marca.texto }); continue; }
    if(COLOR_ALIAS[w]){ const c = COLOR_ALIAS[w]; if(!out.some(t => t.valor === c)) out.push({ tipo: "color", valor: c, es: c }); continue; }
    if(w.length < 3) continue;
    const en = norm(toEnglish(w).text).split(" ").filter(x => x.length > 2);
    out.push({ tipo: "palabra", valor: w, es: w, en });
  }
  return out;
}

const empieza = (texto, w) => texto.split(" ").some(p => p.startsWith(w.length > 4 ? w.slice(0, w.length - 1) : w));

/** Puntos de un registro para un término (0 = no cumple). */
export function puntosTermino(r, t){
  if(t.tipo === "color"){ const f = (r.colores || []).find(c => c[0] === t.valor)?.[1] || 0; return f >= 0.08 ? 1 + Math.min(2, f * 4) : 0; }
  if(t.tipo === "marca"){
    if(t.valor === "bn") return r.bn ? 3 : 0;
    if(t.valor === "noche") return r.brillo < 0.2 ? 3 : r.brillo < 0.3 ? 1 : 0;
    if(t.valor === "clara") return r.brillo > 0.62 ? 2.5 : 0;
    if(t.valor === "personas") return r.piel > 0.2 || /retrato/.test(norm(r.grupo)) ? 3 : 0;
  }
  let p = 0;
  const cat = norm((r.catEtiqueta || "") + " " + (r.grupo || ""));
  if(cat && empieza(cat, t.valor)) p = Math.max(p, 3);
  for(const e of t.en || []){
    for(const c of r.top || []){
      if(norm(c.label).split(" ").some(w => w === e || (e.length > 4 && w.startsWith(e.slice(0, e.length - 1))))) p = Math.max(p, 1.5 + 4 * Math.min(1, c.p * 2));
    }
  }
  return p;
}

/** Ordena los registros por lo bien que cumplen la frase. Devuelve [{ i, puntos }] (vacío si la frase no dice nada). */
export function buscar(registros, texto, max = 200){
  const ts = interpretar(texto); if(!ts.length) return [];
  const filas = registros.map((r, i) => { const p = ts.map(t => puntosTermino(r, t)); return { i, puntos: p.reduce((s, x) => s + x, 0), todos: p.every(x => x > 0), alguno: p.some(x => x > 0) }; });
  let ok = filas.filter(f => f.todos);
  if(!ok.length) ok = filas.filter(f => f.alguno);
  return ok.sort((a, b) => b.puntos - a.puntos).slice(0, max).map(({ i, puntos }) => ({ i, puntos: +puntos.toFixed(2) }));
}

export { NOMBRES };
