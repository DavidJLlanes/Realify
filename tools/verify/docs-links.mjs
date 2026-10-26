/* Comprueba los enlaces de los archivos Markdown del proyecto:
     node tools/verify/docs-links.mjs [raíz]
   Para cada enlace [texto](destino): que el archivo exista y, si lleva ancla (#…), que exista un título con ese ancla
   (con el mismo criterio de GitHub: minúsculas, sin signos, espacios → guiones). Ignora http(s), mailto y datos.
   No mira los CHANGELOG/PENDIENTE históricos. Código de salida 1 si hay enlaces rotos. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { walk, rel } from "./lib/scan.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, "..", ".."));
export const slug = t => t.trim().toLowerCase().replace(/<[^>]*>/g, "").replace(/[`*_~]/g, c => c === "_" ? "_" : "").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");

const mds = walk(root, { exts: new Set([".md"]), skipBulk: true }).map(f => rel(root, f))
  .filter(r => !/(^|\/)(CHANGELOG|PENDIENTE)\.md$/.test(r) && !r.startsWith("node_modules/") && !r.startsWith("tools/verify/baseline/"));
const anchors = new Map();
const anchorsOf = f => {
  if (anchors.has(f)) return anchors.get(f);
  const set = new Set(), seen = {};
  let inCode = false;
  for (const line of fs.readFileSync(path.join(root, f), "utf8").split("\n")) {
    if (/^\s*```/.test(line)) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    let s = slug(m[1]);
    if (seen[s] !== undefined) { seen[s]++; s += "-" + seen[s]; } else seen[s] = 0;
    set.add(s);
  }
  anchors.set(f, set); return set;
};
let bad = 0, total = 0;
for (const f of mds) {
  const src = fs.readFileSync(path.join(root, f), "utf8").replace(/```[\s\S]*?```/g, m => m.replace(/[^\n]/g, " "));
  const re = /\]\(([^)\s]+)\)/g; let m;
  while ((m = re.exec(src))) {
    const dest = m[1]; if (/^(https?:|mailto:|data:|tel:)/.test(dest)) continue;
    total++;
    if (/^\.\.\/\.\.\/(issues|pulls|discussions)/.test(dest)) continue;   // enlaces relativos de GitHub (no son archivos)
    const [p, frag] = dest.split("#");
    const target = p ? path.posix.normalize(path.posix.join(path.posix.dirname(f), decodeURIComponent(p))) : f;
    const line = src.slice(0, m.index).split("\n").length;
    if (p && !fs.existsSync(path.join(root, target))) { bad++; console.log(`  ${f}:${line}  archivo inexistente: ${dest}`); continue; }
    if (frag && /\.md$/.test(target) && !anchorsOf(target).has(decodeURIComponent(frag).toLowerCase())) { bad++; console.log(`  ${f}:${line}  ancla inexistente: ${dest}`); }
  }
}
console.log(`${mds.length} archivos Markdown · ${total} enlaces · ${bad ? bad + " ROTOS" : "todos válidos"}`);
process.exit(bad ? 1 : 0);
