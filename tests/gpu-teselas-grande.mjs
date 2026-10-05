/* Compositor GPU por teselas con un documento grande (antes se rechazaba por encima de 4–8 MP) (v252): una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
  const D = await import("/js/core/doc.js"), H = await import("/js/core/hisrc.js"), G = await import("/js/gpu/floatcompositor.js"), LT = await import("/js/editor/layertree.js"), AL = await import("/js/editor/adjustlayers.js");
  const o = {}, W = 4000, Hh = 3000; D.newDoc(W, Hh, { name: "grande" }); o.disp = G.floatAvailable(); if(!o.disp) return o;
  const base = D.addLayer({ name: "Foto" });
  const hi = new Uint16Array(W * Hh * 3); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const j = (y * W + x) * 3, v = Math.round(6000 + x * 12.1 + y * 3.3); hi[j] = v; hi[j + 1] = v >> 1; hi[j + 2] = 65535 - v; }
  const img = base.ctx.createImageData(W, Hh); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4, j = (y * W + x) * 3; for(let k = 0; k < 3; k++) img.data[i + k] = H.hiToCanvas8(hi[j + k], x, y, k, true); img.data[i + 3] = 255; }
  base.ctx.putImageData(img, 0, 0); base.hiSrc = { data: hi, w: W, h: Hh, dither: true, x: 0, y: 0, canvasW: W, canvasH: Hh };
  const adj = AL.addAdjustmentLayer("exposure"); adj.adjustParams = { ...adj.adjustParams, ev: 1 };
  const plan = G.floatPlan(D.doc.layers, W, Hh, {}); o.plan = !!plan; if(!plan) return o;
  let t = performance.now(); const c = G.floatCompose(LT.buildLayerTree(D.doc.layers), D.doc.layers, W, Hh, plan); o.ms1 = Math.round(performance.now() - t); o.ok = !!c && c.width === W && c.height === Hh;
  t = performance.now(); G.floatCompose(LT.buildLayerTree(D.doc.layers), D.doc.layers, W, Hh, plan); o.ms2 = Math.round(performance.now() - t);
  o.info = G.floatInfo.last;
  // el centro del lienzo: la imagen con exposición +0,5 sobre el degradado de 16 bits (más claro que el origen)
  const t2 = document.createElement("canvas"); t2.width = 8; t2.height = 8; t2.getContext("2d").drawImage(c, W / 2 - 4, Hh / 2 - 4, 8, 8, 0, 0, 8, 8); const px = t2.getContext("2d").getImageData(4, 4, 1, 1).data;
  const j = ((Hh / 2) * W + W / 2) * 3; o.centro = [px[0], Math.round(hi[j] / 257)]; o.mas_claro = px[0] > Math.round(hi[j] / 257);
  return o;
});
console.log(JSON.stringify(res));
const ok = res.disp && res.plan && res.ok && res.mas_claro && res.info.tile >= 64;
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
