/* Prueba del autoguardado con 16 bits (v252): una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
  const D = await import("/js/core/doc.js"), H = await import("/js/core/hisrc.js"), P = await import("/js/io/project.js");
  const W = 1200, Hh = 800; D.newDoc(W, Hh, { name: "a" }); const L = D.addLayer({ name: "Fondo" });
  const hi = new Uint16Array(W * Hh * 3); for(let i = 0; i < hi.length; i++) hi[i] = (i * 37) % 65536;
  L.hiSrc = { data: hi, w: W, h: Hh, dither: false, x: 0, y: 0, canvasW: W, canvasH: Hh };
  const img = L.ctx.createImageData(W, Hh); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4, j = (y * W + x) * 3; for(let k = 0; k < 3; k++) img.data[i + k] = H.hiToCanvas8(hi[j + k], x, y, k, false); img.data[i + 3] = 255; }
  L.ctx.putImageData(img, 0, 0);
  const o = {}; let t = performance.now(); const s1 = await P.serializeProject({ hi: true, hiMaxPixels: 12e6 }); o.t1 = Math.round(performance.now() - t);
  t = performance.now(); const s2 = await P.serializeProject({ hi: true, hiMaxPixels: 12e6 }); o.t2 = Math.round(performance.now() - t);
  const a = s1.document.layers.find(l => l.hi), b = s2.document.layers.find(l => l.hi); o.tiene = !!a; o.igual = !!a && !!b && a.hi.png === b.hi.png;
  const s3 = await P.serializeProject({ hi: true, hiMaxPixels: 100 }); o.tope = !s3.document.layers.find(l => l.hi);
  await P.restoreProject(s2); const back = D.doc.layers.find(l => l.hiSrc);
  o.vuelta = !!back && back.hiSrc.data[5] === hi[5] && back.hiSrc.data[100000] === hi[100000];
  return o;
});
console.log(JSON.stringify(res));
const ok = res.tiene && res.igual && res.tope && res.vuelta && res.t2 < Math.max(50, res.t1 / 3);
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
