/* Prueba de «Seleccionar por texto» con partes de la cara (BiSeNet, fase 20): sobre una foto con una cara, «pelo» debe quedar
   por encima de la cara, «ojos» y «labios» deben ser pequeñas y estar dentro del óvalo, y «cara sin ojos» debe restar.
   Uso: node tests/textoparte.mjs <foto-con-cara.jpg> [salida.png] */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), photo = process.argv[2], outPng = process.argv[3];
if(!photo){ console.log("Uso: node tests/textoparte.mjs <foto.jpg>"); process.exit(2); }
let chromium; for(const s of ["playwright","/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".wasm":"application/wasm", ".onnx":"application/octet-stream", ".mjs":"text/javascript" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type":T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage({ viewport:{ width:1200, height:800 } }), errs = [];
page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1200);
// El modelo pide confirmar la descarga/uso: se acepta solo
const watcher = setInterval(async () => { try{ const bt = page.locator("button:visible", { hasText: /^(Descargar|Probar otra vez|Continuar)$/ }); if(await bt.count()) await bt.first().click({ timeout: 1000 }); }catch{} }, 700);
await page.setInputFiles("#filePicker", photo); await page.waitForTimeout(2000);
const res = await page.evaluate(async () => {
  const D = await import("/js/core/doc.js"), TS = await import("/js/features/textselect.js"), TX = await import("/js/ai/textclasses.js");
  const src = document.createElement("canvas"); src.width = D.doc.w; src.height = D.doc.h; src.getContext("2d").drawImage(D.doc.layers[0].canvas, 0, 0);
  const W = D.doc.w, H = D.doc.h, o = { W, H }, masks = {};
  for(const q of ["pelo", "ojos", "labios", "cara", "orejas", "cuello", "cejas"]){
    const p = TX.parseQuery(q); if(!p.terms[0]?.parts){ o[q] = "no reconocido"; continue; }
    const m = await TS.facePartsMask(src, p.terms[0].parts, W, H, "prueba");
    let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0, sx = 0, sy = 0;
    for(let i = 0; i < m.length; i++) if(m[i] > 127){ n++; const x = i % W, y = (i / W) | 0; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; sx += x; sy += y; }
    o[q] = { pct: +(100 * n / m.length).toFixed(2), box: [x0, y0, x1, y1], cx: n ? Math.round(sx / n) : null, cy: n ? Math.round(sy / n) : null };
    masks[q] = m;
  }
  // imagen de comprobación: foto + pelo (rojo) + ojos (verde) + labios (azul)
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.drawImage(src, 0, 0);
  const im = x.getImageData(0, 0, W, H), d = im.data;
  for(const [q, ch] of [["pelo", 0], ["ojos", 1], ["labios", 2], ["orejas", 1], ["cuello", 2]]) if(masks[q]) for(let i = 0; i < masks[q].length; i++){ const a = masks[q][i] / 255 * .6; d[i * 4 + ch] = d[i * 4 + ch] * (1 - a) + 255 * a; }
  x.putImageData(im, 0, 0); o.png = c.toDataURL("image/png").split(",")[1];
  // la cara detectada para comparar
  const { detectFaces } = await import("/js/ai/faces.js"); o.faces = (await detectFaces(src)).map(f => [Math.round(f.x), Math.round(f.y), Math.round(f.w), Math.round(f.h)]);
  return o;
});
if(outPng) fs.writeFileSync(outPng, Buffer.from(res.png, "base64")); delete res.png;
console.log(JSON.stringify(res, null, 1));
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
const f = res.faces[0]; chk(!!f, "no se detectó la cara");
if(f){
  const [fx, fy, fw, fh] = f;
  chk(res["pelo"].pct > 0.5 && res["pelo"].box[1] < fy + fh * 0.35 && res["pelo"].box[0] < fx + fw && res["pelo"].box[2] > fx, `el pelo debe empezar sobre la frente y tocar la cara (caja=${res["pelo"].box}, cara=${fx},${fy},${fw},${fh})`);
  chk(res["ojos"].pct > 0.01 && res["ojos"].pct < res["cara"].pct * 0.25 && res["ojos"].cx > fx && res["ojos"].cx < fx + fw, "ojos pequeños y dentro de la cara");
  chk(res["labios"].pct > 0.005 && res["labios"].cy > fy + fh * 0.55 && res["labios"].cy < fy + fh * 1.1, `labios en el tercio inferior (cy=${res["labios"].cy})`);
  chk(res["cara"].pct > res["ojos"].pct && res["cara"].pct > res["labios"].pct, "la cara es mayor que ojos y labios");
  chk(res["cuello"].cy > res["labios"].cy, "el cuello está bajo los labios");
}
chk(errs.length === 0, "errores de página " + errs);
clearInterval(watcher); await b.close(); srv.close(); console.log(bad ? "textoparte: FALLO" : "textoparte: OK"); process.exit(bad ? 1 : 0);
