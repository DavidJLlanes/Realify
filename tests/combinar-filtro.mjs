/* Combinar capas con una capa de filtro ya aplicada (p. ej. «Retoque de cara»): ni «Combinar hacia abajo» ni «Combinar capas seleccionadas» deben rechazarla
   (los píxeles ya están en la capa; la anotación `filters` sólo dice cómo se obtuvo), y deshacer lo devuelve todo. Uso: node tests/combinar-filtro.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage(), errs = [], toasts = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const setup = () => page.evaluate(async () => {
  const D = await import("/js/core/doc.js"), F = await import("/js/editor/filterlayer.js");
  D.newDoc(120, 80, { name: "n" }); const base = D.addLayer({ name: "Fondo" }); base.ctx.fillStyle = "#336699"; base.ctx.fillRect(0, 0, 120, 80);
  const res = document.createElement("canvas"); res.width = 120; res.height = 80; const x = res.getContext("2d"); x.fillStyle = "#ff0000"; x.fillRect(10, 10, 40, 40);
  const l = F.addFilterLayer({ base, result: res, title: "Retoque de cara", filter: "mix:Retoque de cara" }); F.markMixLayer(l, "Retoque de cara");
  return { base: base.id, top: l.id };
});
const info = id => page.evaluate(async id => { const D = await import("/js/core/doc.js"), L = D.doc.layers, b = L.find(l => l.id === id), p = b.canvas.getContext("2d").getImageData(20, 20, 1, 1).data;
  return { n: L.length, red: p[0] > 200, fx: b.filters?.length || 0 }; }, id);
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
// 1) combinar hacia abajo
let ids = await setup(); await page.evaluate(async () => (await import("/js/ui/commands.js")).run("layer.mergeDown"));
let r = await info(ids.base); console.log("hacia abajo", JSON.stringify(r)); chk(r.n === 2 && r.red && r.fx === 0, "combinar hacia abajo con capa de filtro");
await page.evaluate(async () => (await import("/js/core/history.js")).undo?.()); r = await info(ids.base); chk(r.n === 3 && !r.red, "deshacer combinar hacia abajo " + JSON.stringify(r));
// 2) combinar seleccionadas (clic con Ctrl en las dos filas)
ids = await setup(); await page.waitForTimeout(300);
await page.locator(`.layer[data-id="${ids.base}"]`).click({ modifiers: ["Control"] }); await page.locator(`.layer[data-id="${ids.top}"]`).click({ modifiers: ["Control"] });
await page.evaluate(async () => (await import("/js/ui/commands.js")).run("layer.mergeSelected")); r = await info(ids.base); console.log("seleccionadas", JSON.stringify(r));
chk(r.n === 2 && r.red && r.fx === 0, "combinar capas seleccionadas con capa de filtro");
await page.evaluate(async () => (await import("/js/core/history.js")).undo?.()); r = await info(ids.base); chk(r.n === 3 && !r.red, "deshacer combinar seleccionadas " + JSON.stringify(r));
chk(errs.length === 0, "errores de página " + errs.slice(0, 3));
console.log(bad ? "FALLO" : "OK"); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
