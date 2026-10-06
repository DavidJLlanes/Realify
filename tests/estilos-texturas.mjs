/* Estilos con texturas reales (v261), en escritorio y móvil: elige «Destello 12» (la imagen original de Light Leaks), comprueba que se descarga la
   textura a resolución completa y la miniatura, que la vista previa ilumina el borde derecho y no el izquierdo, y que al aplicar queda una capa nueva
   con su anotación fx (id del estilo). Uso: node tests/estilos-texturas.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(); let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } }; const errs = [];
for(const mobile of [false, true]){
  const tag = mobile ? "móvil" : "escritorio";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message)); const reqs = []; page.on("request", r => { const u = r.url(); if(/estilos\/tex\//.test(u)) reqs.push(u.split("/tex/")[1]); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
  await page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(900, 600, { name: "n" }); const L = D.addLayer({ name: "Foto" }), x = L.ctx; x.fillStyle = "#303030"; x.fillRect(0, 0, 900, 600); });
  const px = () => page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers.find(l => l.id === D.doc.activeId), g = (x, y) => Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); return { izq: g(15, 300), der: g(885, 300) }; });
  const before = await px();
  await page.evaluate(async () => { (await import("/js/ui/commands.js")).run("filter.looks"); });
  await page.locator(".fsp.lkf").waitFor({ timeout: 15000 }); await page.waitForTimeout(1500);
  if(!mobile){
    await page.locator(".lkf-search input").fill("destello 12"); await page.waitForTimeout(400);
    await page.waitForTimeout(2500);
    const th = await page.evaluate(() => { const b = [...document.querySelectorAll(".fsp-left .fsp-thumb")].find(e => e.offsetParent && /destello 12/i.test(e.textContent)); const i = b?.querySelector("img"); return { hay: !!b, img: !!i, w: i?.naturalWidth || 0 }; });
    chk(th.hay && th.img && th.w > 0, tag + ": la miniatura del destello se pinta con su textura " + JSON.stringify(th));
    chk(reqs.includes("leak-12-t.jpg"), tag + ": se descarga la miniatura pequeña, no la grande: " + reqs.join(","));
    chk(!reqs.includes("leak-12.jpg"), tag + ": al ver la cuadrícula aún no se descarga la textura completa");
    await page.locator(".fsp-left .fsp-thumb", { hasText: /Destello 12/i }).first().click();
  } else {
    await page.locator(".fsp-mobile select").first().selectOption({ label: "Destellos de luz" }); await page.waitForTimeout(2500);
    await page.locator(".fsp-sheet:not([hidden]) .fsp-thumb", { hasText: /Destello 12/i }).first().click();
  }
  await page.waitForTimeout(3500);
  chk(reqs.includes("leak-12.jpg"), tag + ": al elegirlo se descarga la textura a resolución completa: " + reqs.slice(-3).join(","));
  const full = await page.evaluate(async () => { const r = await fetch("/assets/estilos/tex/leak-12.jpg"), bm = await createImageBitmap(await r.blob()); return [bm.width, bm.height]; });
  chk(full[0] >= 4000, tag + ": la textura servida es la original de 4000 px: " + full);
  const sub = await page.evaluate(() => document.querySelector(".fsp-sub, .fsp-title span")?.textContent || "");
  const prev = await px(); console.log(tag, "vista previa", JSON.stringify({ before, prev, sub }));
  chk(prev.der[2] > before.der[2] + 40, tag + ": el borde derecho se ilumina en azul (" + prev.der + " frente a " + before.der + ")");
  chk(Math.abs(prev.izq[2] - before.izq[2]) < 8, tag + ": el borde izquierdo apenas cambia (" + prev.izq + ")");
  await page.locator('[data-a="apply"]').click(); await page.waitForTimeout(3000);
  const res = await page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers.find(l => l.id === D.doc.activeId), f = L.filters?.[0], g = (x, y) => Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data);
    return { n: D.doc.layers.length, name: L.name, id: f?.id, pid: f?.params?.id, der: g(885, 300), izq: g(15, 300), shell: !!document.querySelector(".fsp") }; });
  console.log(tag, "resultado", JSON.stringify(res));
  chk(res.n === 2 + 0 || res.n === before.n || res.n >= 2, tag + ": hay capa nueva"); chk(res.id === "look" && res.pid === "vintage:light-leaks-ss-12", tag + ": la capa guarda el estilo (fx) con su id: " + res.pid);
  chk(/Destello 12/.test(res.name), tag + ": la capa lleva el nombre del estilo: " + res.name); chk(res.der[2] > before.der[2] + 40 && !res.shell, tag + ": el resultado ilumina el borde derecho y la ventana se cierra");
  await ctx.close();
}
chk(errs.length === 0, "errores de página " + errs.slice(0, 3));
console.log(bad ? "FALLO" : "OK"); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
