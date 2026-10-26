/* ═══════════════════════════════════════════════════════════════
   NOMBRES POSTSCRIPT DE LAS FUENTES (v256) para el texto editable de PSD/PSB.
   Photoshop identifica la fuente por su nombre PostScript («ArialMT», «Arial-BoldMT»…), no por la familia CSS de Realify. Aquí va una tabla con las
   fuentes del sistema más comunes —regular, negrita, cursiva y negrita cursiva— y una regla para las tipografías libres que trae Realify
   («Roboto-Regular», «Roboto-Bold»…). Lo que no se conoce sale con el nombre de la familia sin espacios y la negrita/cursiva «falsas» (faux) de Photoshop.
   ═══════════════════════════════════════════════════════════════ */

const T = {
  "arial": ["ArialMT", "Arial-BoldMT", "Arial-ItalicMT", "Arial-BoldItalicMT"],
  "arial black": ["Arial-Black", "Arial-Black", "Arial-Black", "Arial-Black"],
  "helvetica": ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"],
  "helvetica neue": ["HelveticaNeue", "HelveticaNeue-Bold", "HelveticaNeue-Italic", "HelveticaNeue-BoldItalic"],
  "segoe ui": ["SegoeUI", "SegoeUI-Bold", "SegoeUI-Italic", "SegoeUI-BoldItalic"],
  "calibri": ["Calibri", "Calibri-Bold", "Calibri-Italic", "Calibri-BoldItalic"],
  "candara": ["Candara", "Candara-Bold", "Candara-Italic", "Candara-BoldItalic"],
  "verdana": ["Verdana", "Verdana-Bold", "Verdana-Italic", "Verdana-BoldItalic"],
  "tahoma": ["Tahoma", "Tahoma-Bold", "Tahoma", "Tahoma-Bold"],
  "trebuchet ms": ["TrebuchetMS", "TrebuchetMS-Bold", "TrebuchetMS-Italic", "Trebuchet-BoldItalic"],
  "impact": ["Impact", "Impact", "Impact", "Impact"],
  "georgia": ["Georgia", "Georgia-Bold", "Georgia-Italic", "Georgia-BoldItalic"],
  "times new roman": ["TimesNewRomanPSMT", "TimesNewRomanPS-BoldMT", "TimesNewRomanPS-ItalicMT", "TimesNewRomanPS-BoldItalicMT"],
  "times": ["TimesNewRomanPSMT", "TimesNewRomanPS-BoldMT", "TimesNewRomanPS-ItalicMT", "TimesNewRomanPS-BoldItalicMT"],
  "cambria": ["Cambria", "Cambria-Bold", "Cambria-Italic", "Cambria-BoldItalic"],
  "garamond": ["Garamond", "Garamond-Bold", "Garamond-Italic", "Garamond-Bold"],
  "palatino linotype": ["PalatinoLinotype-Roman", "PalatinoLinotype-Bold", "PalatinoLinotype-Italic", "PalatinoLinotype-BoldItalic"],
  "book antiqua": ["BookAntiqua", "BookAntiqua-Bold", "BookAntiqua-Italic", "BookAntiqua-BoldItalic"],
  "courier new": ["CourierNewPSMT", "CourierNewPS-BoldMT", "CourierNewPS-ItalicMT", "CourierNewPS-BoldItalicMT"],
  "consolas": ["Consolas", "Consolas-Bold", "Consolas-Italic", "Consolas-BoldItalic"],
  "lucida console": ["LucidaConsole", "LucidaConsole", "LucidaConsole", "LucidaConsole"],
  "comic sans ms": ["ComicSansMS", "ComicSansMS-Bold", "ComicSansMS", "ComicSansMS-Bold"],
  "century gothic": ["CenturyGothic", "CenturyGothic-Bold", "CenturyGothic-Italic", "CenturyGothic-BoldItalic"],
  "gill sans": ["GillSans", "GillSans-Bold", "GillSans-Italic", "GillSans-BoldItalic"],
  "futura": ["Futura-Medium", "Futura-Bold", "Futura-MediumItalic", "Futura-BoldItalic"],
  "franklin gothic medium": ["FranklinGothic-Medium", "FranklinGothic-Medium", "FranklinGothic-MediumItalic", "FranklinGothic-MediumItalic"],
  "arial narrow": ["ArialNarrow", "ArialNarrow-Bold", "ArialNarrow-Italic", "ArialNarrow-BoldItalic"],
  "optima": ["Optima-Regular", "Optima-Bold", "Optima-Italic", "Optima-BoldItalic"],
  "avenir": ["Avenir-Roman", "Avenir-Heavy", "Avenir-Oblique", "Avenir-HeavyOblique"],
  "baskerville": ["Baskerville", "Baskerville-Bold", "Baskerville-Italic", "Baskerville-BoldItalic"]
};
const GENERIC = new Set(["sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui", "ui-monospace", "-apple-system"]);

/** Primer nombre de familia de una pila CSS («'Times New Roman', Times, serif» → «Times New Roman»); system-ui → Arial. */
export function firstFamily(stack){
  const first = String(stack || "Arial").split(",")[0].replace(/["']/g, "").trim();
  return GENERIC.has(first.toLowerCase()) ? "Arial" : first;
}

/** { name, fauxBold, fauxItalic } de Photoshop para una fuente de Realify (`stack` CSS, peso, cursiva). */
export function psFont(stack, weight = 400, italic = false){
  const fam = firstFamily(stack), key = fam.toLowerCase(), bold = (weight || 400) >= 600, row = T[key];
  if(row){ const i = (bold ? 1 : 0) + (italic ? 2 : 0); const real = [!bold || row[1] !== row[0], !italic || row[2] !== row[0]]; return { name: row[i], fauxBold: bold && !real[0], fauxItalic: italic && !real[1] }; }
  const flat = fam.replace(/\s+/g, "");
  // las tipografías libres de Realify (carpeta /fonts) siguen la regla «Familia-Regular», «Familia-Bold»
  return { name: `${flat}-${bold ? "Bold" : "Regular"}`, fauxBold: false, fauxItalic: italic };
}

const REV = new Map();
for(const [fam, row] of Object.entries(T)) row.forEach((n, i) => { if(!REV.has(n)) REV.set(n, { family: fam, bold: i === 1 || i === 3, italic: i === 2 || i === 3 }); });

/** Fuente de Realify (familia CSS legible, peso, cursiva) para un nombre PostScript de Photoshop; `families`: las pilas de FONTS. null si no se reconoce. */
export function fromPsName(name, families = []){
  if(!name) return null;
  const hit = REV.get(name);
  const find = fam => families.find(s => firstFamily(s).toLowerCase() === fam.toLowerCase());
  if(hit){ const stack = find(hit.family); return { stack: stack || hit.family.replace(/\b\w/g, c => c.toUpperCase()), bold: hit.bold, italic: hit.italic }; }
  const m = /^(.+?)[-_ ]?(BoldItalic|BoldOblique|Bold|Italic|Oblique|Regular|Roman|Medium|Light)?$/i.exec(name);
  if(!m) return null;
  const base = m[1].replace(/([a-z])([A-Z])/g, "$1 $2"), style = (m[2] || "").toLowerCase();
  const stack = find(base);
  return { stack: stack || base, bold: /bold/.test(style), italic: /italic|oblique/.test(style) };
}
