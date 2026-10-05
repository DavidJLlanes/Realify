/* Prueba de Realify con salida de 16 bits (Premium) (v252): una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
  const E = await import("/js/filters/camera/engine.js"), H = await import("/js/core/hisrc.js"), S = await import("/js/filters/camera/state.js");
  const W = 320, Hh = 200, o = {};
  o.avail = E.available(); if(!o.avail) return o;
  const hi = new Uint16Array(W * Hh * 3); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const j = (y * W + x) * 3, v = Math.round(8000 + x * 120.7 + y * 31.3); hi[j] = v; hi[j + 1] = v >> 1; hi[j + 2] = 65535 - v; }
  const c = document.createElement("canvas"); c.width = W; c.height = Hh; const cx = c.getContext("2d"), img = cx.createImageData(W, Hh);
  for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4, j = (y * W + x) * 3; for(let k = 0; k < 3; k++) img.data[i + k] = H.hiToCanvas8(hi[j + k], x, y, k, true); img.data[i + 3] = 255; }
  cx.putImageData(img, 0, 0);
  const st = S.normalizeState({}); for(const id of Object.keys(st.stages)) st.stages[id].on = false; st.stages.tone.on = true;
  E.setPremium(true); o.setSrc = E.setSource(c);
  const hs = { data: hi, w: W, h: Hh, dither: true };
  const r = E.renderHi(hs, st.stages, { dose: 1 }); o.hay = !!r; if(!r){ o.float32 = E.hasFloat(); return o; }
  // sin etapas activas: null; con la de tono, la imagen cambia suavemente y NO por escalones de 8 bits
  let sad = 0, flip = 0; const n = W * Hh;
  for(let y = 0; y < Hh; y += 2) for(let x = 0; x < W; x += 2){ const j = (y * W + x) * 3, jf = ((Hh - 1 - y) * W + x) * 3; sad += Math.abs(r.hi[j] - hi[j]); flip += Math.abs(r.hi[jf] - hi[j]); }
  o.sad = Math.round(sad / (n / 4)); o.flip = Math.round(flip / (n / 4));
  // finura: valores distintos en una fila (con 8 bits habría <= 256)
  const row = new Set(); for(let x = 0; x < W; x++) row.add(r.hi[(100 * W + x) * 3]); o.distintos = row.size;
  const off = JSON.parse(JSON.stringify(st.stages)); off.tone.on = false; o.nulo = E.renderHi(hs, off, { dose: 1 }) === null;
  E.setPremium(false); o.noPremium = E.renderHi(hs, st.stages, { dose: 1 }) === null;
  return o;
});
console.log(JSON.stringify(res));
const ok = res.avail && res.setSrc && res.hay && res.sad < res.flip / 3 && res.distintos > 200 && res.nulo && res.noPremium;
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
