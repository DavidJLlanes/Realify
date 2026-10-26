/* FASE 2 · paso previo: romper los 2 ciclos de imports con la mínima edición posible.
   No cambia ninguna función: el código se MUEVE tal cual a un módulo nuevo y el módulo original sigue exportando
   los mismos nombres (reexporta), así que nadie que ya lo importe nota nada.
     1. editor/adjustlayers.js ↔ editor/layertree.js
        La lógica de «qué hace cada tipo de capa de ajuste» (ADJUST_TYPES, applyAdjustLayer, isAdjustLayer…) pasa a
        editor/adjust-types.js; adjustlayers.js (que tiene el panel de edición y usa flatten) la reexporta.
     2. plugins/vintage/overlays.js ↔ plugins/vintage/frames.js
        El generador `rng` pasa a plugins/vintage/rng.js; overlays.js lo reexporta.
   Idempotente: si ya está hecho, no hace nada.  Uso: node tools/migrate/phase2-edits.mjs

   NOTA (corregido a mano después de la fase 2): la detección de qué imports necesita el módulo nuevo no contaba la
   propagación `...BC_DEFAULTS` como uso (descartaba los nombres precedidos de un punto), así que adjust-types.js
   quedó sin importar BC_DEFAULTS. Lo encontró tools/verify/lint-refs.mjs; el import ya está añadido. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!/realify - mejorado$/i.test(root.replace(/\\/g, "/"))) throw new Error("Debe ejecutarse sobre «Realify - Mejorado»: " + root);
const P = p => path.join(root, p);
const read = p => fs.readFileSync(P(p), "utf8");
const write = (p, s) => fs.writeFileSync(P(p), s);

/* ── 1 · adjust-types ─────────────────────────────────────────── */
(function adjustTypes() {
  if (fs.existsSync(P("js/editor/adjust-types.js"))) { console.log("adjust-types: ya hecho"); return; }
  let src = read("js/editor/adjustlayers.js");
  const start = src.indexOf("function grayscaleApply(data){");
  const fnStart = src.indexOf("export function applyAdjustLayer(");
  const fnEnd = src.indexOf("\n}\n", fnStart) + 3;
  if (start < 0 || fnStart < 0 || fnEnd < 3) throw new Error("adjustlayers.js: no encuentro el bloque a mover");
  const block = src.slice(start, fnEnd);
  const isAdj = "export const isAdjustLayer = l => !!(l && l.type === \"adjust\");\n";
  if (!src.includes(isAdj)) throw new Error("adjustlayers.js: no encuentro isAdjustLayer");

  /* imports del original: nombre → [origen, orden] */
  const importRe = /^import \{([^}]*)\} from "([^"]+)";\n/gm;
  const imports = []; let m;
  while ((m = importRe.exec(src))) imports.push({ full: m[0], names: m[1].split(",").map(s => s.trim()).filter(Boolean), from: m[2] });

  const rest = src.slice(0, start) + src.slice(fnEnd) ;
  const restNoIsAdj = rest.replace(isAdj, "");
  const uses = (text, name) => new RegExp(`(?<![\\w$.])${name.replace("$", "\\$")}(?![\\w$])`).test(text.replace(/^import .*$/gm, ""));
  const keepIn = [], moveTo = [];
  for (const im of imports) {
    const toNew = im.names.filter(n => uses(block + isAdj, n.split(/\s+as\s+/).pop()));
    const toOld = im.names.filter(n => uses(restNoIsAdj, n.split(/\s+as\s+/).pop()));
    if (toNew.length) moveTo.push({ from: im.from, names: toNew });
    keepIn.push({ ...im, names: toOld });
  }

  const header = `/* ═══════════════════════════════════════════════════════════════
   CAPAS DE AJUSTE · QUÉ HACE CADA TIPO
   Los tipos de capa de ajuste (brillo, niveles, curvas…), sus parámetros por defecto, cómo pasan de parámetros a
   píxeles y la comprobación «¿esto es una capa de ajuste?». Es la parte que también necesitan el árbol de capas
   (layertree.js), el compositor, la exportación de alta precisión y el compositor en coma flotante; el panel de
   edición y la creación de capas siguen en adjustlayers.js, que reexporta todo esto.

   Separado de adjustlayers.js para que layertree.js ↔ adjustlayers.js dejen de importarse el uno al otro.
   ═══════════════════════════════════════════════════════════════ */

`;
  const newImports = moveTo.map(i => `import { ${i.names.join(", ")} } from "${i.from}";\n`).join("");
  write("js/editor/adjust-types.js", header + newImports + "\n" + block + "\n" + isAdj);

  /* original: sin el bloque, con imports recortados y con la reexportación */
  let out = src;
  out = out.slice(0, start) + out.slice(fnEnd).replace(/^\n/, "");
  out = out.replace(isAdj, "");
  for (const im of keepIn) {
    const rep = im.names.length ? `import { ${im.names.join(", ")} } from "${im.from}";\n` : "";
    out = out.replace(im.full, rep);
  }
  const used = ["ADJUST_TYPES", "exposureFunction", "adjustTypeIds", "adjustTypeName", "applyAdjustLayer", "isAdjustLayer"];
  const local = used.filter(n => uses(out, n));
  const reexp = `import { ${local.join(", ")} } from "./adjust-types.js";\nexport { ${used.join(", ")} } from "./adjust-types.js";\n`;
  const lastImport = [...out.matchAll(/^import .*\n/gm)].pop();
  const at = lastImport.index + lastImport[0].length;
  out = out.slice(0, at) + reexp + out.slice(at);
  write("js/editor/adjustlayers.js", out);
  console.log(`adjust-types: hecho (${block.split("\n").length} líneas movidas; imports nuevos: ${moveTo.map(i => i.names.length).reduce((a, b) => a + b, 0)})`);
})();

/* ── 2 · rng del Filtro Vintage ──────────────────────────────── */
(function rng() {
  if (fs.existsSync(P("plugins/vintage/rng.js"))) { console.log("rng: ya hecho"); return; }
  let ov = read("plugins/vintage/overlays.js");
  const a = ov.indexOf("/* Generador determinista (mulberry32). */");
  const fnStart = ov.indexOf("export function rng(seed){");
  const fnEnd = ov.indexOf("\n}\n", fnStart) + 3;
  if (a < 0 || fnStart < 0) throw new Error("overlays.js: no encuentro rng");
  const fn = ov.slice(a, fnEnd);
  write("plugins/vintage/rng.js", `/* Generador pseudoaleatorio determinista del Filtro Vintage.
   Aparte de overlays.js y frames.js para que no se importen el uno al otro. */

${fn}`);
  ov = ov.slice(0, a) + `import { rng } from "./rng.js";\nexport { rng };\n` + ov.slice(fnEnd);
  write("plugins/vintage/overlays.js", ov);
  let fr = read("plugins/vintage/frames.js");
  if (!fr.includes('import { rng } from "./overlays.js";')) throw new Error("frames.js: import de rng no encontrado");
  write("plugins/vintage/frames.js", fr.replace('import { rng } from "./overlays.js";', 'import { rng } from "./rng.js";'));
  console.log("rng: hecho");
})();
