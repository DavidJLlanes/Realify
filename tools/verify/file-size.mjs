/* ═══════════════════════════════════════════════════════════════
   TAMAÑO DE ARCHIVOS NUEVOS (Fase 0 del plan de IA, F0.9)
   Avisa de los archivos de código CREADOS desde que empezó el plan (no toca los antiguos) que se pasan del objetivo:
     · más de 250 líneas  → objetivo superado (informativo)
     · más de 300 líneas  → aviso: dividirlo por etapas (tools/migrate/lib/splitter.mjs)
     · más de 400 líneas  → tope superado
     · index.js de una carpeta de función con más de 40 líneas → aviso (sólo conecta)
   No bloquea (código de salida 0) salvo con --estricto, que falla si algo pasa de 400.
   Uso:  node tools/verify/file-size.mjs [--desde <commit>] [--estricto] [<raíz>]
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const val = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const aqui = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--desde")[0] || path.join(aqui, "..", ".."));
const DESDE = val("--desde") || "1200bea1";      // último commit de la fase P: lo creado después es «nuevo»
const estricto = args.includes("--estricto");

const git = (...a) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8", maxBuffer: 1 << 26 }).split("\n").filter(Boolean);
let nuevos;
try {
  nuevos = [...new Set([...git("log", "--diff-filter=A", "--name-only", "--format=", `${DESDE}..HEAD`), ...git("ls-files", "--others", "--exclude-standard")])];
} catch (e) { console.log("file-size: no se pudo leer git (" + e.message.split("\n")[0] + "); se omite."); process.exit(0); }
nuevos = nuevos.filter(f => /\.(m?js)$/.test(f) && !f.startsWith("js/vendor/") && !f.startsWith("node_modules/") && fs.existsSync(path.join(root, f)));

const lineas = f => fs.readFileSync(path.join(root, f), "utf8").split("\n").length;
const info = [], aviso = [], tope = [];
for (const f of nuevos) {
  const n = lineas(f);
  if (n > 400) tope.push(`${n}  ${f}`); else if (n > 300) aviso.push(`${n}  ${f}`); else if (n > 250) info.push(`${n}  ${f}`);
  if (/^js\/features\/[^/]+\/[^/]+\/index\.js$/.test(f) && n > 40) aviso.push(`${n}  ${f}  (index.js de función: máximo 40, sólo conecta)`);
}
const show = (t, l) => { if (l.length) console.log(`${t} (${l.length}):\n  ` + l.sort((a, b) => parseInt(b) - parseInt(a)).join("\n  ")); };
show("Tope superado (>400)", tope); show("Aviso (>300)", aviso); show("Objetivo superado (>250)", info);
console.log(`${nuevos.length} archivos nuevos revisados desde ${DESDE} · ${tope.length ? "TOPE SUPERADO" : aviso.length ? "avisos" : "OK"}`);
process.exit(estricto && tope.length ? 1 : 0);
