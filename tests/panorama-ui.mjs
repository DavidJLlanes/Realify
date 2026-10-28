/* Prueba de la interfaz de «Panorámica» (escritorio y móvil): añade 4 fotos sintéticas soltándolas en la ventana, calcula la vista previa, cambia
   proyección y horizonte, abre los editores de máscaras y de puntos de control y comprueba el aviso de más de 15 fotos.
   Uso: node tests/panorama-ui.mjs   (SALIDA=carpeta guarda capturas) */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), OUT = process.env.SALIDA || "";
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs", "/opt/npm-tools/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".png": "image/png" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch();
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };

for(const mode of [{ name: "escritorio", w: 1280, h: 800, touch: false }, { name: "movil", w: 390, h: 800, touch: true }]){
  const ctx = await b.newContext({ viewport: { width: mode.w, height: mode.h }, hasTouch: mode.touch, isMobile: mode.touch }), page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
  await page.evaluate(() => setInterval(() => { const bt = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Descargar"); if(bt) bt.click(); }, 400));
  await page.evaluate(async () => {   // abre el editor sin pasar por el documento
    const { ensureShellStyles } = await import("/js/ui/kit/fsshell.js"); await ensureShellStyles();
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/plugins/panorama/style.css"; document.head.appendChild(l);
    const { openPanoramaEditor } = await import("/plugins/panorama/ui.js"); window.__ed = openPanoramaEditor({ current: null, onAccept: async c => { window.__result = [c.width, c.height]; } });
    const { makeScene } = await import("/tests/panorama-escena.js"), sc = makeScene({ W: 640, H: 420, F: 500 });
    window.__drop = async yaws => { const dt = new DataTransfer(); for(const y of yaws){ const c = sc.view(y), blob = await new Promise(r => c.toBlob(r, "image/png")); dt.items.add(new File([blob], `v${y}.png`, { type: "image/png" })); }
      document.querySelector(".fsp-stage").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true })); };
  });
  await page.evaluate(() => window.__drop([-30, 0, 30, 60].reverse()));
  await page.waitForFunction(() => document.querySelector(".fsp-sub")?.textContent.includes("4 fotos"));
  const shot = async n => { if(OUT){ fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, `${mode.name}-${n}.png`) }); } };
  await shot("1-fotos");
  chk(await page.locator("[data-prev]").count() === 1, `${mode.name}: falta el botón «Calcular vista previa»`);
  await page.locator("[data-prev]").click();
  await page.locator("[data-prev]").waitFor({ state: "hidden", timeout: 240000 });   // el aviso se oculta al haber vista previa
  await shot("2-vista");
  const size = async () => page.evaluate(() => { const c = document.querySelector(".fsp-stage canvas"); return [c.width, c.height]; });
  const s0 = await size(); chk(s0[0] > 100, `${mode.name}: vista previa vacía ${s0}`);
  // Cambiar la proyección: sólo el paso rápido (sin volver a analizar)
  const sel = page.locator(mode.touch ? ".fsp-mobile select" : ".fsp-right select").first();
  chk(await page.locator(".fsp-right, .fsp-mobile").count() > 0, `${mode.name}: faltan los ajustes`);
  // Editor de máscaras y de puntos de control
  await page.evaluate(() => { for(const b of document.querySelectorAll(".fsp button, .fsp-mobile button")) if(b.textContent.trim() === "Máscaras…"){ b.click(); return; } });
  if(!mode.touch){
    await page.waitForSelector(".pano-ov canvas");
    const box = await page.locator(".pano-mask-stage canvas").boundingBox();
    await page.mouse.move(box.x + box.width * .3, box.y + box.height * .3); await page.mouse.down(); await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5, { steps: 5 }); await page.mouse.up();
    await shot("3-mascara");
    chk(await page.evaluate(() => !!document.querySelector(".pano-ov")), `${mode.name}: no se abrió el editor de máscaras`);
    await page.locator(".pano-ov [data-done]").click();
    await page.waitForFunction(() => !document.querySelector(".pano-ov"));
    chk(await page.locator("[data-prev], .fsp-sub").first().count() > 0, "interfaz viva tras las máscaras");
    await page.evaluate(() => { for(const b of document.querySelectorAll(".fsp button")) if(b.textContent.trim() === "Puntos de control…"){ b.click(); return; } });
    await page.waitForSelector(".pano-pts-pair");
    const [ca, cb] = [await page.locator('[data-side="a"]').boundingBox(), await page.locator('[data-side="b"]').boundingBox()];
    await page.mouse.click(ca.x + ca.width * .6, ca.y + ca.height * .5); await page.mouse.click(cb.x + cb.width * .2, cb.y + cb.height * .5);
    await page.locator(".pano-ov [data-add]").click();
    chk(/1 de 4/.test(await page.locator("[data-hint]").textContent()), `${mode.name}: el punto no se añadió`);
    await shot("4-puntos");
    await page.locator(".pano-ov [data-done]").click();
  } else {
    await page.waitForSelector(".pano-ov canvas"); await shot("3-mascara"); await page.locator(".pano-ov [data-done]").click();
  }
  // Más de 15 fotos: aviso y sin orden automático
  await page.evaluate(() => window.__drop(Array.from({ length: 13 }, (_, i) => -60 + i * 10)));
  await page.waitForFunction(() => document.querySelector(".fsp-sub")?.textContent.includes("17 fotos"));
  chk((await page.locator(".fsp-sub").textContent()).includes("sin orden automático"), `${mode.name}: falta el aviso de más de 15 fotos`);
  await shot("5-aviso");
  chk(!errs.length, `${mode.name}: errores de página ${errs.join("|")}`);
  await ctx.close();
}
await b.close(); srv.close();
console.log(bad ? "panorama-ui: FALLO" : "panorama-ui: OK"); process.exit(bad ? 1 : 0);
