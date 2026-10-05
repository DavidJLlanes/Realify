/* Prueba del origen de 16 bits PARCIAL (fase 20): una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
  const D = await import("/js/core/doc.js"), H = await import("/js/core/hisrc.js"), FA = await import("/js/editor/floatadjust.js"), FF = await import("/js/editor/floatfilter.js");
  const W = 600, Hh = 400, RC = { x: 100, y: 50, w: 300, h: 200 };
  D.newDoc(W, Hh, { name: "p" }); const L = D.addLayer({ name: "Fondo" });
  const hi = new Uint16Array(RC.w * RC.h * 3); for(let y = 0; y < RC.h; y++) for(let x = 0; x < RC.w; x++){ const j = (y * RC.w + x) * 3; hi[j] = 20000 + x * 7 + y; hi[j + 1] = 30000 + x * 5; hi[j + 2] = 40000 - x * 6 + (y >> 1); }
  L.hiSrc = { data: hi, w: RC.w, h: RC.h, dither: false, x: RC.x, y: RC.y, canvasW: W, canvasH: Hh };
  // lienzo: dentro del rectángulo, el redondeo del origen; fuera, un degradado cualquiera de 8 bits
  const img = L.ctx.createImageData(W, Hh), d = img.data;
  for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4, hx = x - RC.x, hy = y - RC.y, ins = hx >= 0 && hy >= 0 && hx < RC.w && hy < RC.h;
    if(ins){ const j = (hy * RC.w + hx) * 3; d[i] = H.hiToCanvas8(hi[j], hx, hy, 0, false); d[i + 1] = H.hiToCanvas8(hi[j + 1], hx, hy, 1, false); d[i + 2] = H.hiToCanvas8(hi[j + 2], hx, hy, 2, false); }
    else { d[i] = x % 256; d[i + 1] = (y * 2) % 256; d[i + 2] = 90; }
    d[i + 3] = 255; }
  L.ctx.putImageData(img, 0, 0);
  const o = { cubre: FA.hiFullCover(L), rect: FA.hiRect(L) };
  // 1) color: invertir
  const src = document.createElement("canvas"); src.width = W; src.height = Hh; src.getContext("2d").drawImage(L.canvas, 0, 0);
  const inv = (r, g, bb, out) => { out[0] = 255 - r; out[1] = 255 - g; out[2] = 255 - bb; };
  const f1 = await FA.applyFloatFromBase(L, src, inv, null);
  o.f1 = { rect: f1.rect, len: f1.hi.length };
  const px = f1.canvas.getContext("2d").getImageData(0, 0, W, Hh).data, sp = src.getContext("2d").getImageData(0, 0, W, Hh).data;
  let badIn = 0, badOut = 0, badHi = 0, nIn = 0, nOut = 0;
  for(let y = 0; y < Hh; y += 3) for(let x = 0; x < W; x += 3){ const i = (y * W + x) * 4, hx = x - RC.x, hy = y - RC.y, ins = hx >= 0 && hy >= 0 && hx < RC.w && hy < RC.h;
    if(ins){ nIn++; const j = (hy * RC.w + hx) * 3; for(let k = 0; k < 3; k++){ if(H.hiToCanvas8(f1.hi[j + k], hx, hy, k, false) !== px[i + k]) badIn++; if(Math.abs(f1.hi[j + k] - (65535 - hi[j + k])) > 130) badHi++; } }
    else { nOut++; for(let k = 0; k < 3; k++) if(px[i + k] !== 255 - sp[i + k]) badOut++; } }
  o.f1.badIn = badIn; o.f1.badOut = badOut; o.f1.badHi = badHi; o.f1.nIn = nIn; o.f1.nOut = nOut;
  // 2) delta: un resultado de 8 bits que oscurece 10 niveles
  const res = document.createElement("canvas"); res.width = W; res.height = Hh; const rx = res.getContext("2d"); rx.drawImage(L.canvas, 0, 0);
  const im2 = rx.getImageData(0, 0, W, Hh); for(let i = 0; i < im2.data.length; i += 4){ im2.data[i] = Math.max(0, im2.data[i] - 10); im2.data[i + 1] = Math.max(0, im2.data[i + 1] - 10); im2.data[i + 2] = Math.max(0, im2.data[i + 2] - 10); } rx.putImageData(im2, 0, 0);
  const f2 = await FF.applyDeltaFromBase(L, src, res);
  o.f2 = { rect: f2.rect, len: f2.hi.length };
  const p2 = f2.canvas.getContext("2d").getImageData(0, 0, W, Hh).data; let bad2 = 0, bad2o = 0;
  for(let y = 0; y < Hh; y += 3) for(let x = 0; x < W; x += 3){ const i = (y * W + x) * 4, hx = x - RC.x, hy = y - RC.y, ins = hx >= 0 && hy >= 0 && hx < RC.w && hy < RC.h;
    if(ins){ const j = (hy * RC.w + hx) * 3; for(let k = 0; k < 3; k++){ if(H.hiToCanvas8(f2.hi[j + k], hx, hy, k, false) !== p2[i + k]) bad2++; if(Math.abs(f2.hi[j + k] - (hi[j + k] - 2570)) > 300) bad2++; } }
    else for(let k = 0; k < 3; k++) if(p2[i + k] !== im2.data[i + k]) bad2o++; }
  o.f2.bad = bad2; o.f2.badOut = bad2o;
  // 3) attachFloatResult conserva el rectángulo
  const made = D.addLayer({ name: "res" }); FF.attachFloatResult(made, L, f1);
  o.attach = { x: made.hiSrc.x, y: made.hiSrc.y, w: made.hiSrc.w, h: made.hiSrc.h, cw: made.hiSrc.canvasW, ch: made.hiSrc.canvasH };
  // 4) un origen que no corresponde al lienzo (cambió de tamaño) NO sirve
  const other = D.addLayer({ name: "otro" }); other.hiSrc = { data: new Uint16Array(30), w: 5, h: 2, x: 0, y: 0, canvasW: 10, canvasH: 10 }; o.malo = FA.hiFullCover(other);
  // 5) el guardado de proyecto conserva el rectángulo
  const P = await import("/js/io/project.js"); const ser = await P.serializeProject({ hi: true });
  const sl = ser.document.layers.find(l => l.hi); o.proj = sl ? { x: sl.hi.x, y: sl.hi.y, w: sl.hi.w, h: sl.hi.h } : null;
  // 6) y al volver a abrir el proyecto, el origen parcial vuelve con su rectángulo
  await P.restoreProject(ser);
  const back = D.doc.layers.find(l => l.hiSrc); o.vuelta = back ? { x: back.hiSrc.x, y: back.hiSrc.y, w: back.hiSrc.w, h: back.hiSrc.h, cw: back.hiSrc.canvasW, ch: back.hiSrc.canvasH, ok: back.hiSrc.data.length === back.hiSrc.w * back.hiSrc.h * 3, v: back.hiSrc.data[0] } : null;
  o.vuelta && (o.vuelta.igual = back.hiSrc.data[0] === hi[0] && back.hiSrc.data[1000] === hi[1000]);
  return o;
});
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
console.log(JSON.stringify(res));
chk(res.cubre === true && JSON.stringify(res.rect) === JSON.stringify({ x: 100, y: 50, w: 300, h: 200 }), "hiFullCover/hiRect de un origen parcial");
chk(res.f1.len === 300 * 200 * 3 && JSON.stringify(res.f1.rect) === JSON.stringify({ x: 100, y: 50, w: 300, h: 200 }), "color: el resultado lleva el rectángulo del origen");
chk(res.f1.badIn === 0 && res.f1.badHi === 0, `color: dentro, 16 bits exactos y lienzo = redondeo (${res.f1.badIn} / ${res.f1.badHi} mal de ${res.f1.nIn})`);
chk(res.f1.badOut === 0, `color: fuera, cálculo de 8 bits (${res.f1.badOut} mal de ${res.f1.nOut})`);
chk(res.f2.len === 300 * 200 * 3 && res.f2.bad === 0 && res.f2.badOut === 0, `delta: dentro 16 bits coherentes y fuera 8 bits (${res.f2.bad} / ${res.f2.badOut} mal)`);
chk(res.attach.x === 100 && res.attach.y === 50 && res.attach.w === 300 && res.attach.h === 200 && res.attach.cw === 600 && res.attach.ch === 400, "attachFloatResult conserva rectángulo y tamaño del lienzo " + JSON.stringify(res.attach));
chk(res.malo === false, "un origen que no corresponde al lienzo no sirve");
chk(res.proj && res.proj.x === 100 && res.proj.y === 50 && res.proj.w === 300 && res.proj.h === 200, "el proyecto guarda el rectángulo " + JSON.stringify(res.proj));
chk(res.vuelta && res.vuelta.x === 100 && res.vuelta.y === 50 && res.vuelta.w === 300 && res.vuelta.h === 200 && res.vuelta.cw === 600 && res.vuelta.ok && res.vuelta.igual, "al reabrir el proyecto el origen parcial vuelve igual " + JSON.stringify(res.vuelta));
chk(errs.length === 0, "errores " + errs);
await b.close(); srv.close(); console.log(bad ? "hi-parcial: FALLO" : "hi-parcial: OK"); process.exit(bad ? 1 : 0);
