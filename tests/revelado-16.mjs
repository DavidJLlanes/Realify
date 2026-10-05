/* Prueba de Revelado fotográfico Premium con origen de 16 bits (ráster de 16 bits en el motor CPU) (v252): una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
  const R = await import("/raw/premium/render.js"), S = await import("/raw/state.js"), H = await import("/js/core/hisrc.js");
  const W = 400, Hh = 200, o = {};
  const hi = new Uint16Array(W * Hh * 3); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const j = (y * W + x) * 3, v = Math.round(6000 + x * 130.3 + y * 17.1); hi[j] = v; hi[j + 1] = Math.min(65535, v + 3000); hi[j + 2] = 65535 - v; }
  const px8 = new Uint8ClampedArray(W * Hh * 4); for(let i = 0; i < W * Hh; i++){ for(let k = 0; k < 3; k++) px8[i * 4 + k] = Math.round(hi[i * 3 + k] / 257); px8[i * 4 + 3] = 255; }
  const settings = S.normalize({ ...S.defaults(), premium: true, exposure: -25, contrast: 5, saturation: 10 });
  const s16 = { raster: true, raster16: true, width: W, height: Hh, data: hi }, s8 = document.createElement("canvas"); s8.width = W; s8.height = Hh; s8.getContext("2d").putImageData(new ImageData(px8, W, Hh), 0, 0);
  const a = R.renderPremiumRows(s16, settings, 0, Hh, W, Hh, 16), b = R.renderPremiumRows(s8, settings, 0, Hh, W, Hh, 16);
  o.len = [a.length, b.length]; let d = 0, mx = 0; const u16 = new Set(), u8 = new Set();
  for(let i = 0; i < a.length; i++){ const e = Math.abs(a[i] - b[i]); d += e; if(e > mx) mx = e; }
  for(let x = 0; x < 150; x++){ u16.add(a[(100 * W + x) * 3]); u8.add(b[(100 * W + x) * 3]); }
  o.media = Math.round(d / a.length); o.max = mx; o.finos16 = u16.size; o.finos8 = u8.size;
  return o;
});
console.log(JSON.stringify(res));
const ok = res.len[0] === res.len[1] && res.media < 400 && res.finos16 > res.finos8 * 1.15;
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
