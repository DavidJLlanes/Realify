/* Comprueba que dividir un módulo no perdió, duplicó ni alteró código:
     PW_CORE=<dir con acorn> node units-equal.mjs <original.js> <nuevo1.js> [<nuevo2.js> …]
   Compara las sentencias de primer nivel (salvo imports y reexportaciones) del original con las de los archivos
   nuevos, ignorando solo el «export » que el divisor añade, las diferencias de espacios y las rutas relativas («./x», «../x»),
   que cambian al llevar el código a una carpeta más profunda (rewriteLiteral/moveRel del divisor). Deben coincidir una a una. */
import fs from "node:fs";
import { analyze } from "../migrate/lib/splitter.mjs";

const [orig, ...parts] = process.argv.slice(2);
if (!orig || !parts.length) { console.error("uso: node units-equal.mjs <original.js> <nuevo.js>…"); process.exit(2); }
const norm = (u, src) => src.slice(u.start, u.end)
  .replace(/^export\s+(?=(async\s+)?(function|const|let|var|class)\b)/, "")
  .replace(/(["'`])\.{1,2}\/[^"'`\n\r$]*\1/g, '"§ruta§"')
  .replace(/\s+/g, " ").trim();
const units = f => {
  const src = fs.readFileSync(f, "utf8"), A = analyze(src);
  return A.units.filter(u => !(u.node.type.startsWith("Export") && !u.node.declaration)).map(u => norm(u, src));
};
const a = units(orig), b = parts.flatMap(units);
const count = l => l.reduce((m, x) => (m.set(x, (m.get(x) || 0) + 1), m), new Map());
const ca = count(a), cb = count(b);
let bad = 0;
for (const [k, n] of ca) if ((cb.get(k) || 0) !== n) { bad++; console.log(`  FALTA o repetida (${n} → ${cb.get(k) || 0}): ${k.slice(0, 90)}`); }
for (const [k, n] of cb) if (!ca.has(k)) { bad++; console.log(`  SOBRA: ${k.slice(0, 90)}`); }
console.log(`${orig}: ${a.length} sentencias originales · ${b.length} en los archivos nuevos · ${bad ? bad + " DIFERENCIAS" : "idénticas"}`);
process.exit(bad ? 1 : 0);
