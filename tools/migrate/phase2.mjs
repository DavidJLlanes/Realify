/* FASE 2 · capas y estructura interna de js/.
   Mueve archivos a su sitio según la capa a la que pertenecen y los agrupa en subcarpetas por responsabilidad.
   Reescribe todas las referencias (ver lib/mover.mjs). No cambia lógica.
     node tools/migrate/phase2.mjs [--dry]
   Antes hay que haber ejecutado phase2-edits.mjs (rompe los 2 ciclos de imports). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyMoves, listFiles } from "./lib/mover.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!/realify - mejorado$/i.test(root.replace(/\\/g, "/"))) throw new Error("Debe ejecutarse sobre «Realify - Mejorado»: " + root);
const DRY = process.argv.includes("--dry");

const moves = {};
const mv = (from, to) => { moves[from] = to; };
const group = (fromDir, toDir, names) => { for (const n of names) mv(`${fromDir}/${n}.js`, `${toDir}/${n}.js`); };

/* ── 1 · cimientos: lo que usa todo el mundo y no depende de nada de arriba (core) ── */
mv("js/ui/toast.js", "js/core/toast.js");
mv("js/ui/commands.js", "js/core/commands.js");
mv("js/editor/view.js", "js/core/view.js");
mv("js/editor/blend.js", "js/core/blend.js");
mv("js/editor/webgpu.js", "js/core/webgpu.js");
mv("js/pwa-updates.js", "js/core/pwa-updates.js");

/* ── 2 · kit de interfaz: piezas reutilizables que sólo dependen de core ── */
group("js/ui", "js/ui/kit", ["dialog", "compact", "keyboard", "premium", "wbpick", "stepper", "sortable", "fsshell"]);
/* ayuda, avisos legales y primeros pasos */
group("js/ui", "js/ui/help", ["guide", "legal", "bugreport", "onboarding", "prefsnote"]);

/* ── 3 · lo que estaba en core pero depende del editor ── */
mv("js/core/documents.js", "js/editor/documents.js");
group("js/core", "js/io/precision", ["precision-stack", "high-precision", "high-precision-safe", "high-precision-next"]);
mv("js/gpu/floatcompositor.js", "js/editor/render/floatcompositor.js");

/* ── 4 · lo que vivía en un plugin pero lo usa el resto de la app ── */
mv("plugins/raw/formats.js", "js/io/raw-formats.js");
mv("plugins/hdr/exif.js", "js/exif/quick-exif.js");
mv("plugins/hdr/sources.js", "js/features/photo-sources.js");

/* ── 5 · editor/ por responsabilidades ── */
group("js/editor", "js/editor/render", ["compositor", "floatadjust", "floatfilter", "floatspatial", "resample", "resample-worker"]);
group("js/editor", "js/editor/layers", ["layertree", "layerstyles", "layercontent", "groups", "masks", "maskadjust", "blendif",
  "adjustlayers", "adjust-types", "smartobject", "filterlayer", "filterchain", "filteramount", "filterregistry"]);
group("js/editor", "js/editor/selection", ["selection", "selection-overlay", "refineedge", "refineedge-math", "luminositymasks", "pentool"]);
group("js/editor", "js/editor/adjust", ["adjust", "adjustments", "advanced-color", "autoanalysis", "autoenhance", "bwrecipes", "channelmixer",
  "clahe", "clahe-math", "colorbalance", "colorbands", "curves", "curvesfs", "exposure", "gradientmap", "hslpremium", "lowlight",
  "premiumcolor", "rangehsl", "selectivecolor", "shadowshighlights", "tone", "toneband", "tonepremium", "vibrance"]);
group("js/editor", "js/editor/tools", ["tools", "paint", "brushes", "transformtool", "perspective", "perspectool", "liquify", "contentmove",
  "fillcontent", "patchmatch", "grab", "rulers", "smartgrid"]);
group("js/editor", "js/editor/text", ["text", "textbox", "textedit", "textprops", "textstyles", "gfonts"]);
/* (quedan en js/editor/: align, clipboard, imageops y documents) */

/* ── 6 · io/ por responsabilidades ── */
group("js/io", "js/io/formats", ["alpha", "codecs", "formats", "formats16", "exr", "heic", "heif", "hidepth", "icc-embed", "icccmyk", "psd16",
  "psdfonts", "psdlayers16", "professional-formats", "compatibility", "zip"]);
group("js/io", "js/io/export", ["export", "export-utils", "professional-export", "pdfexport", "pdfpro", "pdflayers", "gifexport"]);
group("js/io", "js/io/meta", ["metadata", "metacontainers", "metaedit", "metapresets", "batchmeta", "strip", "stripui", "c2paui"]);
/* (quedan en js/io/: open y project) */

/* ── 7 · filters/ ── */
group("js/filters", "js/filters/library", ["advanced", "basic", "classic", "effects", "freqsep", "sharpen-engine", "sharpen-worker"]);
group("js/filters", "js/filters/looks", ["looks", "looksfs", "styleengine"]);

/* Los movimientos de un mismo origen a un destino ya existente o repetido los detecta el mover. */
const files = new Set(listFiles(root));
const missing = Object.keys(moves).filter(f => !files.has(f));
if (missing.length) { console.error("Orígenes que no existen:\n  " + missing.join("\n  ")); process.exit(1); }

const res = applyMoves(root, moves, { dry: DRY });
const s = res.stats;
console.log(`${DRY ? "[simulación] " : ""}movidos: ${s.moved} · archivos con texto reescrito: ${s.filesChanged}`);
console.log(`referencias reescritas → literales: ${s.literal} · css: ${s.css} · html: ${s.html} · md: ${s.md} · menciones: ${s.mentions}`);
console.log(`avisos: ${s.warnings.length} · rutas sin resolver: ${new Set(s.unresolved).size}`);
for (const w of s.warnings.slice(0, 20)) console.log("  aviso:", w);
for (const u of [...new Set(s.unresolved)].slice(0, 20)) console.log("  sin resolver:", u);

if (!DRY) {
  fs.writeFileSync(path.join(root, "tools", "verify", "moves.phase2.json"), JSON.stringify(moves, null, 1));
  /* ¿qué queda suelto en las carpetas que se han reorganizado? */
  for (const d of ["js/editor", "js/io", "js/ui", "js/filters", "js/core"]) {
    const left = fs.readdirSync(path.join(root, d), { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name);
    console.log(`${d}/ (suelto): ${left.join(", ")}`);
  }
}
