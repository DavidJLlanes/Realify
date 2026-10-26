/* FASE 3 · js/main.js (1.493 líneas) → js/app/*.
   main.js se queda con lo que de verdad es «arranque»: imports, el espacio de color y la secuencia de inicio.
   Sin cambiar lógica (texto copiado tal cual):
     1. El bloque registerAll({…}) de unas 870 líneas se reparte en un registerAll por dominio (file, edit, image,
        layer, selection, view, tools, ai, filter, adjust, analysis, help), cada uno en js/app/commands/<dominio>.js.
        Los ids de comando no cambian. Si un mismo id aparece en dos grupos se aborta (cambiaría cuál gana).
     2. Atajos de teclado, barra de herramientas, gestos del lienzo y barra de estado pasan a js/app/*.js.
     3. main.js sigue importando TODO lo que importaba, en el mismo orden (los imports que ya no usa quedan como
        «import "ruta";»), y después los módulos nuevos en el orden en que antes se ejecutaban sus sentencias: así el
        orden de arranque no cambia.
     node tools/migrate/phase3-main.mjs [--dry]            (necesita PW_CORE con acorn) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, parse, splitFile } from "./lib/splitter.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!/realify - mejorado$/i.test(root.replace(/\\/g, "/"))) throw new Error("Debe ejecutarse sobre «Realify - Mejorado»");
const DRY = process.argv.includes("--dry");
const FILE = "js/main.js";
let src = fs.readFileSync(path.join(root, FILE), "utf8");
if (!src.includes("registerAll({")) { console.log("main.js: ya dividido"); process.exit(0); }

/* ── 1 · registerAll por dominios ── */
const GROUP_OF = {
  file: "file", actions: "file",
  edit: "edit", snapshot: "edit", historyBrush: "edit",
  image: "image",
  layer: "layer", text: "layer",
  view: "view",
  sel: "selection", sky: "selection",
  crop: "tools", perspective: "tools", transform: "tools", pen: "tools", clone: "tools", liquify: "tools",
  compare: "tools", dodgeburn: "tools", brush: "tools", tool: "tools",
  ai: "ai", filter: "filter", adj: "adjust", an: "analysis", help: "help"
};
const ast = parse(src);
const stmt = ast.body.find(n => n.type === "ExpressionStatement" && n.expression.type === "CallExpression" && n.expression.callee.name === "registerAll");
const obj = stmt.expression.arguments[0];
const keyOf = p => p.key.type === "Literal" ? String(p.key.value) : p.key.name;
const byGroup = new Map(), seen = new Map();
let cursor = obj.start + 1;
for (const p of obj.properties) {
  const k = keyOf(p), g = GROUP_OF[k.split(".")[0]];
  if (!g) throw new Error("Prefijo sin grupo: " + k);
  if (seen.has(k)) throw new Error("Id repetido en registerAll: " + k);
  seen.set(k, g);
  const lead = src.slice(cursor, p.start).replace(/^[\s,]*/, "");
  const text = (lead.trim() ? lead.replace(/\s+$/, "") + "\n  " : "") + src.slice(p.start, p.end);
  if (!byGroup.has(g)) byGroup.set(g, []);
  byGroup.get(g).push(text);
  cursor = p.end;
}
const tail = src.slice(cursor, obj.end - 1).replace(/^[\s,]*/, "");   // comentarios tras el último elemento
const stmts = [...byGroup].map(([g, props], i) => `registerAll({\n  ${props.join(",\n  ")}${i === byGroup.size - 1 && tail.trim() ? "\n  " + tail.trim() : ""}\n});`);
src = src.slice(0, stmt.start) + stmts.join("\n\n") + src.slice(stmt.end);
console.log(`registerAll: ${seen.size} ids en ${byGroup.size} grupos (${[...byGroup].map(([g, p]) => g + ":" + p.length).join(", ")})`);

