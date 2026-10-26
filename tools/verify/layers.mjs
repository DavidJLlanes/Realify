/* Comprobador de capas: ningún módulo puede importar (de forma estática) algo de una capa superior.
     node tools/verify/layers.mjs [<raíz>]
   Capas, de abajo a arriba:
     0 · núcleo      js/core/**                      sin dependencias de nada superior
     1 · kit         js/ui/kit/**                    piezas de interfaz reutilizables (diálogo, avisos, shell de plugins…)
     2 · edición     js/{editor,filters,features,io,ai,analysis,exif,lens,cv}/**
     3 · interfaz    js/ui/**                        menús, paneles, barras (lo que no es kit)
     4 · plugins     plugins/**                      herramientas a pantalla completa
     5 · app         js/main.js, js/pwa.js, js/boot-guard.js, js/app/**
   Los import() dinámicos hacia arriba no cuentan como infracción (son carga diferida: un punto de entrada que se abre
   al usarlo, como un plugin), pero se listan aparte para tenerlos a la vista.
   Código de salida: 0 = sin infracciones; 1 = hay imports estáticos hacia arriba. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { walk, rel, stripQuery } from "./lib/scan.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, "..", ".."));

const NAMES = ["núcleo", "kit", "edición", "interfaz", "plugins", "app"];
const EDITING = new Set(["editor", "filters", "features", "io", "ai", "analysis", "exif", "lens", "cv"]);
function layerOf(p) {
  if (p.startsWith("plugins/")) return 4;
  if (!p.startsWith("js/")) return -1;
  const parts = p.split("/");
  if (parts.length === 2) return 5;               // js/main.js, js/pwa.js, js/boot-guard.js
  if (parts[1] === "app") return 5;               // js/app/**: comandos, atajos, barra, gestos y barra de estado
  if (parts[1] === "core") return 0;
  if (parts[1] === "ui") return parts[2] === "kit" ? 1 : 3;
  if (EDITING.has(parts[1])) return 2;
  return -1;
}

const IMP = /(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|(?<![\w.])import\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[;\s])import\s*['"]([^'"]+)['"]/g;
const files = walk(root, { exts: new Set([".js", ".mjs"]) }).map(f => rel(root, f)).filter(r => layerOf(r) >= 0 && !r.startsWith("js/vendor/"));
const fileSet = new Set(files);
const bad = [], lazy = [], unknown = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  let m; IMP.lastIndex = 0;
  while ((m = IMP.exec(src))) {
    const spec = m[1] || m[2] || m[3];
    if (!spec || !spec.startsWith(".")) continue;
    const to = rel(root, path.resolve(path.dirname(path.join(root, f)), stripQuery(spec)));
    if (!fileSet.has(to)) continue;
    const a = layerOf(f), b = layerOf(to);
    if (b <= a) continue;
    (m[2] ? lazy : bad).push(`${f} (${NAMES[a]}) → ${to} (${NAMES[b]})`);
  }
}
for (const f of files) if (layerOf(f) < 0) unknown.push(f);

const uniq = a => [...new Set(a)];
if (lazy.length) {
  console.log(`import() dinámicos hacia una capa superior (informativo, ${uniq(lazy).length}):`);
  const byPair = {};
  for (const l of uniq(lazy)) { const k = l.replace(/^[^(]*\(([^)]*)\) → [^(]*\(([^)]*)\)$/, "$1 → $2"); byPair[k] = (byPair[k] || 0) + 1; }
  for (const [k, v] of Object.entries(byPair).sort((a, b) => b[1] - a[1])) console.log(`   ${String(v).padStart(3)}  ${k}`);
}
if (bad.length) {
  console.log(`\nINFRACCIONES (import estático hacia una capa superior): ${uniq(bad).length}`);
  for (const b of uniq(bad)) console.log("  " + b);
  process.exit(1);
}
console.log(`\nCAPAS OK: ${files.length} módulos revisados, ninguna dependencia estática hacia arriba.`);
