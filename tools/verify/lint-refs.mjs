/* Análisis de referencias sin resolver (ESLint, solo reglas de corrección, sin estilo).
     PW_CORE=<carpeta con eslint y globals> node lint-refs.mjs <raíz> [salida.json]
   Detecta en TODO el código (también en funciones que ninguna prueba ejecuta):
     · no-undef          un identificador que no está declarado ni importado (p. ej. un import que falta tras mover código)
     · no-import-assign  asignar a un binding importado (p. ej. una variable de módulo asignada desde otro módulo)
     · no-redeclare, no-dupe-keys, no-func-assign, no-const-assign, no-class-assign
   Sirve para comparar versiones: lo que ya fallaba en la versión de partida sale igual; lo NUEVO es un error de la
   reorganización. Con `--vs <otra.json>` muestra solo las diferencias. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const root = path.resolve(args[0] || ".");
const outFile = args[1] && !args[1].startsWith("--") ? args[1] : null;
const vsIdx = args.indexOf("--vs");
/* Las dependencias de desarrollo (npm install en la raíz del proyecto) están en ../../node_modules; PW_CORE permite usar otra carpeta. */
process.env.PW_CORE ||= path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const req = createRequire(path.join(process.env.PW_CORE, "x.js"));
const { ESLint } = req("eslint");
const globals = req("globals");

const eslint = new ESLint({
  cwd: root, ignore: false, overrideConfigFile: true,
  overrideConfig: [{
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest", sourceType: "module",
      globals: { ...globals.browser, ...globals.worker, ...globals.es2021, OffscreenCanvas: "readonly", createImageBitmap: "readonly", ImageDecoder: "readonly", VideoEncoder: "readonly", VideoFrame: "readonly", EyeDropper: "readonly", GPUBufferUsage: "readonly", GPUShaderStage: "readonly", GPUTextureUsage: "readonly", GPUMapMode: "readonly", ort: "readonly", UTIF: "readonly", agPsd: "readonly", heic2any: "readonly", cv: "readonly" }
    },
    rules: { "no-undef": "error", "no-import-assign": "error", "no-redeclare": "error", "no-dupe-keys": "error", "no-func-assign": "error", "no-const-assign": "error", "no-class-assign": "error" }
  }]
});

/* js/ y los plugins (en la versión de partida estaban en la raíz con otros nombres) */
const dirs = ["js", "plugins", "camaras", "comparar", "cortar", "formas", "frames", "hdr", "hojacontactos", "lote", "lut", "memes", "panorama", "raw", "socialmediapost", "stickers", "unir", "vintagefilter"].filter(d => fs.existsSync(path.join(root, d)));
const results = await eslint.lintFiles(dirs.map(d => `${d}/**/*.{js,mjs}`).concat([]).map(g => g));
const found = [];
for (const r of results) {
  const rel = path.relative(root, r.filePath).replace(/\\/g, "/");
  if (rel.startsWith("js/vendor/") || /\/(emoji|files|tests)\//.test(rel)) continue;
  for (const m of r.messages) found.push({ file: rel, rule: m.ruleId, line: m.line, msg: m.message });
}
const summary = {};
for (const f of found) { const k = `${f.rule}: ${f.msg}`; summary[k] = summary[k] || new Set(); summary[k].add(f.file); }
const out = { generated: new Date().toISOString(), root, count: found.length, found };
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`archivos analizados: ${results.filter(r => !/js\/vendor\//.test(r.filePath.replace(/\\/g, "/"))).length} · problemas: ${found.length}`);

if (vsIdx >= 0) {
  const base = JSON.parse(fs.readFileSync(args[vsIdx + 1], "utf8"));
  /* clave sin número de línea ni ruta: el mismo problema en el mismo archivo movido sigue siendo el mismo */
  const key = f => `${f.rule}|${f.msg}`;
  const count = list => list.reduce((m, f) => (m.set(key(f), (m.get(key(f)) || 0) + 1), m), new Map());
  const a = count(base.found), b = count(found);
  let nuevos = 0;
  for (const [k, n] of b) { const d = n - (a.get(k) || 0); if (d > 0) { nuevos += d; console.log(`  NUEVO (+${d}): ${k}`); for (const f of found.filter(x => key(x) === k).slice(0, 5)) console.log(`      ${f.file}:${f.line}`); } }
  for (const [k, n] of a) { const d = n - (b.get(k) || 0); if (d > 0) console.log(`  menos (-${d}): ${k}`); }
  console.log(nuevos ? `\n${nuevos} problema(s) nuevo(s) respecto a la versión de partida.` : "\nSin problemas nuevos respecto a la versión de partida.");
  process.exit(nuevos ? 1 : 0);
}
for (const [k, files] of Object.entries(summary).slice(0, 25)) console.log(`  ${k}  (${files.size} archivo/s)`);
