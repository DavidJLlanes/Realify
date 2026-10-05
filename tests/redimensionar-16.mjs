/* Prueba de redimensionar con 16 bits (v252): una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
  const D = await import("/js/core/doc.js"), H = await import("/js/core/hisrc.js"), R = await import("/js/editor/resample.js");
  const W = 400, Hh = 300; D.newDoc(W, Hh, { name: "r" }); const L = D.addLayer({ name: "Fondo" });
  // degradado suave de 16 bits: sólo 8 bits lo escalonaría; el resultado debe seguir siendo suave y con valores que no son múltiplos de 257
  const hi = new Uint16Array(W * Hh * 3); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const j = (y * W + x) * 3, v = Math.round(10000 + x * 40.3 + y * 3.1); hi[j] = v; hi[j + 1] = v + 500; hi[j + 2] = 65535 - v; }
  L.hiSrc = { data: hi, w: W, h: Hh, dither: false, x: 0, y: 0, canvasW: W, canvasH: Hh };
  const img = L.ctx.createImageData(W, Hh); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4, j = (y * W + x) * 3; for(let k = 0; k < 3; k++) img.data[i + k] = H.hiToCanvas8(hi[j + k], x, y, k, false); img.data[i + 3] = 255; }
  L.ctx.putImageData(img, 0, 0);
  const o = {};
  const r = await R.resampleHi(L, 200, 150, "lanczos3");
  o.hay = !!r; if(!r) return o;
  const h2 = r.hiSrc; o.dims = [h2.w, h2.h, h2.canvasW, h2.canvasH];
  // el centro del degradado: esperado = valor medio de la zona de origen (aprox. lineal)
  const cx = 100, cy = 75, j = (cy * 200 + cx) * 3, ex = Math.round(10000 + (cx * 2 + 0.5) * 40.3 + (cy * 2 + 0.5) * 3.1);
  o.err = Math.abs(h2.data[j] - ex); o.noMultiplo = h2.data.slice(0, 3000).some(v => v % 257 !== 0);
  const px = r.canvas.getContext("2d").getImageData(0, 0, 200, 150).data; let bad = 0;
  for(let y = 0; y < 150; y += 3) for(let x = 0; x < 200; x += 3){ const i = (y * 200 + x) * 4, jj = (y * 200 + x) * 3; for(let k = 0; k < 3; k++) if(px[i + k] !== H.hiToCanvas8(h2.data[jj + k], x, y, k, false)) bad++; }
  o.bad = bad;
  // por el diálogo real: aplicar mediante imageops (hiNew) y deshacer/rehacer
  const Hs = await import("/js/core/history.js"), IO = await import("/js/editor/imageops.js");
  const pr = IO.resizeDialog(); await new Promise(r => setTimeout(r, 300));
  const rw = document.querySelector("#rw"); rw.value = 250; rw.dispatchEvent(new Event("input", { bubbles: true }));
  [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Aplicar").click(); await pr; await new Promise(r => setTimeout(r, 300));
  const l1 = D.doc.layers.find(z => z.id === L.id); o.dbg = [l1.canvas.width, D.doc.w, !!document.querySelector("#rw")]; o.app = l1.hiSrc ? [l1.hiSrc.w, l1.hiSrc.h, l1.canvas.width, l1.canvas.height] : null;
  Hs.undo(); await new Promise(r => setTimeout(r, 100)); const l2 = D.doc.layers.find(z => z.id === L.id); o.und = l2.hiSrc ? [l2.hiSrc.w, l2.hiSrc.h, l2.canvas.width, l2.hiSrc.data === hi] : null;
  Hs.redo(); await new Promise(r => setTimeout(r, 100)); const l3 = D.doc.layers.find(z => z.id === L.id); o.red = l3.hiSrc ? [l3.hiSrc.w, l3.hiSrc.h, l3.canvas.width] : null;
  return o;
});
console.log(JSON.stringify(res));
const ok = res.hay && res.dims.join() === "200,150,200,150" && res.err <= 2 && res.noMultiplo && res.bad === 0 && res.app?.join() === "250,188,250,188" && res.und?.join() === "400,300,400,true" && res.red?.join() === "250,188,250";
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
