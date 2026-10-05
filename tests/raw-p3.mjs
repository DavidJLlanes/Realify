/* Prueba de extremo a extremo (v249): «Revelar RAW» con Premium y «Espacio de color: Display P3» → «Abrir en Realify». El documento debe quedar en
   Display P3, con la capa en un lienzo P3, los 16 bits conservados y el invariante lienzo = redondeo de los 16 bits; con sRGB, el documento sigue en sRGB.
   Usa un DNG sintético (raw/tests/dng-color-fixture.js). Uso: node tests/raw-p3.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
for(const space of ["display-p3", "srgb"]){
  const page = await b.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
  await page.evaluate(() => { try{ localStorage.setItem("realify.premium.raw", "1"); }catch{} });
  const hasP3 = await page.evaluate(async () => (await import("/js/core/colorspace.js")).p3Supported());
  if(!hasP3){ console.log("Sin lienzos P3: prueba omitida"); await page.close(); continue; }
  await page.evaluate(async () => {
    const { colorDng } = await import("/raw/tests/dng-color-fixture.js");
    const W = 240, H = 160, scene = (x, y) => x < 120 ? [0.02, 0.45, 0.04] : [0.1, 0.12, 0.08];
    window.__file = new File([colorDng(W, H, scene)], "p3.dng");
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/raw/raw.css"; document.head.append(link);
    window.__done = import("/raw/index.js").then(m => m.openRawFile(window.__file));
  });
  await page.getByRole("button", { name: "Revelar RAW" }).click();
  await page.waitForSelector("#rawDeveloper", { timeout: 60000 });
  // Premium activo (si no lo estaba) y espacio de color
  const premium = await page.evaluate(() => { const s = document.querySelector("#rawDeveloper .raw-premium-slot input, #rawDeveloper .ps input"); return s ? s.checked : null; });
  if(premium === false) await page.locator("#rawDeveloper .raw-premium-slot .ps, #rawDeveloper .raw-premium-slot label").first().click();
  await page.waitForTimeout(500);
  await page.locator("#rawDeveloper .raw-groups button[data-group=color]").click();
  const sel = page.locator('#rawDeveloper select[data-key="space"]').first();
  chk(await sel.count() === 1, `${space}: el selector «Espacio de color» no aparece`);
  await sel.selectOption(space);
  await page.waitForTimeout(800);
  await page.locator("#rawDeveloper [data-action=accept]").click();
  await page.waitForFunction(() => !document.querySelector("#rawDeveloper"), null, { timeout: 120000 });
  await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const D = await import("/js/core/doc.js"), H = await import("/js/core/hisrc.js");
    const L = D.doc.layers.find(l => l.name === "RAW revelado") || D.doc.layers[0];
    const attrs = L.ctx.getContextAttributes();
    const o = { espacioDoc: D.doc.colorSpace, espacioLienzo: attrs.colorSpace, hi: !!L.hiSrc, w: L.canvas.width, h: L.canvas.height };
    if(L.hiSrc){ const hs = L.hiSrc, x = 60, y = 80, d = L.ctx.getImageData(x, y, 1, 1).data, j = (y * hs.w + x) * 3;
      o.invariante = [0, 1, 2].every(k => d[k] === H.hiToCanvas8(hs.data[j + k], x, y, k, hs.dither)); o.pix = [d[0], d[1], d[2]]; }
    return o;
  });
  console.log(space, JSON.stringify(r));
  chk(r.espacioDoc === space, `${space}: documento en ${r.espacioDoc}`); chk(r.espacioLienzo === space, `${space}: lienzo en ${r.espacioLienzo}`);
  chk(r.hi, `${space}: se conservan los 16 bits`); chk(r.invariante, `${space}: lienzo = redondeo de los 16 bits`);
  chk(!errs.length, `${space}: errores de página ${errs.join("|")}`);
  await page.close();
}
await b.close(); srv.close(); console.log(bad ? "raw-p3: FALLO" : "raw-p3: OK"); process.exit(bad ? 1 : 0);
