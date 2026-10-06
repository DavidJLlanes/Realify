/* Restaurar caras con el modelo REAL (GFPGAN, local): abre una foto con cara, aplica y guarda original y resultado para mirarlos; comprueba que la capa nueva
   sólo cambia dentro de una zona ovalada alrededor de la cara (nada de cuadrado) y que fuera de ella queda IGUAL que la foto.
   Uso: node tests/restaurar-caras.mjs <foto con cara> [carpeta de salida] */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), [photo, outDir = "/tmp"] = process.argv.slice(2);
if(!photo){ console.log("Uso: node tests/restaurar-caras.mjs <foto.jpg> [salida]"); process.exit(2); }
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".onnx": "application/octet-stream" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch({ args: ["--disable-dev-shm-usage"] }), page = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage(), errs = [];
page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if(/error|fall/i.test(m.text())) console.log("consola:", m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const watcher = setInterval(async () => { try{ const bt = page.locator("button:visible", { hasText: /^(Descargar|Probar otra vez|Continuar)$/ }); if(await bt.count()) await bt.first().click({ timeout: 1000 }); }catch{} }, 700);
await page.setInputFiles("#filePicker", photo); await page.waitForTimeout(2500);
await page.evaluate(() => { import("/js/features/facetools.js").then(m => m.openFaceRestore()); });
const apply = page.locator("button:visible", { hasText: /^Aplicar$/ }); await apply.first().waitFor({ timeout: 240000 });
await page.waitForTimeout(500); await page.screenshot({ path: path.join(outDir, "restaurar-dialogo.png") });
await apply.first().click(); await page.waitForTimeout(2500);
const res = await page.evaluate(() => import("/js/core/doc.js").then(D => {
  const L = D.doc.layers, base = L[0], top = L[L.length - 1], W = D.doc.w, H = D.doc.h;
  const get = l => l.canvas.getContext("2d").getImageData(0, 0, W, H).data, a = get(base), c = get(top);
  let minx = W, miny = H, maxx = -1, maxy = -1, n = 0, alpha = 0;
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4; if(c[i + 3] > 0){ alpha++; if(Math.abs(c[i] - a[i]) + Math.abs(c[i + 1] - a[i + 1]) + Math.abs(c[i + 2] - a[i + 2]) > 6){ n++; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); } } }
  const rect = (maxx - minx + 1) * (maxy - miny + 1);
  const mk = l => { const o = document.createElement("canvas"); o.width = W; o.height = H; o.getContext("2d").drawImage(l.canvas, 0, 0); return o.toDataURL("image/png"); };
  return { layers: L.length, name: top.name, W, H, alpha, changed: n, bbox: [minx, miny, maxx, maxy], fill: +(n / Math.max(1, rect)).toFixed(3), orig: mk(base), out: mk(top) };
}));
fs.writeFileSync(path.join(outDir, "restaurar-original.png"), Buffer.from(res.orig.split(",")[1], "base64")); fs.writeFileSync(path.join(outDir, "restaurar-resultado.png"), Buffer.from(res.out.split(",")[1], "base64")); delete res.orig; delete res.out;
console.log(JSON.stringify(res));
// un óvalo ocupa π/4 ≈ 0,785 de su caja; un cuadrado, ≈ 1
const ok = res.layers >= 2 && res.changed > 0 && res.fill < 0.9 && !errs.length;
console.log(ok ? "OK" : "FALLO", errs.join("|")); clearInterval(watcher); await b.close(); srv.close(); process.exit(ok ? 0 : 1);
