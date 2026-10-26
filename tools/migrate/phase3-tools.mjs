/* FASE 3 · js/editor/tools/tools.js (3.648 líneas) → un archivo por familia de herramientas.
   Pasos (todo con el texto original, sin cambiar lógica):
     1. La herramienta activa (`current`) pasa a un módulo diminuto (tool-current.js) con su setter, para que las
        herramientas puedan leerla sin importar el registro de herramientas (evita un ciclo).
     2. Cada elemento del array TOOLS se saca a su propia constante (`const moveTool = {…}`) y TOOLS queda como la
        lista de esas constantes, en el MISMO orden.
     3. El divisor reparte constantes y funciones auxiliares en js/editor/tools/defs/*.js; lo que usan varias familias
        va a defs/shared.js. tools.js conserva el registro (TOOLS, setTool…) y reexporta toda su API.
     node tools/migrate/phase3-tools.mjs [--dry]            (necesita PW_CORE con acorn) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, parse, splitFile } from "./lib/splitter.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!/realify - mejorado$/i.test(root.replace(/\\/g, "/"))) throw new Error("Debe ejecutarse sobre «Realify - Mejorado»");
const DRY = process.argv.includes("--dry");
const FILE = "js/editor/tools/tools.js";
const abs = p => path.join(root, p);

/* ── 1 · herramienta activa: se separa de la lista de herramientas ──
   setTool buscaba la herramienta en TOOLS (que las contiene a todas) y las herramientas de Recortar llaman a setTool
   al terminar: eso obliga a un ciclo (herramientas ↔ registro). Se evita así: tool-current.js guarda la herramienta
   activa y setTool, y recibe la lista con registerTools(TOOLS) al arrancar. Es el ÚNICO cambio que no es mover texto:
     · «export let current = TOOLS[0];»   →   «registerTools(TOOLS)» (que fija la lista y current = list[0])
     · en setTool: «TOOLS.find(…)»        →   «toolList.find(…)» */
let src = fs.readFileSync(abs(FILE), "utf8");
const alreadyGlued = src.includes("registerTools(TOOLS)");
if (!alreadyGlued) {
  const must = (a, b) => { if (!src.includes(a)) throw new Error("No encuentro: " + a); src = src.replace(a, b); };
  must("export let current = TOOLS[0];",
       ["let toolList = [];",
        "function registerTools(list){ toolList = list; current = list[0]; }",
        "export let current = null;",
        "registerTools(TOOLS);"].join("\n"));
  must("const t = TOOLS.find(x => x.id === id);", "const t = toolList.find(x => x.id === id);");
  if (!DRY) fs.writeFileSync(abs(FILE), src);
  console.log("herramienta activa: preparada");
} else console.log("herramienta activa: ya preparada");

