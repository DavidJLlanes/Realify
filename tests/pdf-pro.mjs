/* PDF profesional (v254): fondo para transparencias, marcas de recorte dibujadas, fuente propia, PDF/X con CMYK y sin pérdidas; tests/pdf_check.py verifica los archivos con pypdf: una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
const fontB64 = fs.readFileSync("/mnt/skills/examples/canvas-design/canvas-fonts/ArsenalSC-Regular.ttf").toString("base64");
const res = await page.evaluate(async fontB64 => {
  const P = await import("/js/io/pdfpro.js");
  const toB64 = async b => { const u = new Uint8Array(await b.arrayBuffer()); let s = ""; for(let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
  const mk = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return c; };
  // una imagen con un círculo azul sobre transparencia y otra opaca
  const A = { name: "círculo", canvas: mk(200, 150, (x, w, h) => { x.fillStyle = "#1e3a8a"; x.beginPath(); x.arc(w / 2, h / 2, 60, 0, 7); x.fill(); }) };
  const B = { name: "degradado", canvas: mk(150, 200, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#ef4444"); g.addColorStop(1, "#22c55e"); x.fillStyle = g; x.fillRect(0, 0, w, h); }) };
  const font = Uint8Array.from(atob(fontB64), c => c.charCodeAt(0));
  const o = {};
  const run = async (key, opts, imgs = [A, B]) => { const r = await P.buildPdf(imgs, { page: "a4", marginMm: 10, dpi: 150, quality: .9, ...opts }); o[key] = await toB64(r.blob); o[key + "_i"] = { pages: r.pages, pdfx: r.pdfx, textSkipped: r.textSkipped }; };
  await run("fondo", { background: "#ffe08a" });
  await run("marcas", { bleedMm: 3, cropMarks: true, page: "a4" });
  await run("fuente", { font, cover: { title: "Álbum de prueba ñ", subtitle: "Subtítulo" }, numbering: true });
  await run("pdfx", { bleedMm: 3, cropMarks: true, font, pdfx: { condition: "FOGRA39" }, cover: { title: "Portada X" }, numbering: true });
  await run("pdfxSinFuente", { pdfx: { condition: "FOGRA39" }, numbering: true, cover: { title: "no sale" } });
  await run("sinperdidas", { lossless: true, background: "#ffffff" });
  await run("xmp", { xmp: '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>Ana XMP</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>', meta: { title: "Con XMP", author: "Ana XMP" } });
  return o;
}, fontB64);
for(const k of ["fondo", "marcas", "fuente", "pdfx", "pdfxSinFuente", "sinperdidas", "xmp"]) fs.writeFileSync(`/tmp/sc/out/pdf.${k}.pdf`, Buffer.from(res[k], "base64"));
console.log(JSON.stringify({ fondo: res.fondo_i, marcas: res.marcas_i, fuente: res.fuente_i, pdfx: res.pdfx_i, pdfxSinFuente: res.pdfxSinFuente_i }));
const ok = res.fondo_i.pages === 2 && res.fuente_i.pages === 3 && res.pdfx_i.pdfx && res.pdfxSinFuente_i.textSkipped;
console.log(ok && !errs.length ? "OK (falta pdf_check.py)" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
