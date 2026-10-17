/* Efectos LUT (galería a pantalla completa), en escritorio y en móvil: abre la herramienta, comprueba familias y miniaturas en vivo, elige un efecto,
   aplica y verifica que queda una capa nueva con su anotación fx («luts» con el id de la tabla) que cambia la imagen, que reabrirla desde fx conserva
   el efecto, que la vista previa de una foto grande no se deforma, que el interruptor Premium lleva la palabra «Premium», que el menú y el cajón del
   móvil tienen la entrada y que el resultado de la GPU coincide con el cálculo en CPU de js/filters/lut/engine.js (también comprueba el orden de ejes).
   Uso: node tests/lut-ui.mjs   (con LUT_SHOTS=carpeta guarda capturas; con PLAYWRIGHT_MODULE=ruta usa otro paquete de Playwright) */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright/index.mjs"].filter(Boolean)){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".cube": "text/plain" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const launchArgs = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
let b; try{ b = await chromium.launch({ args: launchArgs }); }catch{ b = await chromium.launch({ channel: "msedge", args: launchArgs }); }
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } }; const errs = [];
const shots = process.env.LUT_SHOTS; if(shots) fs.mkdirSync(shots, { recursive: true });
const CATALOG = await import("file:///" + path.join(ROOT, "lut/catalog.js").replace(/\\/g, "/"));
const total = CATALOG.ITEMS.length, fams = CATALOG.FAMILIES.length;
for(const mobile of [false, true]){
  const tag = mobile ? "móvil" : "escritorio";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(tag + ": " + e.message)); page.on("requestfailed", r => { if(/\.cube/.test(r.url())) errs.push(tag + ": no cargó " + r.url()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
  await page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(3000, 2000, { name: "n" }); const L = D.addLayer({ name: "Foto" }), x = L.ctx; x.scale(3000 / 900, 3000 / 900);
    const g = x.createLinearGradient(0, 0, 0, 380); g.addColorStop(0, "#3f7fd6"); g.addColorStop(1, "#bfe0f5"); x.fillStyle = g; x.fillRect(0, 0, 900, 600);
    x.fillStyle = "#4b8a3a"; x.fillRect(0, 380, 900, 220); x.fillStyle = "#c9a27a"; x.fillRect(120, 260, 170, 120); x.fillStyle = "#b03030"; x.beginPath(); x.moveTo(100, 260); x.lineTo(205, 190); x.lineTo(310, 260); x.fill();
    x.fillStyle = "#e8b48f"; x.beginPath(); x.arc(560, 330, 70, 0, 7); x.fill(); x.fillStyle = "#fff8d0"; x.beginPath(); x.arc(780, 100, 40, 0, 7); x.fill(); });
  const before = await page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers[D.doc.layers.length - 1]; return { n: D.doc.layers.length, px: Array.from(L.canvas.getContext("2d").getImageData(1867, 1100, 1, 1).data) }; });
  // 0) entradas de menú
  const entries = await page.evaluate(async () => { const M = (await import("/js/ui/menu.js")).MENUS, out = []; const walk = (a, path) => { for(const i of a){ if(i.submenu) walk(i.submenu, path + ">" + i.label); else if(i.items) walk(i.items, path + ">" + i.label); else if(i.cmd === "filter.luts") out.push(path); } }; walk(M, ""); return out; });
  chk(entries.some(e => /Especiales/.test(e)) && entries.some(e => /Filtros \(como en el móvil\)/.test(e)), tag + ": falta la entrada de menú en Especiales y en «Filtros (como en el móvil)»: " + entries.join(" | "));
  if(mobile){
    await page.locator("#toolsHandle").click({ timeout: 5000 }); await page.waitForTimeout(700);
    await page.locator("#toolDrawer [data-cat=filtros]").click(); await page.waitForTimeout(400);
    const item = page.locator("#toolDrawer .td-item", { hasText: "Efectos LUT" });
    chk(await item.count() === 1, tag + ": debe haber una entrada «Efectos LUT» en la pestaña Filtros del cajón");
    chk(await item.first().locator("svg").count() >= 1, tag + ": la entrada del cajón debe llevar icono");
    await item.first().click();
  } else await page.evaluate(async () => { (await import("/js/ui/commands.js")).run("filter.luts"); });
  await page.locator(".fsp.lutf").waitFor({ timeout: 20000 }); await page.waitForTimeout(3500);
  const st = await page.evaluate(() => ({ title: document.querySelector(".fsp-title b")?.textContent, apply: document.querySelector('[data-a="apply"]')?.disabled,
    cells: document.querySelectorAll(".fsp-left .fsp-thumb").length, heads: [...document.querySelectorAll(".fsp-left h3")].map(h => h.textContent),
    imgs: document.querySelectorAll(".fsp-left .fsp-thumb img").length, ps: document.querySelector(".fsp .premium-switch .ps-label")?.textContent, psVisible: !!document.querySelector(".fsp .premium-switch")?.offsetParent }));
  console.log(tag, JSON.stringify({ ...st, heads: st.heads.length }));
  /* Vista previa de una foto grande sin efecto elegido: debe ser la propia foto, sin estirar nada (la textura reducida debe cubrir la foto entera). */
  const flat = await page.evaluate(async (isMobile) => {
    const D = await import("/js/core/doc.js"), L = D.doc.layers[D.doc.layers.length - 1], lx = L.canvas.getContext("2d");
    const cv = document.querySelector(".fsp-stage canvas"), x = cv.getContext("2d"), s = document.querySelector(".fsp-stage");
    const dpr = cv.width / s.clientWidth, pad = (isMobile ? 8 : 24) * dpr, W = L.canvas.width, H = L.canvas.height;
    const k = Math.min((cv.width - pad * 2) / W, (cv.height - pad * 2) / H), ox = (cv.width - W * k) / 2, oy = (cv.height - H * k) / 2;
    return [[.2, .1], [.75, .12], [.15, .9], [.5, .9], [.85, .85], [.9, .55], [.5, .75]].map(([fx, fy]) => {
      const a = Array.from(x.getImageData(Math.round(ox + W * fx * k), Math.round(oy + H * fy * k), 1, 1).data), b = Array.from(lx.getImageData(Math.round(W * fx), Math.round(H * fy), 1, 1).data);
      return { fx, fy, dif: Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) };
    });
  }, mobile);
  chk(flat.every(p => p.dif < 40), tag + ": la vista previa sin efecto debe coincidir con la foto: " + JSON.stringify(flat.filter(p => p.dif >= 40)));
  chk(st.title === "Efectos LUT", tag + ": título"); chk(st.apply === true, tag + ": sin efecto elegido no se puede aplicar");
  chk(st.ps === "Premium" && st.psVisible, tag + ": el interruptor Premium debe llevar la palabra «Premium» y verse");
  if(!mobile){
    chk(st.cells === total + 1, tag + `: debe haber ${total} efectos más «Original»: ` + st.cells); chk(st.heads.length === fams, tag + `: deben verse las ${fams} familias: ` + st.heads.length);
    chk(st.imgs >= 6 && st.imgs < total, tag + ": las miniaturas se calculan al verse, no todas a la vez (" + st.imgs + ")");
    await page.locator(".lkf-search input").fill("amanecer"); await page.waitForTimeout(400);
    const vis = await page.evaluate(() => [...document.querySelectorAll(".fsp-left .fsp-thumb")].filter(e => e.offsetParent && e.dataset.v).map(e => e.textContent.trim()));
    chk(vis.length === 1 && /Amanecer/.test(vis[0]), tag + ": la búsqueda encuentra «Amanecer»: " + JSON.stringify(vis));
    await page.waitForTimeout(1500);
    chk(await page.evaluate(() => !!document.querySelector('.fsp-left .fsp-thumb[data-v="amanecer"] img')), tag + ": la miniatura buscada se calcula al aparecer");
    await page.locator('.fsp-left .fsp-thumb[data-v="amanecer"]').click();
    await page.locator(".lkf-search input").fill(""); await page.waitForTimeout(300);
  } else {
    await page.locator(".fsp-mobile select").first().selectOption({ label: "Looks creativos" }); await page.waitForTimeout(2500);
    const sheet = await page.evaluate(() => ({ open: !document.querySelector(".fsp-sheet").hidden, n: document.querySelectorAll(".fsp-sheet-grid .fsp-thumb").length, imgs: document.querySelectorAll(".fsp-sheet-grid .fsp-thumb img").length }));
    chk(sheet.open && sheet.n >= 20 && sheet.imgs === sheet.n, tag + ": la hoja de miniaturas se rellena: " + JSON.stringify(sheet));
    if(shots) await page.screenshot({ path: path.join(shots, `lut-${tag}-hoja.png`) });
    await page.evaluate(() => document.querySelector('.fsp-sheet-grid .fsp-thumb[data-v="amanecer"]').click());
  }
  await page.waitForTimeout(2000);
  const st2 = await page.evaluate(() => ({ apply: document.querySelector('[data-a="apply"]')?.disabled, sub: document.querySelector(".fsp-sub")?.textContent }));
  chk(st2.apply === false && st2.sub === "Amanecer", tag + ": al elegir un efecto se puede aplicar: " + JSON.stringify(st2));
  if(shots) await page.screenshot({ path: path.join(shots, `lut-${tag}.png`) });
  // 1) Premium
  await page.locator(".fsp .premium-switch").click(); await page.waitForTimeout(1000);
  chk(await page.evaluate(() => document.querySelector(".fsp .premium-switch input").checked) === true, tag + ": el interruptor Premium se activa");
  await page.locator(".fsp .premium-switch").click(); await page.waitForTimeout(400);
  // 2) aplicar
  await page.locator('[data-a="apply"]').click();
  await page.waitForFunction(() => !document.querySelector(".fsp.lutf"), null, { timeout: 90000 });
  const after = await page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers[D.doc.layers.length - 1]; const f = L.filters?.[0];
    return { n: D.doc.layers.length, id: f?.id, lut: f?.params?.id, px: Array.from(L.canvas.getContext("2d").getImageData(1867, 1100, 1, 1).data), w: L.canvas.width }; });
  console.log(tag, "capa:", JSON.stringify(after));
  chk(after.n === before.n + 1, tag + ": debe haber una capa nueva"); chk(after.id === "luts" && after.lut === "amanecer", tag + ": la capa guarda el id de la tabla («luts»)");
  chk(after.px.some((v, i) => Math.abs(v - before.px[i]) > 4), tag + ": el efecto debe cambiar la imagen: " + before.px + " → " + after.px);
  // 3) reabrir desde fx
  await page.evaluate(async () => { const D = await import("/js/core/doc.js"), R = await import("/js/editor/filterregistry.js"), L = D.doc.layers[D.doc.layers.length - 1]; R.openFilterEditor(L, L.filters[0]); });
  await page.locator(".fsp.lutf").waitFor({ timeout: 20000 }); await page.waitForTimeout(1500);
  const re = await page.evaluate(() => ({ sub: document.querySelector(".fsp-sub")?.textContent, apply: document.querySelector('[data-a="apply"]')?.textContent }));
  chk(re.sub === "Amanecer", tag + ": al reabrir se conserva el efecto: " + re.sub); chk(re.apply === "Guardar", tag + ": al editar el botón es «Guardar»");
  await page.evaluate(() => document.querySelector(".fsp-cancel")?.click()); await page.waitForTimeout(300);
  // 4) la GPU coincide con el cálculo en CPU (y los ejes del .cube están en su orden)
  if(!mobile){
    const gpu = await page.evaluate(async () => {
      const { LutGL, loadLut } = await import("/lut/engine.js"), { applyCubeLut } = await import("/js/filters/lut/engine.js");
      const w = 256, h = 160, src = document.createElement("canvas"); src.width = w; src.height = h; const x = src.getContext("2d"), im = x.createImageData(w, h);
      for(let j = 0, i = 0; j < h; j++) for(let k = 0; k < w; k++, i += 4){ im.data[i] = k; im.data[i + 1] = (j * 255 / h) | 0; im.data[i + 2] = (k * 3 + j * 5) & 255; im.data[i + 3] = 255; }
      x.putImageData(im, 0, 0);
      const out = {};
      for(const [fam, id] of [["creativos", "neon"], ["negativo-color", "frio-vivo"], ["blanco-negro", "filtro-rojo"], ["creativos", "ambar"]]){
        let lut; try{ lut = await loadLut(fam, id); }catch(e){ out[id] = "no carga: " + e.message; continue; }
        const cpu = x.getImageData(0, 0, w, h); applyCubeLut(cpu.data, lut, 100);
        for(const premium of [false, true]){
          const g = new LutGL(); const res = await g.renderFull(src, lut, { intensity: 100, premium }); g.dispose();
          const d = res.getContext("2d").getImageData(0, 0, w, h).data; let s = 0, m = 0;
          for(let i = 0; i < d.length; i += 4) for(let c = 0; c < 3; c++){ const e = Math.abs(d[i + c] - cpu.data[i + c]); s += e; if(e > m) m = e; }
          out[id + (premium ? " premium" : "")] = { mae: +(s / (w * h * 3)).toFixed(2), max: m };
        }
      }
      return out;
    });
    console.log(tag, "GPU frente a CPU:", JSON.stringify(gpu));
    for(const [k, v] of Object.entries(gpu)) chk(typeof v === "object" && v.mae < 1.5 && v.max < 12, tag + ": la GPU no coincide con el cálculo en CPU en «" + k + "»: " + JSON.stringify(v));
  }
  await ctx.close();
}
chk(errs.length === 0, "errores: " + errs.join("; "));
await b.close(); srv.close(); console.log(bad ? "efectos LUT: FALLO" : "efectos LUT: OK"); process.exit(bad ? 1 : 0);
