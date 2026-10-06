/* Colores de pintura en P3 (v257): en un documento Display P3 un «#rrggbb» son los números del lienzo, así que el cuentagotas (que lee números P3) y el pintado (fillStyle, rgba(),
   degradados) dan el mismo color y se alcanza toda la gama; en uno sRGB no cambia nada. Uso: node tests/p3-color.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(), errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const res = await page.evaluate(async () => {
  const D = await import("/js/core/doc.js"), CS = await import("/js/core/colorspace.js"), T = await import("/js/editor/tools.js");
  const o = { p3: CS.p3Supported() }; if(!o.p3) return o;
  const px = (ctx, x = 5, y = 5) => Array.from(ctx.getImageData(x, y, 1, 1, { colorSpace: ctx.getContextAttributes().colorSpace }).data);
  // documento P3
  D.newDoc(40, 30, { name: "p3" }); D.doc.colorSpace = "display-p3"; const L = D.addLayer({ name: "c" }), x = L.ctx; o.cs = x.getContextAttributes().colorSpace;
  x.fillStyle = "#ff0000"; x.fillRect(0, 0, 10, 10); o.hex = px(x, 5, 5);
  x.fillStyle = "rgba(0,255,0,1)"; x.fillRect(10, 0, 10, 10); o.rgba = px(x, 15, 5);
  x.fillStyle = "#00f8"; x.fillRect(20, 0, 10, 10); o.corto = px(x, 25, 5);
  const g = x.createLinearGradient(0, 20, 40, 20); g.addColorStop(0, "#ff0000"); g.addColorStop(1, "#00ff00"); x.fillStyle = g; x.fillRect(0, 20, 40, 10); o.grad = [px(x, 0, 25), px(x, 39, 25)];
  x.fillStyle = "color(display-p3 0 1 0)"; x.fillRect(0, 10, 10, 10); o.cssP3 = px(x, 5, 15);          // los colores ya en P3 pasan tal cual
  x.fillStyle = "red"; x.fillRect(10, 10, 10, 10); o.nombre = px(x, 15, 15);                           // un nombre CSS sigue siendo sRGB
  // cuentagotas → pintar: P3 puro (255,0,0) elegido del lienzo, repintado con ese hex, da el mismo color
  const c = T.pickColor ? null : null; const hex = "#" + o.hex.slice(0, 3).map(v => v.toString(16).padStart(2, "0")).join("");
  x.fillStyle = hex; x.fillRect(30, 10, 10, 10); o.vuelta = px(x, 35, 15);
  o.css = [CS.docCss("#ff0000"), CS.docCss("#00ff0080")];
  // lienzo de conversión a sRGB (forceSrgb): sin cambios
  const cv = document.createElement("canvas"); cv.width = cv.height = 4; const sx = cv.getContext("2d", { forceSrgb: true }); sx.fillStyle = "#ff0000"; sx.fillRect(0, 0, 4, 4); o.forzado = { cs: sx.getContextAttributes().colorSpace, px: px(sx, 1, 1) };
  // documento sRGB: igual que siempre
  D.newDoc(20, 20, { name: "s" }); D.doc.colorSpace = "srgb"; const L2 = D.addLayer({ name: "s" }); L2.ctx.fillStyle = "#ff0000"; L2.ctx.fillRect(0, 0, 10, 10); o.srgb = { cs: L2.ctx.getContextAttributes().colorSpace, px: px(L2.ctx), css: CS.docCss("#ff0000") };
  return o;
});
console.log(JSON.stringify(res));
const eq = (a, v, e = 1) => a && v.every((n, i) => Math.abs(a[i] - n) <= e);
const ok = res.p3 === false || (res.cs === "display-p3" && eq(res.hex, [255, 0, 0, 255]) && eq(res.rgba, [0, 255, 0, 255]) && eq(res.corto, [0, 0, 255, 136], 2) && res.grad[0][0] >= 250 && res.grad[0][1] <= 40 && res.grad[1][1] >= 250 && res.grad[1][0] <= 40
  && eq(res.cssP3, [0, 255, 0, 255]) && res.nombre && res.nombre[0] < 250 && eq(res.vuelta, [255, 0, 0, 255]) && /display-p3/.test(res.css[0]) && res.forzado.cs === "srgb" && eq(res.forzado.px, [255, 0, 0, 255])
  && res.srgb.cs === "srgb" && eq(res.srgb.px, [255, 0, 0, 255]) && res.srgb.css === "#ff0000");
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
