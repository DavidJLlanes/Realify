/* Cámaras (galería a pantalla completa), en escritorio y en móvil: abre la herramienta, comprueba familias y miniaturas en vivo, elige una cámara,
   aplica y verifica que queda una capa nueva con su anotación fx («camaras» con la receta) que cambia la imagen, que reabrirla desde fx conserva
   la cámara, que el interruptor Premium lleva la palabra «Premium» y que el menú tiene la entrada.
   Uso: node tests/camaras-ui.mjs   (con CAMARAS_SHOTS=carpeta guarda capturas; con PLAYWRIGHT_MODULE=ruta usa otro paquete de Playwright) */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright/index.mjs"].filter(Boolean)){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const launchArgs = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
let b; try{ b = await chromium.launch({ args: launchArgs }); }catch{ b = await chromium.launch({ channel: "msedge", args: launchArgs }); }
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } }; const errs = [];
const shots = process.env.CAMARAS_SHOTS; if(shots) fs.mkdirSync(shots, { recursive: true });
for(const mobile of [false, true]){
  const tag = mobile ? "móvil" : "escritorio";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(tag + ": " + e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
  await page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(3000, 2000, { name: "n" }); const L = D.addLayer({ name: "Foto" }), x = L.ctx; x.scale(3000 / 900, 3000 / 900);
    const g = x.createLinearGradient(0, 0, 0, 380); g.addColorStop(0, "#3f7fd6"); g.addColorStop(1, "#bfe0f5"); x.fillStyle = g; x.fillRect(0, 0, 900, 600);
    x.fillStyle = "#4b8a3a"; x.fillRect(0, 380, 900, 220); x.fillStyle = "#c9a27a"; x.fillRect(120, 260, 170, 120); x.fillStyle = "#b03030"; x.beginPath(); x.moveTo(100, 260); x.lineTo(205, 190); x.lineTo(310, 260); x.fill();
    x.fillStyle = "#e8b48f"; x.beginPath(); x.arc(560, 330, 70, 0, 7); x.fill(); x.fillStyle = "#fff8d0"; x.beginPath(); x.arc(780, 100, 40, 0, 7); x.fill(); });
  const before = await page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers[D.doc.layers.length - 1]; return { n: D.doc.layers.length, px: Array.from(L.canvas.getContext("2d").getImageData(1867, 1100, 1, 1).data) }; });
  // 0) entradas de menú
  const entries = await page.evaluate(async () => { const M = (await import("/js/ui/menu.js")).MENUS, out = []; const walk = (a, path) => { for(const i of a){ if(i.submenu) walk(i.submenu, path + ">" + i.label); else if(i.items) walk(i.items, path + ">" + i.label); else if(i.cmd === "filter.cameras") out.push(path); } }; walk(M, ""); return out; });
  chk(entries.some(e => /Especiales/.test(e)) && entries.some(e => />Filtro>Filtros$/.test(e)), tag + ": falta la entrada de menú en Especiales y en «Filtros»: " + entries.join(" | "));
  if(mobile){
    // en el móvil se abre desde la pestaña «Filtros» del cajón «Herramientas», con su icono
    await page.locator("#toolsHandle").click({ timeout: 5000 }); await page.waitForTimeout(700);
    await page.locator("#toolDrawer [data-cat=filtros]").click(); await page.waitForTimeout(400);
    const item = page.locator("#toolDrawer .td-item", { hasText: "Cámaras" });
    chk(await item.count() === 1, tag + ": debe haber una entrada «Cámaras» en la pestaña Filtros del cajón");
    chk(await item.first().locator("svg").count() >= 1, tag + ": la entrada del cajón debe llevar icono");
    await item.first().click();
  } else await page.evaluate(async () => { (await import("/js/core/commands.js")).run("filter.cameras"); });
  await page.locator(".fsp.cmf").waitFor({ timeout: 20000 }); await page.waitForTimeout(6000);
  const st = await page.evaluate(() => ({ title: document.querySelector(".fsp-title b")?.textContent, apply: document.querySelector('[data-a="apply"]')?.disabled,
    cells: document.querySelectorAll(".fsp-left .fsp-thumb").length, heads: [...document.querySelectorAll(".fsp-left h3")].map(h => h.textContent),
    imgs: [...document.querySelectorAll(".fsp-left .fsp-thumb img")].length, ps: document.querySelector(".fsp .premium-switch .ps-label")?.textContent, psVisible: !!document.querySelector(".fsp .premium-switch")?.offsetParent }));
  console.log(tag, JSON.stringify({ ...st, heads: st.heads.length }));
  /* Vista previa de una foto grande sin cámara elegida: debe ser la propia foto, sin estirar nada (la textura reducida tiene que cubrir la foto entera).
     Se compara, en varios puntos, el visor con los píxeles reales de la capa. */
  const flat = await page.evaluate(async (isMobile) => {
    const D = await import("/js/core/doc.js"), L = D.doc.layers[D.doc.layers.length - 1], lx = L.canvas.getContext("2d");
    const cv = document.querySelector(".fsp-stage canvas"), x = cv.getContext("2d"), st = document.querySelector(".fsp-stage");
    const dpr = cv.width / st.clientWidth, pad = (isMobile ? 8 : 24) * dpr, W = L.canvas.width, H = L.canvas.height;
    const k = Math.min((cv.width - pad * 2) / W, (cv.height - pad * 2) / H), ox = (cv.width - W * k) / 2, oy = (cv.height - H * k) / 2;
    const out = [];
    for(const [fx, fy] of [[.2, .1], [.75, .12], [.15, .9], [.5, .9], [.85, .85], [.9, .55], [.5, .75]]){
      const a = Array.from(x.getImageData(Math.round(ox + W * fx * k), Math.round(oy + H * fy * k), 1, 1).data), b = Array.from(lx.getImageData(Math.round(W * fx), Math.round(H * fy), 1, 1).data);
      out.push({ fx, fy, dif: Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])), vista: a.slice(0, 3), foto: b.slice(0, 3) });
    }
    return out;
  }, mobile);
  chk(flat.every(p => p.dif < 40), tag + ": la vista previa sin cámara debe coincidir con la foto (si no, se estira o se desplaza): " + JSON.stringify(flat.filter(p => p.dif >= 40)));
  chk(st.title === "Cámaras", tag + ": título"); chk(st.apply === true, tag + ": sin cámara elegida no se puede aplicar");
  chk(st.ps === "Premium" && st.psVisible, tag + ": el interruptor Premium debe llevar la palabra «Premium» y verse");
  if(!mobile){
    chk(st.cells === 151, tag + ": debe haber 150 cámaras más «Original»: " + st.cells); chk(st.heads.length === 19, tag + ": deben verse las 19 familias: " + st.heads.length);
    chk(st.imgs >= 150, tag + ": las miniaturas deben pintarse (" + st.imgs + ")");
    await page.locator(".lkf-search input").fill("2005"); await page.waitForTimeout(300);
    const vis = await page.evaluate(() => [...document.querySelectorAll(".fsp-left .fsp-thumb")].filter(e => e.offsetParent && e.dataset.v).map(e => e.textContent.trim()));
    chk(vis.length >= 1 && vis.some(t => /2005/.test(t)), tag + ": la búsqueda encuentra «2005»: " + JSON.stringify(vis));
    await page.locator(".lkf-search input").fill(""); await page.waitForTimeout(200);
    await page.locator('.fsp-left .fsp-thumb[data-v="ccd2005"]').click();
  } else {
    await page.locator(".fsp-pick-hit").click(); await page.waitForTimeout(800);
    const sheet = await page.evaluate(() => ({ open: !document.querySelector(".fsp-sheet").hidden, n: document.querySelectorAll(".fsp-sheet-grid .fsp-thumb").length, imgs: document.querySelectorAll(".fsp-sheet-grid .fsp-thumb img").length }));
    chk(sheet.open && sheet.n >= 2 && sheet.imgs === sheet.n, tag + ": la hoja de miniaturas: " + JSON.stringify(sheet));
    if(shots) await page.screenshot({ path: path.join(shots, `camaras-${tag}-hoja.png`) });
    await page.evaluate(() => document.querySelector(".fsp-sheet-grid .fsp-thumb:nth-child(2)").click());
  }
  await page.waitForTimeout(1500);
  const st2 = await page.evaluate(() => ({ apply: document.querySelector('[data-a="apply"]')?.disabled, sub: document.querySelector(".fsp-sub")?.textContent }));
  chk(st2.apply === false, tag + ": al elegir una cámara se puede aplicar"); console.log(tag, "elegida:", st2.sub);
  if(shots) await page.screenshot({ path: path.join(shots, `camaras-${tag}.png`) });
  // 1) Premium
  await page.locator(".fsp .premium-switch").click(); await page.waitForTimeout(800);
  const prem = await page.evaluate(() => document.querySelector(".fsp .premium-switch input").checked); chk(prem === true, tag + ": el interruptor Premium se activa");
  await page.locator(".fsp .premium-switch").click(); await page.waitForTimeout(400);
  // 2) aplicar
  await page.locator('[data-a="apply"]').click();
  await page.waitForFunction(() => !document.querySelector(".fsp.cmf"), null, { timeout: 60000 });
  const after = await page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers[D.doc.layers.length - 1]; const f = L.filters?.[0];
    return { n: D.doc.layers.length, id: f?.id, preset: f?.params?.preset, px: Array.from(L.canvas.getContext("2d").getImageData(1867, 1100, 1, 1).data), w: L.canvas.width }; });
  console.log(tag, "capa:", JSON.stringify(after));
  chk(after.n === before.n + 1, tag + ": debe haber una capa nueva"); chk(after.id === "camaras" && !!after.preset, tag + ": la capa guarda la receta («camaras»)");
  chk(after.px.some((v, i) => Math.abs(v - before.px[i]) > 4), tag + ": la cámara debe cambiar la imagen: " + before.px + " → " + after.px);
  // 3) reabrir desde fx
  await page.evaluate(async () => { const D = await import("/js/core/doc.js"), R = await import("/js/editor/layers/filterregistry.js"), L = D.doc.layers[D.doc.layers.length - 1]; R.openFilterEditor(L, L.filters[0]); });
  await page.locator(".fsp.cmf").waitFor({ timeout: 20000 }); await page.waitForTimeout(1200);
  const re = await page.evaluate(() => ({ sub: document.querySelector(".fsp-sub")?.textContent, apply: document.querySelector('[data-a="apply"]')?.textContent }));
  chk(re.sub === st2.sub, tag + ": al reabrir se conserva la cámara: " + re.sub + " ≠ " + st2.sub); chk(re.apply === "Guardar", tag + ": al editar el botón es «Guardar»");
  await page.evaluate(() => document.querySelector(".fsp-cancel")?.click()); await page.waitForTimeout(300);
  await ctx.close();
}
chk(errs.length === 0, "errores: " + errs.join("; "));
await b.close(); srv.close(); console.log(bad ? "cámaras: FALLO" : "cámaras: OK"); process.exit(bad ? 1 : 0);
