/* Prueba de Filtro Vintage con salida de 16 bits (v252): una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
  const V = await import("/vintagefilter/engine.js"), H = await import("/js/core/hisrc.js"), P = await import("/vintagefilter/presets.js");
  const W = 600, Hh = 400, o = {};
  const hi = new Uint16Array(W * Hh * 3); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const j = (y * W + x) * 3, v = Math.round(8000 + x * 60.3 + y * 20.7); hi[j] = v; hi[j + 1] = v >> 1; hi[j + 2] = 65535 - v; }
  const c = document.createElement("canvas"); c.width = W; c.height = Hh; const cx = c.getContext("2d"), img = cx.createImageData(W, Hh);
  for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4, j = (y * W + x) * 3; for(let k = 0; k < 3; k++) img.data[i + k] = H.hiToCanvas8(hi[j + k], x, y, k, true); img.data[i + 3] = 255; }
  cx.putImageData(img, 0, 0);
  const gl = new V.VintageGL();
  const state = { sepia: 60, agedDesat: 30, castYellow: 25 };
  const r8 = await gl.renderFull(c, state), r16 = await gl.renderFull(c, state, () => {}, { data: hi, w: W, h: Hh, dither: true });
  gl.dispose();
  o.tiene = !!r16._hi; o.sin = !r8._hi; if(!r16._hi) return o;
  const a = r16.getContext("2d").getImageData(0, 0, W, Hh).data, b8 = r8.getContext("2d").getImageData(0, 0, W, Hh).data, h16 = r16._hi;
  let bad = 0, diff = 0, n = 0, uniq = new Set();
  for(let y = 0; y < Hh; y += 2) for(let x = 0; x < W; x += 2){ const i = (y * W + x) * 4, j = (y * W + x) * 3; if(a[i + 3] < 255) continue; n++;
    for(let k = 0; k < 3; k++){ if(a[i + k] !== H.hiToCanvas8(h16[j + k], x, y, k, true)) bad++; diff += Math.abs(a[i + k] - b8[i + k]); }
    if(y === 200) uniq.add(h16[j]); }
  let ch = 0; for(let y = 0; y < Hh; y += 4) for(let x = 0; x < W; x += 4){ const i = (y * W + x) * 4; ch += Math.abs(a[i] - H.hiToCanvas8(hi[(y * W + x) * 3], x, y, 0, true)); } o.cambia = +(ch / (n / 2)).toFixed(1);
  o.bad = bad; o.n = n; o.dif = +(diff / (n * 3)).toFixed(2); o.distintos = uniq.size;
  return o;
});
console.log(JSON.stringify(res));
const ok = res.tiene && res.sin && res.bad === 0 && res.n > 20000 && res.dif < 4 && res.cambia > 3 && res.distintos > 256;
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
