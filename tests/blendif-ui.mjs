/* Editor de «Fusionar si» con pestañas de canal (v256): Gris / Rojo / Verde / Azul; arrastrar en cada una escribe su propio rango y «Quitar» los borra todos. Escritorio y móvil. Uso: node tests/blendif-ui.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), errs = [], R = {};
for(const mobile of [false, true]){
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true } : { viewport: { width: 1200, height: 800 } }), page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const D = await import("/js/core/doc.js"), BI = await import("/js/editor/blendif.js");
    D.newDoc(100, 80, { name: "t" }); const l = D.addLayer({ name: "Capa" }); l.ctx.fillStyle = "#f00"; l.ctx.fillRect(0, 0, 100, 80);
    const host = document.createElement("div"); host.id = "host"; host.style.cssText = "position:fixed;left:0;top:0;width:360px;background:#222;z-index:99999;padding:8px"; document.body.appendChild(host);
    window.__ed = BI.mountBlendIfEditor(l, host); window.__l = l;
  });
  const tabs = await page.$$eval("#host button[data-c]", bs => bs.map(x => x.textContent));
  const drag = async (idx, fromV, toV) => { const cv = (await page.$$("#host canvas"))[idx], bb = await cv.boundingBox(), px = v => bb.x + (10 + v / 255 * 256) / (276) * bb.width, y = bb.y + bb.height * ((8 + 12 + 14) / 40);
    await page.mouse.move(px(fromV), y); await page.mouse.down(); await page.mouse.move(px(toV), y, { steps: 4 }); await page.mouse.up(); };
  await page.click("#host button[data-c=gray]"); await drag(0, 0, 60);                         // negro de «esta capa» (gris) a 60
  await page.click("#host button[data-c=g]"); await drag(0, 0, 40); await drag(1, 255, 200);      // verde: esta capa negro 40; subyacente blanco a 200
  const live = await page.evaluate(() => JSON.parse(JSON.stringify(window.__l.blendIf)));
  await page.evaluate(() => window.__ed.commit());
  const done = await page.evaluate(() => JSON.parse(JSON.stringify(window.__l.blendIf)));
  R[mobile ? "movil" : "escritorio"] = { tabs, gris: done && done.thisLayer.blackMax, verdeEsta: done && done.channels && done.channels.g.thisLayer.blackMax, verdeSub: done && done.channels && done.channels.g.underlying.whiteMin, sinRojo: done && !(done.channels && done.channels.r), live: !!live };
  await page.click("#host button:has-text('Quitar')"); await page.evaluate(() => window.__ed.commit());
  R[mobile ? "movil" : "escritorio"].quitado = await page.evaluate(async () => !(await import("/js/editor/blendif.js")).isBlendIfActive(window.__l.blendIf));
  await ctx.close();
}
console.log(JSON.stringify(R));
const ok = Object.values(R).every(v => v.tabs.join() === "Gris,Rojo,Verde,Azul" && v.gris >= 55 && v.gris <= 65 && v.verdeEsta >= 35 && v.verdeEsta <= 45 && v.verdeSub >= 195 && v.verdeSub <= 205 && v.sinRojo && v.quitado);
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