/* ── 2 · una constante por herramienta ── */
if (!/export const TOOLS = \[[^{]*?\w+Tool\b/.test(src)) {
  const ast = parse(src);
  const decl = ast.body.find(n => n.type === "ExportNamedDeclaration" && n.declaration?.type === "VariableDeclaration" && n.declaration.declarations[0].id.name === "TOOLS");
  const arr = decl.declaration.declarations[0].init;
  const names = [], parts = [];
  const taken = new Set(analyze(src).declared.keys());
  let cursor = arr.start + 1;
  const camel = id => id.replace(/-(\w)/g, (m, c) => c.toUpperCase()) + "Tool";
  for (const el of arr.elements) {
    const id = el.properties.find(p => p.key.name === "id").value.value;
    const nm = camel(id);
    if (taken.has(nm)) throw new Error("nombre ya usado: " + nm);
    taken.add(nm); names.push(nm);
    /* comentarios entre elementos: se quedan delante de su constante */
    const between = src.slice(cursor, el.start).replace(/^[\s,]*/, "");
    parts.push((between.trim() ? between.replace(/\s+$/, "") + "\n" : "") + `const ${nm} = ${src.slice(el.start, el.end)};`);
    cursor = el.end;
  }
  const lead = src.slice(decl.start, arr.start); // «export const TOOLS = »
  const replacement = parts.join("\n\n") + "\n\n" + lead + "[" + names.join(", ") + "];";
  src = src.slice(0, decl.start) + replacement + src.slice(decl.end);
  if (!DRY) fs.writeFileSync(abs(FILE), src);
  console.log(`TOOLS: ${names.length} constantes (${names.join(", ")})`);
} else console.log("TOOLS: ya separado");

/* ── 3 · reparto ── */
const FAMILY = {
  navigation: ["pan", "zoom", "picker", "compare"],
  "move-liquify": ["move", "liquify", "camove"],
  select: ["select-rect", "select-ellipse", "select-lasso", "select-wand", "pen"],
  paint: ["brush", "eraser", "smudge", "expose", "dodgeburn", "historyBrush"],
  retouch: ["clone", "heal"],
  "fill-gradient": ["fill", "gradient"],
  shape: ["shape"],
  text: ["text"],
  "crop-transform": ["crop", "transform", "perspective"]
};
const camel = id => id.replace(/-(\w)/g, (m, c) => c.toUpperCase()) + "Tool";
const A = analyze(src);
const U = A.units;
const label = new Map();                 // unidad → familia | "shared" | "residual"
for (const [fam, ids] of Object.entries(FAMILY)) for (const id of ids) { const u = A.declared.get(camel(id)); if (!u) throw new Error("falta " + camel(id)); label.set(u, fam); }
const referrers = new Map(U.map(u => [u, []]));
for (const u of U) for (const r of u.refs) { const v = A.declared.get(r); if (v && v !== u) referrers.get(v).push(u); }

/* ¿qué sentencias alcanzan las herramientas? */
const reach = new Set();
(function walk(u) { if (reach.has(u)) return; reach.add(u); for (const r of u.refs) { const v = A.declared.get(r); if (v) walk(v); } })(A.declared.get("TOOLS")) ;
const fromTools = new Set();
for (const [u] of label) (function walk(x) { if (fromTools.has(x)) return; fromTools.add(x); for (const r of x.refs) { const v = A.declared.get(r); if (v) walk(v); } })(u);

const CURRENT_NAMES = ["toolList", "registerTools", "current", "chosen", "toolChosen", "STROKE_TOOLS", "setTool", "forceDiscard", "cancelPendingTool"];
for (const nm of CURRENT_NAMES) { const u = A.declared.get(nm); if (!u) throw new Error("falta " + nm); label.set(u, "tool-current"); }
const home = new Map(label);
const decide = S => {
  const set = new Set(S);
  if (set.size === 1) return [...set][0];
  if (set.has("tool-current")) return "tool-current";
  const fams = [...set].filter(x => x !== "residual" && x !== "shared" && x !== "tool-current");
  if (set.has("shared") || fams.length >= 2) return "shared";
  return fams[0] || "residual";           // {familia, residual} → la familia (el registro la importa)
};
/* fijar variables de módulo y todo lo que las asigna en la misma familia */
const pins = new Map();
for (let round = 0; round < 40; round++) {
  let changed = false;
  for (const u of U) {
    if (label.has(u) || !fromTools.has(u)) continue;
    const refs = referrers.get(u).map(r => home.get(r) ?? (fromTools.has(r) ? null : "residual"));
    if (refs.some(x => x === null)) continue;           // aún hay referentes sin decidir
    let h = refs.length ? decide(refs) : "residual";
    if (pins.has(u)) h = pins.get(u);
    if (home.get(u) !== h) { home.set(u, h); changed = true; }
  }
  /* variables `let` y quienes las asignan */
  for (const L of U.filter(x => x.isLet)) {
    const hl = home.get(L) ?? "residual";
    const assigners = U.filter(x => x !== L && L.names.some(n => x.assigns.has(n)));
    const hs = new Set([hl, ...assigners.map(a => home.get(a) ?? "residual")]);
    const fams = [...hs].filter(x => x !== "residual");
    if (hs.size > 1 && fams.length === 1) {
      const f = fams[0];
      for (const x of [L, ...assigners]) if ((home.get(x) ?? "residual") !== f && !label.has(x)) { pins.set(x, f); home.set(x, f); changed = true; }
    } else if (fams.length > 1) throw new Error(`«${L.names[0]}» se asigna desde familias distintas: ${fams.join(", ")}`);
  }
  if (!changed) break;
}
/* referentes aún sin decidir (ciclos de recursión): a «shared» si hace falta */
for (const u of U) if (fromTools.has(u) && !home.has(u)) { const known = referrers.get(u).map(r => home.get(r)).filter(Boolean); home.set(u, known.length ? decide(known) : "residual"); }

/* diagnóstico: variables de módulo (let) y dónde se asignan */
console.log("variables de módulo (let):");
for (const L of U.filter(x => x.isLet)) {
  const as = U.filter(x => x !== L && L.names.some(n => x.assigns.has(n))).map(x => (x.names[0] || "·") + "@" + (home.get(x) ?? "residual"));
  console.log("  " + L.names.join(",").padEnd(16) + " en " + String(home.get(L) ?? "residual").padEnd(14) + " asignada en: " + as.join(", "));
}
/* diagnóstico: sentencias sin nombre (los on(...) y similares) y su destino; el orden de registro de manejadores del
   mismo evento no debe cambiar al repartirlas */
console.log("\nsentencias sin nombre y su destino:");
for (const u of U.filter(x => x.names.length === 0)) console.log("  línea " + String(u.line).padStart(5) + "  " + String(home.get(u) ?? "residual").padEnd(14) + " " + A.src.slice(u.start, u.start + 70).replace(/\s+/g, " "));
const members = new Map();
for (const u of U) { const h = home.get(u) ?? "residual"; if (h === "residual") continue; if (!members.has(h)) members.set(h, []); members.get(h).push(u); }
const HEADERS = {
  "tool-current": "La herramienta activa y cómo se cambia (setTool). Recibe la lista de herramientas con registerTools al arrancar, para que las herramientas puedan llamar a setTool sin importar el registro.",
  shared: "Piezas que usan varias familias de herramientas: icono, estado compartido y ayudas de pincel y selección.",
  navigation: "Herramientas de vista y comparación: Mano, Lupa, Cuentagotas y Comparar antes/después.",
  "move-liquify": "Mover, Licuar y Mover según contenido (comparten el aviso «selfCommit»).",
  select: "Herramientas de selección (rectángulo, elipse, lazo, varita) y Pluma.",
  paint: "Herramientas de pincel: pincel, borrador, difuminar, exposición, dodge/burn y pincel de historial.",
  retouch: "Retoque: clonar y corrector.",
  "fill-gradient": "Relleno y degradado.",
  shape: "Herramienta de formas.",
  text: "Herramienta de texto y sus estilos.",
  "crop-transform": "Recortar, Transformación libre y Perspectiva."
};
const groups = [...members].map(([fam, us]) => ({
  file: fam === "tool-current" ? "tool-current.js" : `defs/${fam}.js`, names: us.flatMap(u => u.names),
  /* sentencias sin nombre (p. ej. on("doc:change", …)): se identifican por su línea, que es la misma en el análisis del divisor */
  select: (lines => u => u.names.length === 0 && lines.has(u.line))(new Set(us.filter(x => x.names.length === 0).map(x => x.line))),
  header: `/* ═══════════════════════════════════════════════════════════════\n   HERRAMIENTAS · ${HEADERS[fam] || fam}\n   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).\n   ═══════════════════════════════════════════════════════════════ */`
}));
console.log("\nreparto:");
for (const g of groups) console.log(`  ${g.file.padEnd(28)} ${g.names.length} bindings`);
console.log(`  (tools.js conserva ${U.filter(u => (home.get(u) ?? "residual") === "residual").length} sentencias)`);

const res = splitFile(root, FILE, groups, { dry: DRY, src });
for (const f of res.files) console.log(`  ${f.file.padEnd(46)} ${String(f.lines).padStart(5)} líneas`);
console.log(DRY ? "[simulación] no se ha escrito nada" : "escrito");
