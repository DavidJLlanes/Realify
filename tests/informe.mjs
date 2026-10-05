/* Prueba del informe de errores (fase 18): el diálogo de Ayuda y el botón del panel de arranque envían lo correcto a
   /api/informe (interceptado), en escritorio y móvil, y el vigilante anota archivo y código HTTP.
   Uso: node tests/informe.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright","/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".wasm":"application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type":T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${srv.address().port}/`, b = await chromium.launch();
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
for(const mobile of [false, true]){
  const mode = mobile ? "móvil" : "escritorio";
  const ctx = await b.newContext(mobile ? { viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true } : { viewport:{ width:1280, height:800 } });
  const page = await ctx.newPage(), errs = [], sent = [];
  page.on("pageerror", e => errs.push(e.message));
  let mode429 = false;
  await page.route("**/api/informe", async route => { sent.push(JSON.parse(route.request().postData())); await route.fulfill({ status: mode429 ? 429 : 200, contentType:"application/json", body:'{"ok":true}' }); });
  await page.goto(BASE); await page.waitForTimeout(1200);
  await page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(300, 200, { name:"secreto.jpg" }); const l = D.addLayer({ name:"Fondo" }); l.ctx.fillStyle = "#2a7"; l.ctx.fillRect(0, 0, 300, 200); });
  page.evaluate(() => import("/js/ui/commands.js").then(m => m.run("help.report"))).catch(e => errs.push(String(e)));
  await page.waitForTimeout(900);
  // sin texto: no envía
  await page.click("#brSend"); chk(sent.length === 0, `${mode}: no debe enviar sin mensaje`);
  await page.fill("#brMsg", "No abre mi PSD de 40 MB"); await page.fill("#brMail", "malcorreo"); await page.click("#brSend");
  chk(sent.length === 0, `${mode}: correo inválido no se envía`);
  await page.fill("#brMail", "yo@example.com");
  const diag = await page.inputValue("#brDiagText");
  chk(/Documento: 300×200 px, 2 capas/.test(diag) && !/secreto/.test(diag), `${mode}: el diagnóstico lleva el estado del documento y NO el nombre del archivo`);
  await page.click("#brSend"); await page.waitForTimeout(500);
  chk(sent.length === 1, `${mode}: se envía una vez`);
  const s = sent[0] || {};
  chk(s.mensaje === "No abre mi PSD de 40 MB" && s.correo === "yo@example.com" && s.diag.includes("Diagnóstico de Realify") && !s.imagen && s.sitio === "", `${mode}: carga útil ${JSON.stringify(Object.keys(s))}`);
  chk(/Enviado/.test(await page.textContent("#brStatus")), `${mode}: confirmación`);
  // segunda vez: sin diagnóstico y con imagen
  await ctx.close();
  const ctx2 = await b.newContext(mobile ? { viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true } : { viewport:{ width:1280, height:800 } });
  const p2 = await ctx2.newPage(), sent2 = []; p2.on("pageerror", e => errs.push(e.message));
  await p2.route("**/api/informe", async route => { sent2.push(JSON.parse(route.request().postData())); await route.fulfill({ status:429, body:"{}" }); });
  await p2.goto(BASE); await p2.waitForTimeout(1200);
  await p2.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(300, 200, { name:"x" }); const l = D.addLayer({ name:"Fondo" }); l.ctx.fillStyle = "#c33"; l.ctx.fillRect(0, 0, 300, 200); });
  p2.evaluate(() => import("/js/ui/commands.js").then(m => m.run("help.report"))).catch(() => {});
  await p2.waitForTimeout(900);
  await p2.fill("#brMsg", "Otro problema distinto"); await p2.uncheck("#brDiag"); await p2.check("#brImg"); await p2.click("#brSend"); await p2.waitForTimeout(500);
  const t = sent2[0] || {};
  chk(t.diag === "" && t.imagen && Buffer.from(t.imagen, "base64")[0] === 0xFF, `${mode}: sin diagnóstico y con imagen JPEG`);
  chk(/varios informes/.test(await p2.textContent("#brStatus")) && await p2.locator("#brCopy").count() === 1, `${mode}: 429 → aviso y botón Copiar`);
  chk(errs.length === 0, `${mode}: errores de página ${errs}`);
  console.log(mode, "OK");
  await ctx2.close();
}
/* Panel de arranque: main.js da 404 → el vigilante anota el archivo y el código; «Enviar informe» pregunta antes */
{
  const ctx = await b.newContext({ viewport:{ width:1000, height:700 } }), page = await ctx.newPage(), sent = [];
  await page.addInitScript(() => { try{ sessionStorage.setItem("realify.repaired", "1"); }catch{} });
  await page.route(/js\/main\.js/, r => r.fulfill({ status:404, body:"no" }));
  await page.route("**/api/informe", async route => { sent.push(JSON.parse(route.request().postData())); await route.fulfill({ status:200, body:'{"ok":true}' }); });
  let asked = 0; page.on("dialog", d => { asked++; d.accept(); });
  await page.goto(BASE); await page.waitForSelector('[data-a="send"]', { timeout: 20000 });
  const diag = await page.evaluate(() => window.__realifyDiag());
  chk(/main\.js/.test(diag), "panel: el diagnóstico nombra main.js: " + diag.split("Errores")[1]);
  await page.click('[data-a="send"]'); await page.waitForTimeout(600);
  chk(asked === 1 && sent.length === 1 && sent[0].diag.includes("main.js") && !sent[0].imagen && !sent[0].correo, `panel: pregunta y envía sólo el diagnóstico (${asked}, ${sent.length})`);
  console.log("panel de arranque OK");
  await ctx.close();
}
await b.close(); srv.close();
console.log(bad ? "informe: FALLO" : "informe: OK"); process.exit(bad ? 1 : 0);
