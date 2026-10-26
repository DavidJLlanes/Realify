/* FASE 4 · utilidades duplicadas → js/core/util/.
   Busca funciones y constantes pequeñas (≤ 12 líneas) de primer nivel cuyo cuerpo es IDÉNTICO (salvo el nombre) en 3 o más
   archivos y que son puras: no usan nada del ámbito de su archivo, solo globales del lenguaje (Math, String, TextEncoder…).
   Cada copia se sustituye por un import de la versión única; si el nombre local era distinto se usa un alias
   (`import { clamp255 as clamp8 }`), así el resto del archivo no cambia. Si la copia estaba exportada se reexporta.
   Se deja fuera lo que depende de constantes locales (isMobile, proxyOf…), del DOM (stage, COARSE…) o es distinto en
   detalle (las dos variantes de clamp con distinto orden de comparación se tratan como funciones distintas).
     node tools/migrate/phase4-dedupe.mjs [--dry]            (necesita PW_CORE con acorn) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "./lib/splitter.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!/realify - mejorado$/i.test(root.replace(/\\/g, "/"))) throw new Error("Debe ejecutarse sobre «Realify - Mejorado»");
const DRY = process.argv.includes("--dry");
const posix = path.posix;
const GLOBALS = new Set(["Math", "String", "Number", "Array", "Object", "Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array", "Float32Array", "TextEncoder", "TextDecoder", "Promise", "setTimeout", "document", "undefined", "NaN", "Infinity", "Date", "JSON", "parseInt", "parseFloat", "isFinite", "isNaN", "Symbol", "BigInt", "Error"]);

const files = [];
for (const r of ["js", "plugins"]) (function w(d) {
  for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
    const p = d + "/" + e.name;
    if (e.isDirectory()) { if (/^(vendor|emoji|files|tests)$/.test(e.name)) continue; w(p); }
    else if (/\.js$/.test(e.name) && p !== "js/core/vendor.js" && !p.startsWith("js/core/util/")) files.push(p);
  }
})(r);

/* 1 · recoger candidatas */
const groups = new Map();
const analyses = new Map();
for (const f of files) {
  let A; try { A = analyze(fs.readFileSync(path.join(root, f), "utf8")); } catch { continue; }
  analyses.set(f, A);
  for (const u of A.units) {
    if (u.names.length !== 1 || u.lines > 12 || !["FunctionDeclaration", "VariableDeclaration"].includes(u.type)) continue;
    if (u.type === "VariableDeclaration") {
      /* solo funciones: una constante (cadena, número, elemento del DOM) puede ser igual por casualidad o por diseño propio */
      const init = u.decl.declarations[0].init;
      if (u.decl.kind !== "const" || !init || !["ArrowFunctionExpression", "FunctionExpression"].includes(init.type)) continue;
    }
    const body = A.src.slice(u.start, u.end).replace(/^export\s+/, "").replace(/\s+/g, " ").trim();
    if (body.length < 40) continue;
    if (/document.|window.|navigator./.test(body)) continue;      // nunca se comparte nada que toque el DOM
    /* pura: ninguna referencia a bindings del ámbito del archivo ni a imports */
    const free = [...u.refs].filter(r => !GLOBALS.has(r) && (A.declared.has(r) || A.imports.has(r)));
    if (free.length) continue;
    /* sin acceso a variables globales no esperadas (p. ej. window, matchMedia…) */
    const odd = [...u.refs].filter(r => !GLOBALS.has(r) && !isLocal(u, r));
    if (odd.length) continue;
    const key = body.replace(/^(?:async\s+)?(?:function\s+\w+|const\s+\w+\s*=)/, "§").replace(/;$/, "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ f, u, name: u.names[0], A });
  }
}
/* nombres declarados dentro de la propia sentencia (parámetros, locales): no cuentan como globales */
function isLocal(u, name) {
  const src = u.text;
  return new RegExp(`(?:\\(|,|\\s)${name}\\s*(?:=>|,|\\)|=|;|\\))|(?:let|const|var)\\s+${name}\\b|function\\s*\\w*\\([^)]*\\b${name}\\b`).test(src);
}

const picked = [...groups.values()].filter(g => new Set(g.map(x => x.f)).size >= 3);

/* 2 · nombres y módulos de destino */
const catOf = body => /getContext/.test(body) ? "canvas" : /replace\(\/&\//.test(body) ? "html" : /normalize\(|TextEncoder|fromCharCode/.test(body) ? "text" : /setTimeout/.test(body) ? "async" : "math";
const OVERRIDE = [   // [regex del cuerpo, nombre canónico]
  [/replace\(\/&\/g, "&amp;"\)\.replace\(\/<\/g, "&lt;"\)\.replace\(\/"\/g/, "escAttr"],
  [/replace\(\/&\/g, "&amp;"\)\.replace\(\/<\/g, "&lt;"\)(?!\.replace)/, "escText"],
  [/Math\.max\(a, Math\.min\(b, v\)\)/, "clamp"],
  [/v < a \? a : v > b \? b : v/, "clampCmp"],
  [/v <= 0\.0031308 \? 12\.92/, "linearToSrgb255"],
  [/Math\.imul\(i \^ 0x9e3779b9/, "hash32"],
  [/toLowerCase\(\)\.normalize\("NFD"\)/, "foldText"],
  [/new TextEncoder\(\)\.encode/, "utf8"],
  [/String\.fromCharCode\(u\[i \+ k\]\)/, "asciiAt"],
  [/new Promise\(r => setTimeout\(r, 0\)\)/, "nextTask"],
  [/getImageData\(0, 0, c\.width, c\.height\)\.data/, "readPixels"],
  [/Math\.exp\(-\(\(x - c\)/, "bell"],
  [/0x2545f491/, "ditherAt"],
  [/v < 0 \? 0 : v > 255 \? 255 : v/, "clamp255"],
  [/v < 0 \? 0 : v > 1 \? 1 : v/, "clamp01"]
];
const plan = [];
for (const g of picked) {
  const body = g[0].A.src.slice(g[0].u.start, g[0].u.end).replace(/\s+/g, " ");
  const named = OVERRIDE.find(([re]) => re.test(body));
  const counts = {}; g.forEach(x => counts[x.name] = (counts[x.name] || 0) + 1);
  const canon = named ? named[1] : Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  plan.push({ g, canon, cat: catOf(body), body, unnamed: !named });
}
const MODULE = { math: "js/core/util/math.js", html: "js/core/util/html.js", canvas: "js/core/util/canvas.js", text: "js/core/util/text.js", async: "js/core/util/async.js" };
/* nombres canónicos repetidos dentro de un mismo módulo: se desambiguan */
const seen = new Map();
for (const p of plan) { const k = MODULE[p.cat] + ":" + p.canon; seen.set(k, (seen.get(k) || 0) + 1); if (seen.get(k) > 1) p.canon += seen.get(k); }

console.log(`grupos a unificar: ${plan.length} · copias: ${plan.reduce((a, p) => a + p.g.length, 0)}`);
for (const p of plan.sort((a, b) => b.g.length - a.g.length)) console.log(`  ×${String(p.g.length).padStart(2)}  ${p.canon.padEnd(18)} → ${MODULE[p.cat].replace("js/core/util/", "")}${p.unnamed ? "  (nombre por mayoría: revisar)" : ""}   ${p.body.slice(0, 80)}`);
if (DRY) process.exit(0);

/* 3 · módulos de utilidades */
const HEAD = {
  math: "Matemáticas pequeñas que estaban copiadas en muchos archivos (limitar valores, curvas gamma, bases, hash entero, tramado).",
  html: "Escape de texto para HTML.",
  canvas: "Lectura de píxeles de un lienzo.",
  text: "Texto: normalizar para buscar, ASCII y UTF-8.",
  async: "Utilidades asíncronas."
};
const byMod = new Map();
for (const p of plan) { const m = MODULE[p.cat]; if (!byMod.has(m)) byMod.set(m, []); byMod.get(m).push(p); }
fs.mkdirSync(path.join(root, "js/core/util"), { recursive: true });
for (const [m, ps] of byMod) {
  const cat = Object.keys(MODULE).find(k => MODULE[k] === m);
  const defs = ps.map(p => {
    const first = p.g[0];
    const text = first.A.src.slice(first.u.start, first.u.end).replace(/^export\s+/, "");
    /* se renombra a la forma canónica */
    return "export " + text.replace(/^(async\s+)?(function\s+)(\w+)/, (mm, a = "", f, n) => `${a}${f}${p.canon}`).replace(/^const\s+\w+\s*=/, `const ${p.canon} =`);
  }).join("\n\n");
  fs.writeFileSync(path.join(root, m), `/* ═══════════════════════════════════════════════════════════════\n   UTILIDADES · ${HEAD[cat]}\n   Una sola copia: antes estaban repetidas, idénticas, en 3 o más archivos (fase 4 de la reorganización).\n   ═══════════════════════════════════════════════════════════════ */\n\n${defs}\n`);
}

/* 4 · sustituir cada copia por su import */
const edits = new Map();           // archivo → [{from,to,text}] y imports a añadir
for (const p of plan) for (const x of p.g) {
  if (!edits.has(x.f)) edits.set(x.f, { cuts: [], imports: new Map(), reexports: [] });
  const e = edits.get(x.f), m = MODULE[p.cat];
  e.imports.set(m, [...(e.imports.get(m) || []), x.name === p.canon ? p.canon : `${p.canon} as ${x.name}`]);
  if (x.u.exported) e.reexports.push(x.name);
  e.cuts.push({ u: x.u, A: x.A });
}
let changed = 0;
for (const [f, e] of edits) {
  let src = fs.readFileSync(path.join(root, f), "utf8");
  const A = analyses.get(f);
  /* recortes de atrás hacia delante, para no mover los desplazamientos */
  const cuts = e.cuts.map(c => {
    let from = c.u.start - c.u.declOffset, to = c.u.end;
    const rest = src.slice(to, (src.indexOf("\n", to) < 0 ? src.length : src.indexOf("\n", to)));
    if (/^[ \t]*(\/\/.*)?$/.test(rest)) to += rest.length + (src[to + rest.length] === "\n" ? 1 : 0);
    while (from > 0 && src[from - 1] === "\n" && src[from - 2] === "\n" && (src[to] === "\n" || to >= src.length)) { from--; }
    return { from, to };
  }).sort((a, b) => b.from - a.from);
  for (const c of cuts) src = src.slice(0, c.from) + src.slice(c.to);
  /* imports: tras el último import del archivo (o al principio si no tiene) */
  const dir = posix.dirname(f);
  const lines = [...e.imports].map(([m, names]) => {
    let rel = posix.relative(dir, m); if (!rel.startsWith(".")) rel = "./" + rel;
    return `import { ${[...new Set(names)].join(", ")} } from "${rel}";`;
  });
  if (e.reexports.length) lines.push(`export { ${e.reexports.join(", ")} };`);
  const ast2 = analyze(src);
  const lastImp = ast2.importNodes.at(-1);
  if (lastImp) src = src.slice(0, lastImp.end) + "\n" + lines.join("\n") + src.slice(lastImp.end);
  else {
    /* sin imports: tras la cabecera de comentarios, antes de la primera sentencia */
    const first = ast2.units[0], at = first ? first.start - first.declOffset : 0;
    src = src.slice(0, at) + lines.join("\n") + "\n\n" + src.slice(at);
  }
  fs.writeFileSync(path.join(root, f), src);
  changed++;
}
console.log(`\narchivos modificados: ${changed} · módulos nuevos: ${[...byMod.keys()].join(", ")}`);
