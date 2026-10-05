/* Inspector de metadatos con credenciales C2PA (v253): abre archivos firmados (tests/c2pa_gen.py los genera en /tmp/sc) y comprueba lo que enseña el diálogo: genera un «original» con EXIF (con nota del fabricante), IPTC y XMP, lo filtra con io/metadata.js y lo incrusta en JPEG, PNG, WebP, AVIF, JPEG XL, TIFF y PDF; tests/metadatos_check.py lo verifica con PIL, pillow-heif y tifffile: una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
   coma flotante (editor/floatadjust.js y floatfilter.js) deben calcular en 16 bits dentro del rectángulo y en 8 bits fuera, devolver el rectángulo,
   y el resultado debe ser coherente: el lienzo es el redondeo de los 16 bits dentro, y el cálculo de 8 bits fuera. Además, el guardado de proyecto
   debe conservar el rectángulo. Uso: node tests/hi-parcial.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(), errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if(/project|16 bits/.test(m.text())) console.log("consola:", m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const out = {};
for(const [f, mime] of [["c2pa_out.jpg", "image/jpeg"], ["c2pa_out.png", "image/png"], ["c2pa_tamper.jpg", "image/jpeg"]]){
  const b64 = fs.readFileSync(`/tmp/sc/${f}`).toString("base64");
  await page.evaluate(async ({ b64, f, mime }) => {
    const D = await import("/js/core/doc.js"), bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const cv = document.createElement("canvas"); cv.width = 8; cv.height = 8;
    D.newDoc(8, 8, { name: "c2pa", image: cv, source: { w: 8, h: 8, type: mime, size: bin.length, name: f, file: new File([bin], f, { type: mime }) } });
    import("/js/exif/inspector.js").then(m => { window.__insp = m.openMetadataInspector(); });
  }, { b64, f, mime });
  await page.waitForSelector(".meta-inspector", { timeout: 20000 });
  await page.waitForTimeout(500);
  out[f] = await page.evaluate(() => document.querySelector(".meta-inspector").innerText);
  await page.click(".modal-foot button"); await page.waitForTimeout(300);
}
const t = out["c2pa_out.jpg"], tp = out["c2pa_out.png"], tt = out["c2pa_tamper.jpg"];
console.log(t.split("\n").filter(l => /C2PA|Generado|Acciones|Fuente|Firma|Emisor|Integridad|Autor|declara/.test(l)).join(" | ").slice(0, 900));
const ok = /Credenciales de contenido \(C2PA\)/.test(t) && /Realify C2PA test/.test(t) && /c2pa\.created \(Modelo X\)/.test(t) && /trainedAlgorithmicMedia/.test(t) && /ES256/.test(t) && /C2PA Signer/.test(t) && /coinciden con lo firmado/.test(t) && /Ana Autora/.test(t)
  && /Credenciales de contenido/.test(tp) && /coinciden con lo firmado/.test(tp) && /modificó después de firmarse/.test(tt) && /no se verifica la firma/.test(t);
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
