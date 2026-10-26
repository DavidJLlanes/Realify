/* FASE 3 · js/ui/help/guide.js (2.107 líneas) → un archivo por tema de ayuda.
   TOPICS son 20 objetos de datos {id, title, desc, html|sub} sin ninguna dependencia del resto del archivo, así que
   cada uno pasa tal cual a js/ui/help/topics/<id>.js (const <id>Topic) y js/ui/help/topics/index.js los reúne en
   TOPICS, en el mismo orden. guide.js conserva el código de la ventana (openGuide, búsqueda, índice) y la introducción.
     node tools/migrate/phase3-guide.mjs [--dry]            (necesita PW_CORE con acorn) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, parse, splitFile } from "./lib/splitter.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!/realify - mejorado$/i.test(root.replace(/\\/g, "/"))) throw new Error("Debe ejecutarse sobre «Realify - Mejorado»");
const DRY = process.argv.includes("--dry");
const FILE = "js/ui/help/guide.js";
let src = fs.readFileSync(path.join(root, FILE), "utf8");
if (/const TOPICS = \[\s*\w+Topic\b/.test(src) || !/const TOPICS = \[/.test(src)) { console.log("guide.js: ya dividido"); process.exit(0); }

/* una constante por tema */
const ast = parse(src);
const decl = ast.body.find(n => n.type === "VariableDeclaration" && n.declarations[0].id.name === "TOPICS");
const arr = decl.declarations[0].init;
const camel = id => id.replace(/[-_](\w)/g, (m, c) => c.toUpperCase()) + "Topic";
const names = [], ids = [], parts = [];
let cursor = arr.start + 1;
for (const el of arr.elements) {
  const id = el.properties.find(p => p.key.name === "id").value.value;
  const nm = camel(id);
  names.push(nm); ids.push(id);
  const between = src.slice(cursor, el.start).replace(/^[\s,]*/, "");
  parts.push((between.trim() ? between.replace(/\s+$/, "") + "\n" : "") + `const ${nm} = ${src.slice(el.start, el.end)};`);
  cursor = el.end;
}
const lead = src.slice(decl.start, arr.start);          // «const TOPICS = »
src = src.slice(0, decl.start) + parts.join("\n\n") + "\n\n" + lead + "[" + names.join(", ") + "];" + src.slice(decl.end);
console.log(`TOPICS: ${names.length} temas`);

const HEAD = t => `/* ═══════════════════════════════════════════════════════════════\n   GUÍA · tema «${t}»\n   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.\n   ═══════════════════════════════════════════════════════════════ */`;
const groups = ids.map((id, i) => ({ file: `topics/${id}.js`, names: [names[i]], header: HEAD(id) }));
groups.push({ file: "topics/index.js", names: ["TOPICS"], header: `/* ═══════════════════════════════════════════════════════════════\n   GUÍA · lista de temas, en el orden en que aparecen en el índice\n   ═══════════════════════════════════════════════════════════════ */` });

const res = splitFile(root, FILE, groups, { dry: DRY, src });
for (const f of res.files.sort((a, b) => b.lines - a.lines).slice(0, 6)) console.log(`  ${f.file.padEnd(40)} ${String(f.lines).padStart(5)} líneas`);
console.log(`  … ${res.files.length} archivos`);
console.log(DRY ? "[simulación] no se ha escrito nada" : "escrito");