/* ── 2 · reparto ── */
const A = analyze(src);
const head = u => src.slice(u.start, u.end);
const regGroupOf = u => { const m = /^registerAll\(\{\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/.*\n\s*)*"([^".]+)/.exec(head(u)); return m ? GROUP_OF[m[1]] : null; };
const names = (...n) => u => u.names.some(x => n.includes(x));
const isKeydown = u => /^addEventListener\("keydown"/.test(head(u).trim());
const isBind = u => /^bind\(/.test(head(u).trim());
const call = rx => u => rx.test(head(u).trim());

const groups = [];
const add = (file, header, select, extra = {}) => groups.push({ file, header: `/* ═══════════════════════════════════════════════════════════════\n   ${header}\n   Parte de js/main.js (el arranque), que importa este módulo.\n   ═══════════════════════════════════════════════════════════════ */`, select, ...extra });

add("app/dom.js", "APP · elementos del DOM que usan varios módulos del arranque", names("stage", "empty", "panels"));
add("app/commands/helpers.js", "APP · ayudas comunes de los comandos: cuándo están activos, herramientas fotográficas y «Documento nuevo»", names("needsDoc", "maskInFocus", "selOrActive", "needsSelOrActive", "photoTool", "newDialog"));
for (const g of byGroup.keys()) add(`app/commands/${g}.js`, `APP · comandos de ${({ file: "Archivo", edit: "Edición", image: "Imagen", layer: "Capa y texto", selection: "Selección y cielo", view: "Vista", tools: "herramientas del lienzo", ai: "IA", filter: "Filtros", adjust: "Ajustes", analysis: "Análisis y metadatos", help: "Ayuda" })[g] || g}`, u => regGroupOf(u) === g);
add("app/shortcuts.js", "APP · atajos de teclado: combinaciones, letras de herramienta, tamaño y opacidad del pincel, flechas",
  u => isBind(u) || isKeydown(u) || names("opacityBuffer", "opacityTimer", "NUDGE")(u));
add("app/toolbar.js", "APP · barra de herramientas del escritorio (grupos, menú emergente y pulsación larga)",
  u => names("buildTools")(u) || call(/^on\("tool:change"/)(u));
add("app/statusbar.js", "APP · barra de estado, píldora de zoom y botón de comparar",
  u => names("stZoom", "stSize", "stLayer", "stPos", "zoomPillLvl", "updatePos", "syncStatus", "compareFab", "syncCompareFab")(u) ||
       call(/^on\("(view:change|doc:change|doc:structure|doc:active|history:change|cmd:done|history:lost)"/)(u) || call(/^compareFab\./)(u) ||
       call(/^syncCompareFab\(\)/)(u) || call(/^document\.getElementById\("zoomCell"\)/)(u));
add("app/canvas-input.js", "APP · gestos sobre el lienzo: trazos, pellizco, redimensionar el pincel, autodesplazamiento y doble clic",
  u => names("drawing", "brushResize", "autoScrollReq", "lastClientPos", "stopAutoScroll", "autoScrollTick", "endStroke")(u) ||
       call(/^on\("view:gesturestart"/)(u) || call(/^stage\.addEventListener/)(u));

/* Orden en que se ejecutaban las sentencias (y por tanto el de los import): comandos → atajos → barra → gestos → estado */
const ORDER = ["app/dom.js", "app/commands/helpers.js", ...[...byGroup.keys()].map(g => `app/commands/${g}.js`), "app/shortcuts.js", "app/toolbar.js", "app/canvas-input.js", "app/statusbar.js"];
groups.sort((a, b) => ORDER.indexOf(a.file) - ORDER.indexOf(b.file));

/* qué sentencias quedan en main.js, para repasarlas */
const taken = new Set();
for (const g of groups) for (const u of A.units) if (g.select(u)) { if (taken.has(u)) throw new Error("Sentencia en dos grupos, línea " + u.line + ": " + head(u).slice(0, 60)); taken.add(u); }
console.log("\nse quedan en main.js:");
for (const u of A.units) if (!taken.has(u)) console.log("  línea " + String(u.line).padStart(5) + "  " + head(u).replace(/\s+/g, " ").slice(0, 80));

const res = splitFile(root, FILE, groups, { dry: DRY, src, importAllGroups: true });
console.log("\narchivos:");
for (const f of res.files.sort((a, b) => a.file.localeCompare(b.file))) console.log(`  ${f.file.padEnd(40)} ${String(f.lines).padStart(5)} líneas`);
console.log(DRY ? "[simulación] no se ha escrito nada" : "escrito");
