/* Comprueba que las funciones nuevas tienen su entrada en el cajón «Herramientas» del móvil (con icono) y en el menú.
   Uso: node tests/cajon-movil.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
await page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(300, 200, { name: "m" }); const l = D.addLayer({ name: "Fondo" }); l.ctx.fillStyle = "#2a7"; l.ctx.fillRect(0, 0, 300, 200); });
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
// 1) Entradas del cajón (ITEMS) con su icono: se leen del propio módulo
const want = [["file.exportPdf", "Exportar PDF"], ["an.meta", "Inspector de metadatos"], ["ai.textSelect", "Seleccionar por texto"], ["help.report", "Informar de un error"], ["an.strip", "Limpiar metadatos"]];
await page.locator("#toolsHandle").click({ timeout: 5000 }).catch(() => errs.push("no se pudo abrir el cajón"));
await page.waitForTimeout(700);
for(const [cmd, label] of want){
  await page.fill("#toolDrawer input[type=search], #toolDrawer input", label.split(" ")[0]).catch(() => {});
  await page.waitForTimeout(250);
  const item = page.locator("#toolDrawer .td-item", { hasText: label });
  const n = await item.count();
  chk(n >= 1, `cajón: falta «${label}» al buscar «${label.split(" ")[0]}»`);
  if(n){ const svg = await item.first().locator("svg").count(); chk(svg >= 1, `cajón: «${label}» sin icono`); }
}
// 2) Menú (móvil): las mismas entradas
const menu = await page.evaluate(async () => { const M = (await import("/js/ui/menu.js")).MENUS, out = []; const walk = a => { for(const i of a){ if(i.submenu) walk(i.submenu); else if(i.items) walk(i.items); else if(i.cmd) out.push(i.cmd); } }; walk(M); return out; });
for(const [cmd, label] of want) chk(menu.includes(cmd), `menú: falta ${cmd} (${label})`);
chk(errs.length === 0, "errores: " + errs.join("; "));
await b.close(); srv.close(); console.log(bad ? "cajón móvil: FALLO" : "cajón móvil: OK"); process.exit(bad ? 1 : 0);
