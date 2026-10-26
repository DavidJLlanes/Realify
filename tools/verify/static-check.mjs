/* Comprobación estática de un proyecto Realify (solo lectura).
     node static-check.mjs <raíz> <salida.json>
   Genera la «huella» estática: referencias rotas, ciclos, exports por módulo, ids de comando candidatos,
   claves de almacenamiento y dependencias entre carpetas. Ver README.md. */
import fs from "node:fs";
import path from "node:path";
import { collectRefs, exportsOf, commandCandidates, storageKeys, cycles, walk, rel } from "./lib/scan.mjs";

const [root, outFile] = [process.argv[2], process.argv[3]];
if (!root || !outFile) { console.error("uso: node static-check.mjs <raíz> <salida.json>"); process.exit(2); }

const refs = collectRefs(root);
const broken = [], softMissing = [];
const exists = r => { try { return fs.statSync(path.join(root, r)).isFile(); } catch { return false; } };
/* Un `new URL("../../assets/models/", import.meta.url)` apunta a una carpeta, no a un archivo. */
const existsAny = (r, spec) => exists(r) || (/\/$/.test(spec) && (() => { try { return fs.statSync(path.join(root, r)).isDirectory(); } catch { return false; } })());
const graph = new Map();
let nonLiteralDynamic = 0;

for (const [file, { hard, soft }] of refs) {
  const staticSet = new Set();
  for (const h of hard) {
    if (!existsAny(h.target, h.spec)) broken.push({ file, spec: h.spec, kind: h.kind, target: h.target });
    if (h.kind === "static" && /\.m?js$/.test(h.target)) staticSet.add(h.target);
  }
  for (const s of soft) if (!exists(s.target)) softMissing.push({ file, spec: s.spec, target: s.target });
  if (/\.m?js$/.test(file)) graph.set(file, staticSet);
}
for (const f of walk(root, { exts: new Set([".js", ".mjs"]) })) {
  const r = rel(root, f); if (r.startsWith("js/vendor/")) continue;
  const m = fs.readFileSync(f, "utf8").match(/import\(\s*(?!['"])[^)]/g); if (m) nonLiteralDynamic += m.length;
}

const exportsByFile = {};
for (const f of walk(root, { exts: new Set([".js", ".mjs"]) })) {
  const r = rel(root, f);
  if (r.startsWith("js/vendor/") || r.startsWith("tests/") || r.includes("/tests/")) continue;
  const e = exportsOf(fs.readFileSync(f, "utf8"));
  if (e.length) exportsByFile[r] = e;
}

/* Dependencias entre carpetas de primer nivel (js/<x> cuenta como carpeta propia). */
const top = p => (p.startsWith("js/") ? p.split("/").slice(0, 2).join("/") : p.split("/")[0]);
const dirEdges = {};
for (const [file, { hard }] of refs) {
  if (!/\.m?js$/.test(file) || file.startsWith("tests/") || file.includes("/tests/")) continue;
  for (const h of hard) {
    if (!/\.m?js$/.test(h.target)) continue;
    const a = top(file), b = top(h.target);
    if (a !== b) { const k = a + " -> " + b; dirEdges[k] = (dirEdges[k] || 0) + 1; }
  }
}

const jsFiles = walk(root, { exts: new Set([".js", ".mjs"]) }).map(f => rel(root, f)).filter(r => !r.startsWith("js/vendor/"));
const lines = jsFiles.reduce((a, r) => a + fs.readFileSync(path.join(root, r), "utf8").split("\n").length, 0);

const result = {
  generated: new Date().toISOString(),
  root: path.resolve(root),
  jsFiles: jsFiles.length, jsLines: lines,
  brokenRefs: broken, softMissing, nonLiteralDynamicImports: nonLiteralDynamic,
  staticCycles: cycles(graph),
  storage: storageKeys(root),
  commandCandidates: commandCandidates(root),
  exportsByFile,
  dirEdges: Object.fromEntries(Object.entries(dirEdges).sort((a, b) => b[1] - a[1]))
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
console.log(`archivos JS: ${result.jsFiles} · líneas: ${result.jsLines}`);
console.log(`referencias rotas: ${broken.length} · soft sin resolver: ${softMissing.length} · ciclos estáticos: ${result.staticCycles.length}`);
console.log(`ids candidatos: ${result.commandCandidates.length} · módulos con exports: ${Object.keys(exportsByFile).length}`);
for (const b of broken.slice(0, 40)) console.log("  ROTA:", b.file, "→", b.spec, `(${b.kind})`);
