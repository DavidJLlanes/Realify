/* Diálogo «Exportar PDF…» y exportación PDF por capas (v254): reordenar y quitar imágenes añadidas, una página por capa, fondo, marcas, PDF/X con fuente propia; tests/pdf_dialogo_check.py lo verifica: genera un «original» con EXIF (con nota del fabricante), IPTC y XMP, lo filtra con io/metadata.js y lo incrusta en JPEG, PNG, WebP, AVIF, JPEG XL, TIFF y PDF; tests/metadatos_check.py lo verifica con PIL, pillow-heif y tifffile: una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
await page.evaluate(async () => {
  const D = await import("/js/core/doc.js");
  D.newDoc(160, 100, { name: "capas", fill: "#ffffff" });
  const a = D.addLayer({ name: "Roja" }); a.ctx.fillStyle = "#dc2626"; a.ctx.fillRect(0, 0, 160, 100);
  const b = D.addLayer({ name: "Azul" }); b.ctx.fillStyle = "#2563eb"; b.ctx.beginPath(); b.ctx.arc(80, 50, 30, 0, 7); b.ctx.fill();
  const c = D.addLayer({ name: "Oculta" }); c.ctx.fillStyle = "#000"; c.ctx.fillRect(0, 0, 50, 50); c.visible = false;
});
const wait = ms => page.waitForTimeout(ms);
const out = {};
// 1) Exportar PDF…: documento por capas + 2 imágenes añadidas, reordenadas, una quitada, fondo, marcas
await page.evaluate(() => { import("/js/io/pdfexport.js").then(m => { window.__p = m.exportPdf(); }); });
await page.waitForSelector("#pdAdd");
await page.setInputFiles(".modal input[type=file][multiple]", ["/tmp/sc/add_a.png", "/tmp/sc/add_b.png"]);
await wait(800);
out.lista1 = await page.$$eval("#pdList [data-i]", r => r.map(x => x.textContent.replace(/\s+/g, " ").trim().slice(0, 30)));
// subir la segunda imagen (b) al principio y quitar la primera imagen (a)
await page.click("#pdList [data-i='2'] button[data-a=up]"); await page.click("#pdList [data-i='1'] button[data-a=up]");
out.lista2 = await page.$$eval("#pdList [data-i]", r => r.map(x => x.textContent.replace(/\s+/g, " ").trim().slice(0, 30)));
await page.click("#pdList [data-i='2'] button[data-a=del]");
out.lista3 = await page.$$eval("#pdList [data-i]", r => r.map(x => x.textContent.replace(/\s+/g, " ").trim().slice(0, 30)));
await page.check("#pdLayers"); await page.selectOption("#pdPage", "a4");
await page.evaluate(() => { document.querySelector("#pdSrc").closest(".modal-body").querySelectorAll("details").forEach(d => d.open = true); });
await page.fill("#pdBg", "#ffe08a"); await page.check("#pdMarks");
out.info = await page.textContent("#pdInfo");
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120000 }), page.click(".modal-foot button:has-text('Crear PDF')")]);
await dl.saveAs("/tmp/sc/out/dlg1.pdf");
await wait(500);
// 2) Exportar… (PDF simple) con una página por capa
await page.evaluate(() => { import("/js/io/export.js").then(m => { window.__e = m.exportDialog(); }); });
await page.waitForSelector("#exType");
await page.evaluate(() => { const s = document.querySelector("#exType"); s.value = "application/pdf"; s.dispatchEvent(new Event("change", { bubbles: true })); });
await wait(300);
await page.selectOption("#exDest", "download");
out.filaCapas = await page.evaluate(() => !document.querySelector("#exPdfLayersRow").hidden);
await page.check("#exPdfLayers");
const [dl2] = await Promise.all([page.waitForEvent("download", { timeout: 120000 }), page.click(".modal-foot button:has-text('Exportar')")]);
await dl2.saveAs("/tmp/sc/out/dlg2.pdf");
console.log(JSON.stringify(out));
const ok = out.lista1.length === 3 && /Roja|Documento/.test(out.lista1[0]) && out.lista3.length === 2 && out.filaCapas;
console.log(ok && !errs.length ? "OK (falta pdf_dialogo_check.py)" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
