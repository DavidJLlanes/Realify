/* FASE 6 · documentación.
   El README tenía 74 KB: la ficha del proyecto (qué es, novedades, estructura, pruebas, despliegue, licencia) mezclada con
   la referencia completa de cada función (secciones 1 a 16) y con una guía de panorámicas duplicada de la de server/panorama.
     · Las secciones 1-16 y «Cómo se calculan las combinaciones» pasan, tal cual, a docs/FUNCIONALIDADES.md.
     · La guía de panorámicas del README (idéntica a server/panorama/README.md) se sustituye por un enlace.
     · Todos los enlaces y anclas afectados se reescriben; tools/verify/docs-links.mjs comprueba que no quede ninguno roto.
     · Se corrigen tres enlaces de docs/CONTRIBUTING.md que la fase 1 dejó apuntando a docs/ estando ya dentro de docs/.
     node tools/migrate/phase6-docs.mjs            Idempotente. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!/realify - mejorado$/i.test(root.replace(/\\/g, "/"))) throw new Error("Debe ejecutarse sobre «Realify - Mejorado»");
const P = p => path.join(root, p);
const slug = t => t.trim().toLowerCase().replace(/<[^>]*>/g, "").replace(/[`*~]/g, "").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
const slugsOf = text => { const out = new Set(); let inCode = false; for (const l of text.split("\n")) { if (/^\s*```/.test(l)) { inCode = !inCode; continue; } if (inCode) continue; const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(l); if (m) out.add(slug(m[1])); } return out; };

/* corrección de CONTRIBUTING (siempre, es independiente) */
{
  const f = "docs/CONTRIBUTING.md"; let s = fs.readFileSync(P(f), "utf8");
  const n = s.replace(/\]\(docs\/(CODE_OF_CONDUCT|SECURITY|CHANGELOG)\.md\)/g, "]($1.md)");
  if (n !== s) { fs.writeFileSync(P(f), n); console.log("CONTRIBUTING.md: enlaces corregidos"); }
}

if (fs.existsSync(P("docs/FUNCIONALIDADES.md"))) { console.log("README: ya dividido"); process.exit(0); }

let readme = fs.readFileSync(P("README.md"), "utf8");
const iCombos = readme.indexOf("## Cómo se calculan las combinaciones");
const iSec17 = readme.indexOf("## 17. Estructura del proyecto");
if (iCombos < 0 || iSec17 < 0 || iSec17 < iCombos) throw new Error("No encuentro los límites de las secciones del README");
let moved = readme.slice(iCombos, iSec17).replace(/\s+$/, "") + "\n";
let rest = readme.slice(0, iCombos) + readme.slice(iSec17);

/* guía de panorámicas duplicada → enlace */
const a = rest.indexOf("### Servicio de panorámicas (opcional)"), b = rest.indexOf("## 20. Tecnología");
if (a > 0 && b > a) rest = rest.slice(0, a) + "### Servicio de panorámicas (opcional)\n\nLas panorámicas de Realify se unen con un pequeño servicio en Python (FastAPI + OpenCV Stitcher) que corre en tu propio\nservidor. La guía paso a paso, con la configuración de nginx y la solución de problemas, está en\n[`server/panorama/README.md`](server/panorama/README.md).\n\n" + rest.slice(b);

const movedSlugs = slugsOf(moved), restSlugs = slugsOf(rest);
const fuzzy = (s, set) => { const key = s.split("--")[0]; const c = [...set].filter(x => x.startsWith(key)); return c.length === 1 ? c[0] : null; };

/* README: los enlaces a lo que se movió */
let fixes = [];
rest = rest.replace(/\]\(#([^)]+)\)/g, (m, s) => {
  if (movedSlugs.has(s)) return `](docs/FUNCIONALIDADES.md#${s})`;
  if (restSlugs.has(s)) return m;
  const f = fuzzy(s, movedSlugs); if (f) { fixes.push(`${s} → ${f}`); return `](docs/FUNCIONALIDADES.md#${f})`; }
  const g = fuzzy(s, restSlugs); if (g) { fixes.push(`${s} → ${g}`); return `](#${g})`; }
  return m;
});
/* una nota junto al índice */
rest = rest.replace("## Índice\n", "## Índice\n\nLa referencia detallada de cada función está en **[docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md)**; el resto de este\ndocumento describe el proyecto: estructura, pruebas, despliegue, tecnología y licencia.\n");

/* docs/FUNCIONALIDADES.md: enlaces a lo que se quedó en el README y rutas relativas desde docs/ */
const relFromDocs = dest => /^(https?:|mailto:|#|data:|\.\.\/\.\.)/.test(dest) ? dest : dest.startsWith("docs/") ? dest.slice(5) : "../" + dest;
moved = moved.replace(/\]\(([^)\s]+)\)/g, (m, dest) => {
  if (dest.startsWith("#")) {
    const s = dest.slice(1);
    if (movedSlugs.has(s)) return m;
    if (restSlugs.has(s)) return `](../README.md#${s})`;
    const f = fuzzy(s, movedSlugs); if (f) { fixes.push(`${s} → ${f}`); return `](#${f})`; }
    const g = fuzzy(s, restSlugs); if (g) { fixes.push(`${s} → ${g}`); return `](../README.md#${g})`; }
    return m;
  }
  return `](${relFromDocs(dest)})`;
});
moved = moved.replace(/\b(src|href)="((?!https?:|#|data:)[^"]+)"/g, (m, k, v) => `${k}="${relFromDocs(v)}"`);

const head = `# Realify · referencia de funciones

Todo lo que hace Realify, sección por sección. La ficha del proyecto (qué es, novedades, estructura del código, pruebas,
despliegue, tecnología y licencia) está en el [README](../README.md).

`;
fs.writeFileSync(P("docs/FUNCIONALIDADES.md"), head + moved);
fs.writeFileSync(P("README.md"), rest);
console.log(`README: ${(readme.length / 1024) | 0} KB → ${(rest.length / 1024) | 0} KB · docs/FUNCIONALIDADES.md: ${(moved.length / 1024) | 0} KB`);
for (const f of fixes) console.log("  ancla corregida:", f);
