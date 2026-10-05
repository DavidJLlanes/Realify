/* Prueba de «Apilar fotos» (v251): tres RAW (DNG sintéticos) de la misma escena, la segunda toma nítida, la primera movida de foco y la tercera nítida y
   desplazada. Con «Referencia: la toma más aguda» el apilado debe elegir la nítida como referencia (se avisa con su nombre) y admitir RAW directamente.
   Uso: node tests/apilar.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }), page = await b.newPage(); page.setDefaultTimeout(0);
const errs = []; page.on("pageerror", e => errs.push(e.message)); const toasts = []; page.on("console", m => { if(/\[toast\]/.test(m.text())) toasts.push(m.text()); });
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
await page.evaluate(() => setInterval(() => { const bt = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Descargar"); if(bt) bt.click(); }, 400));
// Tres DNG en memoria (el navegador los entrega por el selector de archivos)
const dngs = await page.evaluate(async () => {
  const { colorDng } = await import("/raw/tests/dng-color-fixture.js");
  const W = 320, H = 224, h = (x, y) => { let v = Math.imul(x * 73856093 ^ y * 19349663, 0x85ebca6b); v ^= v >>> 13; v = Math.imul(v, 0xc2b2ae35); v ^= v >>> 16; return (v >>> 0) / 4294967296; };
  const tex = (x, y) => 0.25 + 0.5 * (Math.sin(x / 9) * Math.sin(y / 7) * 0.5 + 0.5) * 0.6 + 0.3 * h(x >> 1, y >> 1);
  const blur = (x, y) => { let s = 0; for(let j = -3; j <= 3; j++) for(let i = -3; i <= 3; i++) s += tex(x + i, y + j); return s / 49; };
  const make = (f, dx, dy) => Array.from(colorDng(W, H, (x, y) => { const v = f(x + dx, y + dy); return [v, v * 0.9, v * 0.8]; }));
  return [make(blur, 0, 0), make(tex, 0, 0), make(tex, 3, 2)];
});
await page.evaluate(() => { const o = console.log; window.__toasts = []; });
const names = ["a_desenfocada.dng", "b_nitida.dng", "c_nitida_movida.dng"];
await page.evaluate(async () => { const m = await import("/js/features/stack.js"); window.__stack = m.openStack(); });
await page.waitForSelector(".dlg-stack-photos");
const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.locator('[data-a="files"]').click()]);
await fc.setFiles(dngs.map((d, i) => ({ name: names[i], mimeType: "image/x-adobe-dng", buffer: Buffer.from(d) })));
await page.waitForFunction(() => document.querySelectorAll(".stk-it").length === 3);
await page.locator(".dlg-stack-photos .modal-foot button.primary").click();
const msg = await page.waitForFunction(() => { const t = [...document.querySelectorAll(".toast, #toast, [class*=toast]")].map(e => e.textContent).find(x => /fotos apiladas|No se pudo apilar/.test(x || "")); return t || false; }, null, { timeout: 600000 });
const texto = await msg.jsonValue(); console.log(texto);
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
chk(/3 fotos apiladas/.test(texto), "no se apilaron las tres fotos"); chk(/referencia: «b_nitida\.dng»/.test(texto) || /referencia: «c_nitida_movida\.dng»/.test(texto), "la referencia debe ser una toma nítida (y no la desenfocada)");
chk(!errs.length, "errores de página: " + errs.join("|"));
await b.close(); srv.close(); console.log(bad ? "apilar: FALLO" : "apilar: OK"); process.exit(bad ? 1 : 0);
