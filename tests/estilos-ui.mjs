/* Estilos a pantalla completa (v260), en escritorio y en móvil: abre la herramienta, elige un estilo de los convertidos de acciones de Photoshop,
   comprueba la vista previa, aplica y verifica que queda una capa nueva con su anotación fx («look» con el id del estilo) que cambia la imagen,
   y que reabrirla desde fx mantiene el estilo. Uso: node tests/estilos-ui.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(); let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } }; const errs = [];
for(const mobile of [false, true]){
  const tag = mobile ? "móvil" : "escritorio";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
  await page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(900, 600, { name: "n" }); const L = D.addLayer({ name: "Foto" }), x = L.ctx;
    const g = x.createLinearGradient(0, 0, 900, 600); g.addColorStop(0, "#3a6ea5"); g.addColorStop(.5, "#c8b27a"); g.addColorStop(1, "#7a3b2e"); x.fillStyle = g; x.fillRect(0, 0, 900, 600);
    x.fillStyle = "#2d7d3a"; x.fillRect(100, 300, 300, 200); x.fillStyle = "#d8d8d8"; x.fillRect(500, 80, 260, 160); });
  const before = await page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers[D.doc.layers.length - 1]; return { n: D.doc.layers.length, px: Array.from(L.canvas.getContext("2d").getImageData(200, 400, 1, 1).data) }; });
  await page.evaluate(async () => { (await import("/js/ui/commands.js")).run("filter.looks"); });
  await page.locator(".fsp.lkf").waitFor({ timeout: 15000 }); await page.waitForTimeout(1200);
  const st = await page.evaluate(() => ({ title: document.querySelector(".fsp-title b")?.textContent, apply: document.querySelector('[data-a="apply"]')?.disabled, cells: document.querySelectorAll(".fsp-left .fsp-thumb").length, sub: document.querySelector(".fsp-sub")?.textContent }));
  console.log(tag, JSON.stringify(st));
  chk(st.title === "Estilos", tag + ": título"); chk(st.apply === true, tag + ": sin estilo elegido no se puede aplicar");
  if(!mobile){
    chk(st.cells > 250, tag + ": debe haber más de 250 miniaturas (clásicos + convertidos): " + st.cells);
    await page.locator(".lkf-search input").fill("soft matte"); await page.waitForTimeout(300);
    const vis = await page.evaluate(() => [...document.querySelectorAll(".fsp-left .fsp-thumb")].filter(e => e.offsetParent && e.dataset.v !== "-1").map(e => e.textContent.trim()));
    console.log(tag, "búsqueda:", JSON.stringify(vis)); chk(vis.length >= 1 && vis.some(t => /soft matte/i.test(t)), tag + ": la búsqueda encuentra «Soft Matte»");
    await page.locator(".fsp-left .fsp-thumb", { hasText: /Soft Matte/i }).first().click();
  } else {
    // categoría «Matte» y hoja de miniaturas
    await page.locator(".fsp-mobile select").first().selectOption({ label: "Matte" });
    await page.waitForTimeout(900);          // al elegir la categoría se abre la hoja de miniaturas
    const n = await page.evaluate(() => document.querySelectorAll(".fsp-sheet:not([hidden]) .fsp-thumb").length); console.log(tag, "miniaturas en la hoja:", n); chk(n >= 30, tag + ": la hoja lista los estilos Matte");
    await page.locator(".fsp-sheet:not([hidden]) .fsp-thumb", { hasText: /Soft Matte/i }).first().click();
  }
  await page.waitForTimeout(1500);
  const after = await page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers.find(l => l.id === D.doc.activeId); return { px: Array.from(L.canvas.getContext("2d").getImageData(200, 400, 1, 1).data), sub: document.querySelector(".fsp-sub")?.textContent, applyDis: document.querySelector('[data-a="apply"]').disabled }; });
  console.log(tag, "vista previa", JSON.stringify(after));
  chk(after.sub && /soft matte/i.test(after.sub), tag + ": el subtítulo nombra el estilo"); chk(!after.applyDis, tag + ": con un estilo se puede aplicar");
  chk(after.px.some((v, i) => Math.abs(v - before.px[i]) > 6), tag + ": la vista previa cambia la imagen");
  await page.locator('[data-a="apply"]').click(); await page.waitForTimeout(2500);
  const res = await page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers.find(l => l.id === D.doc.activeId), f = L.filters?.[0];
    return { n: D.doc.layers.length, name: L.name, id: f?.id, pid: f?.params?.id, picked: f?.params?.picked, px: Array.from(L.canvas.getContext("2d").getImageData(200, 400, 1, 1).data), shell: !!document.querySelector(".fsp") }; });
  console.log(tag, "resultado", JSON.stringify(res));
  chk(res.n === before.n + 1, tag + ": se añade una capa nueva"); chk(res.id === "look" && /^matte:/.test(res.pid || ""), tag + ": la capa guarda el estilo (fx) con su id"); chk(/Soft Matte/i.test(res.name), tag + ": la capa lleva el nombre del estilo");
  chk(res.px.some((v, i) => Math.abs(v - before.px[i]) > 6), tag + ": el resultado cambia la imagen"); chk(!res.shell, tag + ": la ventana se cierra");
  await ctx.close();
}
chk(errs.length === 0, "errores de página " + errs.slice(0, 3));
console.log(bad ? "FALLO" : "OK"); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
