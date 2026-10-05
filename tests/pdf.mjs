/* Prueba del PDF profesional (js/io/pdfpro.js): genera varios PDF en el navegador y los deja en <carpeta> para tests/pdf_check.py.
   Uso: node tests/pdf.mjs <carpeta_salida> */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), out = process.argv[2] || "/tmp";
let chromium; for(const s of ["playwright","/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".wasm":"application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type":T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(); const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1200);
const res = await page.evaluate(async () => {
  const P = await import("/js/io/pdfpro.js"), X = await import("/js/io/pdfexport.js");
  const cv = (w, h, col) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, col); g.addColorStop(1, "#fff"); x.fillStyle = g; x.fillRect(0, 0, w, h); return c; };
  const jpegBytes = async (w, h) => new Uint8Array(await (await new Promise(r => cv(w, h, "#c33").toBlob(r, "image/jpeg", .9))).arrayBuffer());
  const jb = await jpegBytes(600, 400);
  const info = X.jpegInfo(jb);
  const imgs = [{ name:"uno", canvas:cv(3000, 2000, "#36c") }, { name:"dos", jpeg:jb, w:600, h:400 }, { name:"tres", canvas:cv(800, 1200, "#3a6") }, { name:"cuatro ñandú", canvas:cv(1000, 1000, "#a3a") }, { name:"cinco", canvas:cv(400, 300, "#999") }];
  const enc = async blob => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ""; for(let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
  const meta = { title:"Prueba ñ", author:"Realify", subject:"Test", keywords:"a, b" };
  const o = {};
  o.a4 = await P.buildPdf(imgs, { page:"a4", perPage:1, marginMm:10, dpi:150, cover:{ title:"Portada ñ", subtitle:"sub" }, numbering:true, meta });
  o.grid = await P.buildPdf(imgs, { page:"a4", perPage:4, marginMm:10, dpi:200, captions:true, numbering:true });
  o.free = await P.buildPdf(imgs.slice(0, 2), { page:"image", perPage:1, marginMm:0, bleedMm:3, dpi:300 });
  o.lossless = await P.buildPdf(imgs.slice(2, 4), { page:"letter", orientation:"landscape", perPage:2, lossless:true, dpi:150 });
  const r = {};
  for(const k of Object.keys(o)) r[k] = { b64:await enc(o[k].blob), pages:o[k].pages, images:o[k].images };
  r.jpegInfo = info; r.jbLen = jb.length;
  return r;
});
for(const k of ["a4", "grid", "free", "lossless"]) fs.writeFileSync(path.join(out, `p_${k}.pdf`), Buffer.from(res[k].b64, "base64"));
fs.writeFileSync(path.join(out, "p_src.jpg.len"), String(res.jbLen));
console.log("jpegInfo:", JSON.stringify(res.jpegInfo), "páginas:", Object.fromEntries(["a4","grid","free","lossless"].map(k => [k, res[k].pages])));
console.log("errores de página:", errs.length ? errs : "ninguno");
await b.close(); srv.close();
