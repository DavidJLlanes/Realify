/* Prueba de «Corrección de lente automática» (v251, filter.lensAuto): con un perfil propio guardado para la cámara del documento (EXIF guardado), el comando
   corrige sin diálogo y deja una capa nueva con las esquinas aclaradas; sin perfil ni objetivo conocido, avisa y no toca nada. Uso: node tests/lente-auto.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(); page.setDefaultTimeout(0); const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const res = await page.evaluate(async () => {
  const D = await import("/js/core/doc.js"), L = await import("/js/features/lenscorrect.js"), UP = await import("/js/lens/userprofiles.js");
  const mk = (make, model) => { D.newDoc(400, 300, { name: "t", source: { exif: { make, model } } }); const l = D.doc.layers[0]; l.ctx.fillStyle = "#808080"; l.ctx.fillRect(0, 0, 400, 300); return l; };
  UP.put({ name: "Pixel prueba", match: { make: "Google", model: "Pixel Test" }, distortion: { k: [-0.05, 0, 0] }, vignette: { v: [-0.5, 0, 0] } });
  mk("Google", "Pixel Test"); const n0 = D.doc.layers.length, ok = await L.applyLensAuto(), n1 = D.doc.layers.length;
  const top = D.doc.layers[D.doc.layers.length - 1], d = top.ctx.getImageData(0, 0, 400, 300).data, px = (x, y) => d[(y * 400 + x) * 4];
  const out = { ok, capas: [n0, n1], centro: px(200, 150), esquina: px(8, 8), nombre: top.name };
  mk("Nadie", "Desconocida 9000"); const m0 = D.doc.layers.length; out.sin = { ok: await L.applyLensAuto(), capas: [m0, D.doc.layers.length] };
  return out;
});
console.log(JSON.stringify(res));
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
chk(res.ok && res.capas[1] === res.capas[0] + 1, "debe añadir una capa corregida"); chk(res.esquina > res.centro - 2 && res.centro >= 126 && res.centro <= 130, `las esquinas deben igualarse al centro (${res.esquina} vs ${res.centro})`);
chk(/Pixel prueba/.test(res.nombre), "la capa lleva el nombre del perfil"); chk(res.sin.ok === false && res.sin.capas[0] === res.sin.capas[1], "sin perfil no debe tocar nada");
chk(!errs.length, "errores de página: " + errs.join("|"));
await b.close(); srv.close(); console.log(bad ? "lente-auto: FALLO" : "lente-auto: OK"); process.exit(bad ? 1 : 0);
