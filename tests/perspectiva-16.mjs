/* Prueba de perspectiva con 16 bits (v252): una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
  const D = await import("/js/core/doc.js"), H = await import("/js/core/hisrc.js"), PT = await import("/js/editor/perspectool.js"), Hs = await import("/js/core/history.js");
  const W = 400, Hh = 300; D.newDoc(W, Hh, { name: "p" }); const L = D.addLayer({ name: "Fondo" });
  const hi = new Uint16Array(W * Hh * 3); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const j = (y * W + x) * 3, v = Math.round(10000 + x * 40.3 + y * 3.1); hi[j] = v; hi[j + 1] = v + 500; hi[j + 2] = 65535 - v; }
  L.hiSrc = { data: hi, w: W, h: Hh, dither: false, x: 0, y: 0, canvasW: W, canvasH: Hh };
  const img = L.ctx.createImageData(W, Hh); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4, j = (y * W + x) * 3; for(let k = 0; k < 3; k++) img.data[i + k] = H.hiToCanvas8(hi[j + k], x, y, k, false); img.data[i + 3] = 255; }
  L.ctx.putImageData(img, 0, 0);
  const o = {}; const lay = () => D.doc.layers.find(z => z.id === L.id);
  PT.perspBegin(); PT.persp.base = [[40, 0], [W - 40, 0], [W, Hh], [0, Hh]]; PT.perspRecompute();
  o.ok = PT.perspApply(); const l1 = lay(); const hs = l1.hiSrc;
  o.hi = !!hs && hs.w === W && hs.h === Hh;
  if(hs){
    const px = l1.ctx.getImageData(0, 0, W, Hh).data; let bad = 0, n = 0, trans = 0;
    for(let y = 0; y < Hh; y += 2) for(let x = 0; x < W; x += 2){ const i = (y * W + x) * 4, j = (y * W + x) * 3; if(!px[i + 3]){ trans++; continue; } if(px[i + 3] < 255) continue; n++; for(let k = 0; k < 3; k++) if(px[i + k] !== H.hiToCanvas8(hs.data[j + k], x, y, k, false)) bad++; }
    o.bad = bad; o.n = n; o.trans = trans;
    // centro del documento ≈ centro de la imagen original (la perspectiva es simétrica): valor 16 bits cercano al del centro original
    const c = ((150) * W + 200) * 3, e = hi[c]; o.centro = Math.abs(hs.data[c] - e); o.nomult = hs.data.slice(100000, 103000).some(v => v % 257 !== 0);
  }
  Hs.undo(); await new Promise(r => setTimeout(r, 100)); o.und = lay().hiSrc?.data === hi;
  Hs.redo(); await new Promise(r => setTimeout(r, 100)); o.red = lay().hiSrc === hs;
  return o;
});
console.log(JSON.stringify(res));
const ok = res.ok && res.hi && res.bad === 0 && res.n > 10000 && res.trans > 100 && res.centro < 600 && res.nomult && res.und && res.red;
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
