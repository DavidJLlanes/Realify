/* FASE 3 · divide por bloques independientes los archivos grandes que tienen estructura repartible.
   Para cada archivo: autoPlan agrupa sus sentencias en bloques que no se usan entre sí; splitFile los mueve tal cual a
   <carpeta>/<archivo>/<bloque>.js y deja el original como fachada con la misma API. Si el reparto crea ciclos o
   asignaciones de variables de módulo entre archivos, se aborta SIN escribir nada de ese archivo.
     node tools/migrate/phase3-auto.mjs [--dry] [archivo…]            (necesita PW_CORE con acorn) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitFile } from "./lib/splitter.mjs";
import { autoPlan } from "./lib/autoplan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!/realify - mejorado$/i.test(root.replace(/\\/g, "/"))) throw new Error("Debe ejecutarse sobre «Realify - Mejorado»");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");

/* archivo → tamaño mínimo (líneas) de un bloque para tener archivo propio */
const TARGETS = {
  "js/editor/adjust/adjustments.js": { minLines: 100, rename: { brightnessContrast: "brightness-contrast", levels: "levels", curves: "curves", whiteBalance: "white-balance", grayscale: "grayscale" } },
  "js/editor/tools/transformtool.js": { minLines: 120, rename: { PROXY_MAX: "session", xformMove: "drag" } },
  "plugins/hdr/engine.js": { minLines: 100, rename: { grayOf: "align", fuseMertens: "fusion" } },
  "js/io/meta/metadata.js": { minLines: 120, rename: { parseTiff: "read", IFD0_CLASS: "build-exif", app1Exif: "inject" } },
  "js/filters/library/basic.js": { minLines: 80, rename: { premiumSharpenWorker: "sharpen", guidedBase: "clarity", VIGNETTE_STOPS: "vignette", noise: "noise" } },
  "js/features/photo-tools.js": { minLines: 100, rename: { settingsDialog: "remove-background", portraitPixels: "portrait" } },
  "js/editor/render/floatcompositor.js": { minLines: 150, rename: { COARSE: "compose", FS_BLEND: "blend-shader" } }
};
const only = args.filter(a => !a.startsWith("--"));
const todo = Object.entries(TARGETS).filter(([f]) => !only.length || only.includes(f));

let failed = 0;
for (const [file, { minLines, rename }] of todo) {
  const src = fs.readFileSync(path.join(root, file), "utf8");
  const dirName = path.posix.join(path.posix.dirname(file), path.posix.basename(file, ".js"));
  if (fs.existsSync(path.join(root, dirName))) { console.log(`\n${file}: ya dividido`); continue; }
  console.log(`\n${file} (${src.split("\n").length} líneas)`);
  try {
    const plan = autoPlan(src, { file, minLines, rename });
    if (plan.groups.length < 2 && !plan.groups.some(g => g.lines >= minLines)) { console.log("  sin bloques repartibles: se deja como está"); continue; }
    for (const g of plan.groups) console.log(`   ${g.file.padEnd(46)} ${String(g.lines).padStart(4)} líneas  [${g.names.slice(0, 9).join(", ")}${g.names.length > 9 ? ", …+" + (g.names.length - 9) : ""}]`);
    console.log(`   (queda en el original: ${plan.residualLines} líneas de ${plan.total})`);
    const res = splitFile(root, file, plan.groups, { dry: DRY });
    for (const f of res.files.filter(x => x.file === file)) console.log(`   → ${file}: ${f.lines} líneas${DRY ? " [simulación]" : ""}`);
  } catch (e) {
    failed++;
    console.log("   NO SE DIVIDE: " + e.message.split("\n").slice(0, 3).join(" | "));
  }
}
process.exit(failed ? 1 : 0);
