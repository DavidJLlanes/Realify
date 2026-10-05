/* Metadatos al exportar por el DIÁLOGO real (v253): abre Exportar con un original que trae EXIF, elige cada formato, edita campos con «Editar…» y exporta; tests/metadatos_check.py verifica lo exportado: genera un «original» con EXIF (con nota del fabricante), IPTC y XMP, lo filtra con io/metadata.js y lo incrusta en JPEG, PNG, WebP, AVIF, JPEG XL, TIFF y PDF; tests/metadatos_check.py lo verifica con PIL, pillow-heif y tifffile: una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
const res = await page.evaluate(async () => {
  const W = await import("/js/exif/writer.js"), M = await import("/js/io/metadata.js"), D = await import("/js/core/doc.js");
  const enc = s => new TextEncoder().encode(s);
  const exifIn = W.buildTIFF([W.eAscii(0x010F, "TestCam"), W.eAscii(0x013B, "Ana Original"), W.eAscii(0x8298, "© Ana")], [W.eAscii(0x9003, "2020:01:02 03:04:05"), W.eShort(0x8827, 400), W.eAscii(0xA431, "SERIAL123")], [], {});
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 48; const x = cv.getContext("2d"); const g = x.createLinearGradient(0, 0, 64, 48); g.addColorStop(0, "#f00"); g.addColorStop(1, "#00f"); x.fillStyle = g; x.fillRect(0, 0, 64, 48);
  const jpg = await new Promise(r => cv.toBlob(r, "image/jpeg", .9));
  const origJpg = await M.embedMetadata(jpg, { exif: exifIn });
  D.newDoc(64, 48, { name: "prueba", image: cv, source: { w: 64, h: 48, type: "image/jpeg", size: origJpg.size, name: "o.jpg", file: new File([origJpg], "o.jpg", { type: "image/jpeg" }) } });
  return { ok: true };
});
const wait = ms => page.waitForTimeout(ms);
const results = {};
for(const [tipo, ext] of [["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/avif", "avif"], ["image/jxl", "jxl"], ["image/tiff", "tif"], ["application/pdf", "pdf"]]){
  await page.evaluate(() => { import("/js/io/export.js").then(m => { window.__dlg = m.exportDialog(); }); });
  await page.waitForSelector("#exType", { timeout: 15000 });
  await page.evaluate(t => { const s = document.querySelector("#exType"); if(!s.querySelector(`option[value="${t}"]`)){ const o = document.createElement("option"); o.value = t; o.textContent = t; s.appendChild(o); } s.value = t; s.dispatchEvent(new Event("change", { bubbles: true })); }, tipo);
  await wait(300);
  await page.selectOption("#exDest", "download");
  await page.selectOption("#exMeta", "nogps");
  // editar campos
  await page.click("#exMetaEdit"); await page.waitForSelector("#meTitle");
  await wait(400);
  await page.fill("#meTitle", "Título editado"); await page.fill("#meDesc", "Descripción editada"); await page.fill("#meAuthor", "Beto Editor"); await page.fill("#meCopy", "© Beto 2024");
  await page.fill("#meKeys", "uno, dos"); await page.fill("#meDate", "2024-05-03T18:30"); await page.fill("#meLat", "-33.5"); await page.fill("#meLon", "151.25");
  await page.click(".modal-foot button:has-text('Guardar')"); await wait(300);
  const hint = await page.textContent("#exMetaHint");
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120000 }), page.click(".modal-foot button:has-text('Exportar')")]);
  const path = `/tmp/sc/out/ui.${ext}`; await dl.saveAs(path);
  results[ext] = { hint: hint.slice(0, 90), bytes: fs.statSync(path).size };
  await wait(500);
}
// la persistencia del documento: el proyecto guarda los campos editados
const proj = await page.evaluate(async () => { const P = await import("/js/io/project.js"); const s = await P.serializeProject({ hi: false }); return s.document.metaEdit; });
console.log(JSON.stringify({ results, proj }));
const ok = Object.keys(results).length === 7 && proj && proj.author === "Beto Editor" && proj.keywords.length === 2;
console.log(ok && !errs.length ? "OK (falta metadatos_check.py ui)" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
