/* Prueba de la máscara por profundidad «viva» (v250) con Depth Anything real (assets/models/depthanything, sin descargas): una capa de ajuste con
   su máscara por profundidad; si no cambia nada, no se recalcula; si la foto de debajo cambia (se voltea), la máscara se recalcula sola; sin
   «mantener al día» no; y la capa guarda y restaura los parámetros en el proyecto. Uso: node tests/depth-viva.mjs <foto.jpg> */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const foto = process.argv[2]; if(!foto){ console.log("Uso: node tests/depth-viva.mjs <foto.jpg>"); process.exit(2); }
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".onnx": "application/octet-stream" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p === "/__foto.jpg"){ r.writeHead(200, { "Content-Type": "image/jpeg" }); fs.createReadStream(foto).pipe(r); return; }
  if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(); page.setDefaultTimeout(0); const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
// El aviso de descarga del modelo (50 MB, desde este mismo servidor) se acepta solo
await page.evaluate(() => setInterval(() => { const bt = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Descargar"); if(bt) bt.click(); }, 400));
const res = await page.evaluate(async () => {
  const D = await import("/js/core/doc.js"), L = await import("/js/features/depthlive.js"), Z = await import("/js/features/depthzones.js"), DM = await import("/js/ai/depth.js"), MK = await import("/js/editor/masks.js"), P = await import("/js/io/project.js");
  const img = new Image(); img.src = "/__foto.jpg"; await img.decode();
  const W = 640, H = Math.round(640 * img.height / img.width);
  D.newDoc(W, H, { name: "viva" }); const base = D.doc.layers[0]; base.ctx.drawImage(img, 0, 0, W, H);
  const adj = D.addLayer({ type: "adjust", name: "Ajuste" });
  const hashOf = l => { const d = l.mask.ctx.getImageData(0, 0, W, H).data; let h = 0, s = 0; for(let i = 0; i < d.length; i += 4){ h = (h * 31 + d[i]) | 0; s += d[i]; } return { h, mean: s / (d.length / 4) }; };
  const out = {};
  // 1. máscara inicial «primer plano» sobre lo que hay debajo
  const src = await L.liveSource(adj), map = await DM.depthMap(src), field = Z.depthField(src, map);
  const arr = await Z.fieldToArray(field, u => u > 0.66 ? 1 : 0);
  MK.setMaskFromArray(adj, arr, "Máscara por profundidad");
  L.makeLive(adj, { zone: "near", from: 0, to: 33, soft: 6, invert: false, auto: true }, L.signature(src));
  out.vivaTrasPoner = L.isLive(adj); out.m0 = hashOf(adj); const mask0 = adj.mask;
  // 2. sin cambios: no se toca
  await L.checkNow(); out.sinCambios = adj.mask === mask0;
  // 3. cambia la foto de debajo (volteada en vertical): se recalcula
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.translate(0, H); x.scale(1, -1); x.drawImage(base.canvas, 0, 0);
  base.ctx.clearRect(0, 0, W, H); base.ctx.drawImage(c, 0, 0);
  const t0 = performance.now(); await L.checkNow(); out.ms = Math.round(performance.now() - t0);
  out.m1 = hashOf(adj); out.sigue = L.isLive(adj); out.zona = adj.depthMask.zone;
  // 4. sin «mantener al día» no se recalcula
  adj.depthMask.auto = false; const mask1 = adj.mask;
  x.clearRect(0, 0, W, H); x.drawImage(img, 0, 0, W, H); base.ctx.clearRect(0, 0, W, H); base.ctx.drawImage(c, 0, 0);
  await L.checkNow(); out.manual = adj.mask === mask1;
  // 5. proyecto
  const ser = await P.serializeProject(); const saved = ser.document.layers.find(l => l.depthMask);
  out.guardado = saved ? { zone: saved.depthMask.zone, auto: saved.depthMask.auto, soft: saved.depthMask.soft, sinFirma: !("sig" in saved.depthMask) } : null;
  await P.restoreProject(ser); const r = D.doc.layers.find(l => l.depthMask);
  out.restaurado = r ? { zone: r.depthMask.zone, auto: r.depthMask.auto, viva: L.isLive(r) } : null;
  // 6. máscara nueva por otro camino: deja de ser viva
  if(r){ MK.setMaskFromArray(r, new Uint8ClampedArray(W * H).fill(255), "Otra"); out.sueltaAlCambiar = !r.depthMask; }
  return out;
});
console.log(JSON.stringify(res));
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
chk(res.vivaTrasPoner, "la máscara debe quedar viva"); chk(res.sinCambios, "sin cambios no debe recalcular");
chk(res.m1.h !== res.m0.h, "al cambiar la foto la máscara debe cambiar"); chk(res.sigue && res.zona === "near", "sigue viva con su zona");
chk(res.manual, "sin «mantener al día» no debe recalcular");
chk(res.guardado && res.guardado.zone === "near" && res.guardado.auto === false && res.guardado.sinFirma, "se guarda en el proyecto sin la firma");
chk(res.restaurado && res.restaurado.viva && res.restaurado.zone === "near", "se restaura viva"); chk(res.sueltaAlCambiar, "otra máscara la suelta");
chk(!errs.length, "errores de página: " + errs.join("|"));
await b.close(); srv.close(); console.log(bad ? "depth-viva: FALLO" : "depth-viva: OK"); process.exit(bad ? 1 : 0);
