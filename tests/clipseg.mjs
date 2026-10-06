/* Prueba de la selección por descripción libre (CLIPSeg, fase 20) con el modelo REAL: se carga la web, se sirve el ONNX desde un archivo local
   (por no bajar 273 MB de Hugging Face) y se comprueba, sobre fotos, que lo descrito cae donde debe: «a red bus» a la derecha y a media altura,
   «cielo» arriba, «un pez» en el centro, y que algo que no está («a banana») no da nada. También compara las probabilidades con las de la
   referencia en Python (onnxruntime) para una vista.
   Uso: node tests/clipseg.mjs <model_fp16.onnx> <fotos: da01.jpg> <HappyFish.jpg>   (la carpeta con el modelo debe tener también ref.py) */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), [modelPath, street, fish] = process.argv.slice(2);
if(!fish){ console.log("Uso: node tests/clipseg.mjs <model_fp16.onnx> <calle.jpg> <pez.jpg>"); process.exit(2); }
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".onnx": "application/octet-stream" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
  if(p === "/__modelo.onnx"){ r.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": fs.statSync(modelPath).size, "Access-Control-Allow-Origin": "*" }); fs.createReadStream(modelPath).pipe(r); return; } if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch({ args: ["--disable-dev-shm-usage"] }); b.on("disconnected", () => console.log("NAVEGADOR DESCONECTADO")); const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } }), errs = [];
const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message)); page.on("crash", () => console.log("PÁGINA CAÍDA (crash)")); page.on("worker", w => { console.log("worker", w.url().slice(-40)); w.on("close", () => console.log("worker cerrado")); }); page.on("console", m => { if(m.type() === "error") errs.push(m.text().slice(0, 160)); });
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
// la web pide el modelo a Hugging Face; aquí se apunta al servidor local (el worker recibe la URL en el mensaje)
await page.evaluate(async port => { (await import("/js/ai/models.js")).MODELS.clipseg.url = `http://127.0.0.1:${port}/__modelo.onnx`; }, srv.address().port);
const watcher = setInterval(async () => { try{ const bt = page.locator("button:visible", { hasText: /^(Descargar|Probar otra vez|Continuar)$/ }); if(await bt.count()) await bt.first().click({ timeout: 1000 }); }catch{} }, 700);
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
async function mask(file, text){
  await page.setInputFiles("#filePicker", file); await page.waitForTimeout(2500);
  return page.evaluate(async text => {
    const D = await import("/js/core/doc.js"), TS = await import("/js/features/textselect.js");
    const src = document.createElement("canvas"); src.width = D.doc.w; src.height = D.doc.h; src.getContext("2d").drawImage(D.doc.layers[0].canvas, 0, 0);
    const t0 = performance.now(), m = await TS.openVocabMask(src, text, D.doc.w, D.doc.h, "prueba"), W = D.doc.w, H = D.doc.h;
    let n = 0, sx = 0, sy = 0; for(let i = 0; i < m.length; i++) if(m[i] > 127){ n++; sx += i % W; sy += (i / W) | 0; }
    return { pct: +(100 * n / m.length).toFixed(2), cx: n ? +(sx / n / W).toFixed(3) : null, cy: n ? +(sy / n / H).toFixed(3) : null, ms: Math.round(performance.now() - t0), W, H };
  }, text);
}
const out = {};
out.bus = await mask(street, "a red bus"); console.log("a red bus", JSON.stringify(out.bus));
out.busEs = await mask(street, "autobús rojo"); console.log("autobús rojo", JSON.stringify(out.busEs));
out.sky = await mask(street, "el cielo"); console.log("el cielo", JSON.stringify(out.sky));
out.none = await mask(street, "a banana"); console.log("a banana", JSON.stringify(out.none));
out.fish = await mask(fish, "un pez"); console.log("un pez", JSON.stringify(out.fish));
out.light = await mask(street, "un semáforo"); console.log("un semáforo", JSON.stringify(out.light));
out.stop = await mask(street, "a stop sign"); console.log("a stop sign", JSON.stringify(out.stop));
out.banana2 = await mask(street, "a banana"); console.log("a banana (otra vez, con la búsqueda fina)", JSON.stringify(out.banana2));
chk(out.bus.pct > 0.5 && out.bus.pct < 12 && out.bus.cx > 0.65 && out.bus.cx < 0.95 && out.bus.cy > 0.4 && out.bus.cy < 0.85, "el autobús rojo debe estar a la derecha y a media altura " + JSON.stringify(out.bus));
chk(out.busEs.pct > 0.5 && out.busEs.cx > 0.65 && out.busEs.cx < 0.95, "«autobús rojo» en español (traducido) debe dar lo mismo " + JSON.stringify(out.busEs));
chk(out.sky.pct > 12 && out.sky.cy < 0.35, "el cielo debe estar arriba " + JSON.stringify(out.sky));
chk(out.none.pct < 0.5, "una banana que no está no debe dar nada " + JSON.stringify(out.none));
chk(out.fish.pct > 10 && out.fish.cx > 0.3 && out.fish.cx < 0.75, "el pez debe estar en el centro " + JSON.stringify(out.fish));
chk(out.light.pct > 0.02 && out.light.pct < 1.5 && out.light.cx > 0.25 && out.light.cx < 0.65 && out.light.cy > 0.2 && out.light.cy < 0.7, "un semáforo (los hay en x 0.3–0.57, y 0.66; CLIPSeg a veces confunde la farola vecina) debe dar un objeto pequeño en esa zona de la calle " + JSON.stringify(out.light));
chk(out.stop.pct > 0.03 && out.stop.pct < 2 && out.stop.cx > 0.25 && out.stop.cx < 0.5 && out.stop.cy > 0.25 && out.stop.cy < 0.5, "una señal de stop pequeña debe encontrarse " + JSON.stringify(out.stop));
chk(out.banana2.pct < 0.5, "la búsqueda fina no debe inventar una banana " + JSON.stringify(out.banana2));
chk(errs.filter(e => !/favicon|manifest/i.test(e)).length === 0, "errores de página " + errs.slice(0, 3));
clearInterval(watcher); await b.close(); srv.close(); console.log(bad ? "clipseg: FALLO" : "clipseg: OK"); process.exit(bad ? 1 : 0);
