/* Diálogo Exportar con firma C2PA (v255): «Firmar…» carga certificado y clave, exporta JPEG, PNG y AVIF firmados; tests/c2pa_firma_check.py (ui) los valida con c2pa-python.
   También en móvil. Uso: node tests/c2pa-firma-ui.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), errs = [], R = {};
for(const mobile of [false, true]){
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, acceptDownloads: true } : { viewport: { width: 1200, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const D = await import("/js/core/doc.js");
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 48; const x = cv.getContext("2d"); const g = x.createLinearGradient(0, 0, 64, 48); g.addColorStop(0, "#f00"); g.addColorStop(1, "#00f"); x.fillStyle = g; x.fillRect(0, 0, 64, 48);
    D.newDoc(64, 48, { name: "prueba", image: cv });
    D.doc.metaEdit = { title: "", description: "", author: "Ana Firmante", copyright: "© Ana 2026", keywords: [], date: "", remove: [] };
  });
  for(const [tipo, ext] of [["image/jpeg", "jpg"], ["image/png", "png"], ["image/avif", "avif"]]){
    await page.evaluate(() => { import("/js/io/export.js").then(m => { window.__dlg = m.exportDialog(); }); });
    await page.waitForSelector("#exType", { timeout: 15000 });
    await page.evaluate(t => { const s = document.querySelector("#exType"); s.value = t; s.dispatchEvent(new Event("change", { bubbles: true })); }, tipo);
    await page.waitForTimeout(300);
    await page.selectOption("#exDest", "download");
    const visible = await page.isVisible("#exC2paRow");
    await page.click("#exC2pa"); await page.waitForSelector("#c2Cert");
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click("#c2Cert")]); await fc.setFiles("/tmp/sc/es256_certs.pem");
    const [fk] = await Promise.all([page.waitForEvent("filechooser"), page.click("#c2Key")]); await fk.setFiles("/tmp/sc/es256_private.key");
    await page.selectOption("#c2Src", "composite"); await page.check("#c2Meta");
    await page.click(".modal-foot button:has-text('Guardar')"); await page.waitForTimeout(500);
    const estado = await page.textContent("#exC2paState");
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120000 }), page.click(".modal-foot button:has-text('Exportar')")]);
    const p = `/tmp/sc/out/ui${mobile ? "m" : "d"}.${ext}`; await dl.saveAs(p);
    R[`${mobile ? "movil" : "escritorio"}_${ext}`] = { visible, estado: estado.slice(0, 60), bytes: fs.statSync(p).size };
    await page.waitForTimeout(500);
  }
  // un PNG con otro formato (WebP) no lleva la fila de firma
  await page.evaluate(() => { import("/js/io/export.js").then(m => { window.__dlg = m.exportDialog(); }); }); await page.waitForSelector("#exType");
  await page.evaluate(() => { const s = document.querySelector("#exType"); s.value = "image/webp"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await page.waitForTimeout(300);
  R[(mobile ? "movil" : "escritorio") + "_webpFila"] = await page.isVisible("#exC2paRow");
  await ctx.close();
}
console.log(JSON.stringify(R));
const ok = Object.entries(R).every(([k, v]) => k.endsWith("webpFila") ? v === false : v.visible && /Firmará: C2PA Signer/.test(v.estado) && v.bytes > 500);
console.log(ok && !errs.length ? "OK (falta c2pa_firma_check.py ui)" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
