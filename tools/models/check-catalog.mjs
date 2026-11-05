/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS DE MODELOS · coherencia del catálogo, los archivos y docs/MODELOS.md
   Comprueba, sin red:
     · cada modelo local (assets/models) existe y pesa lo que dice el catálogo (`size`);
     · si el catálogo declara `sha256`, coincide con el archivo;
     · cada id del catálogo aparece en docs/MODELOS.md, y la huella que allí se anota para los modelos locales coincide con el archivo;
     · los modelos con `noncommercial: true` aparecen con «no» en «Uso comercial».
   Uso:  node tools/models/check-catalog.mjs        (código de salida 1 si algo no cuadra)
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { MODELS } = await import(pathToFileURL(path.join(root, "js", "ai", "models.js")).href);
const doc = fs.readFileSync(path.join(root, "docs", "MODELOS.md"), "utf8");
const sha = files => { const h = crypto.createHash("sha256"); for (const f of files) h.update(fs.readFileSync(f)); return h.digest("hex"); };
const localDir = pathToFileURL(path.join(root, "assets", "models") + path.sep).href;

let fallos = 0;
const mal = m => { fallos++; console.log("FALLO: " + m); };
for (const [id, m] of Object.entries(MODELS)) {
  const fila = doc.split("\n").find(l => l.startsWith("| `" + id + "`"));
  if (!fila) { mal(`${id}: no aparece en docs/MODELOS.md`); continue; }
  if (m.noncommercial && !/\*\*no\*\*/.test(fila)) mal(`${id}: es no comercial pero MODELOS.md no lo marca «no»`);
  if (!m.url.startsWith(localDir)) continue;                                    // remoto: sin archivo que comprobar
  const rutas = (m.parts || [m.url]).map(u => fileURLToPath(u));
  if (rutas.some(r => !fs.existsSync(r))) { mal(`${id}: falta el archivo en assets/models`); continue; }
  const tam = rutas.reduce((a, r) => a + fs.statSync(r).size, 0);
  if (tam !== m.size) mal(`${id}: pesa ${tam} y el catálogo dice ${m.size}`);
  const h = sha(rutas);
  if (m.sha256 && m.sha256.toLowerCase() !== h) mal(`${id}: el sha256 del catálogo no coincide con el archivo`);
  if (!fila.includes(h)) mal(`${id}: la huella de docs/MODELOS.md no coincide con el archivo (${h})`);
}
console.log(`catálogo: ${Object.keys(MODELS).length} modelos revisados · ${fallos ? "FALLO" : "OK"}`);
process.exit(fallos ? 1 : 0);
