/* ═══════════════════════════════════════════════════════════════
   PRUEBA · reglas de interfaz de las funciones de IA nuevas (4.7 del plan)
   Recorre las carpetas de función (js/features/<familia>/<función>/ con manifest.js) y comprueba, SIN navegador:
     · ninguna función importa fsshell ni dialog directamente (sólo lo hacen los hosts: ai-editor y el diálogo simple);
     · ninguna dibuja un deslizador a mano (los mandos salen de `params`);
     · el campo `ui` de su manifiesto es "simple" o { editor, group } con un editor que existe en plugins/;
     · su `params` es válido para params-panel.js.
   Hoy no hay funciones nuevas, así que pasa vacío; empieza a vigilar con la primera.
   Uso: node tests/ia/interfaces.mjs
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RAIZ } from "./lib/navegador.mjs";
import { paramsFor } from "../../js/ui/kit/params-panel.js";

const FEATURES = path.join(RAIZ, "js", "features");
const IGNORAR = new Set(["ai-kit", "shared", "photo-tools"]);
const editores = new Set(fs.existsSync(path.join(RAIZ, "plugins")) ? fs.readdirSync(path.join(RAIZ, "plugins")).filter(d => d.endsWith("-editor")).map(d => d.replace(/-editor$/, "")) : []);
const TIPOS = new Set(["range", "toggle", "seg", "select", "color", "number", "text", "thumbs", "button"]);

function carpetasDeFuncion() {
  const out = [];
  for (const fam of fs.readdirSync(FEATURES, { withFileTypes: true })) {
    if (!fam.isDirectory() || IGNORAR.has(fam.name)) continue;
    for (const fn of fs.readdirSync(path.join(FEATURES, fam.name), { withFileTypes: true }))
      if (fn.isDirectory() && !IGNORAR.has(fn.name) && fs.existsSync(path.join(FEATURES, fam.name, fn.name, "manifest.js"))) out.push(path.join(FEATURES, fam.name, fn.name));
  }
  return out;
}
function archivos(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? archivos(path.join(dir, e.name)) : e.name.endsWith(".js") ? [path.join(dir, e.name)] : []); }

let fallos = 0;
const mal = (f, msg) => { fallos++; console.log(`FALLO: ${path.relative(RAIZ, f)}: ${msg}`); };
const dirs = carpetasDeFuncion();
for (const dir of dirs) {
  for (const f of archivos(dir)) {
    const src = fs.readFileSync(f, "utf8");
    if (/ui\/kit\/(fsshell|dialog)(\.js)?["'?]/.test(src)) mal(f, "importa fsshell o dialog directamente (sólo los hosts lo hacen)");
    if (/type\s*=\s*["']range["']/.test(src)) mal(f, "dibuja un deslizador a mano (usa `params`)");
  }
  const man = path.join(dir, "manifest.js");
  const M = (await import(pathToFileURL(man).href)).default ?? (await import(pathToFileURL(man).href)).manifest;
  if (!M) { mal(man, "no exporta el manifiesto (export default o export const manifest)"); continue; }
  const ui = M.ui;
  if (!(ui === "simple" || (ui && typeof ui === "object" && editores.has(ui.editor) && typeof ui.group === "string"))) mal(man, `campo ui no válido: ${JSON.stringify(ui)} (simple o { editor: ${[...editores].join("|") || "—"}, group })`);
  for (const p of paramsFor(M.params || [], null)) if (!p.key || !p.label || !TIPOS.has(p.type)) mal(man, `parámetro no válido: ${JSON.stringify(p)}`);
}
console.log(`interfaces: ${dirs.length} función(es) revisada(s) · ${fallos ? "FALLO" : "OK"}`);
process.exit(fallos ? 1 : 0);
