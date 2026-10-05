/* Prueba de la panorámica precisa (unir/precise.js, v251): tres fotos tomadas «a pulso» (recortes de una foto grande con un pequeño giro, un cambio de escala y
   medio píxel de desplazamiento) se colocan con homografías de OpenCV y se comparan con la colocación entera de siempre (sin proyección): el desajuste medio en
   los solapes debe ser claramente menor. Uso: node tests/unir-preciso.mjs <foto.jpg> */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const foto = process.argv[2]; if(!foto){ console.log("Uso: node tests/unir-preciso.mjs <foto.jpg>"); process.exit(2); }
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p === "/__foto.jpg"){ r.writeHead(200, { "Content-Type": "image/jpeg" }); fs.createReadStream(foto).pipe(r); return; }
  if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(); page.setDefaultTimeout(0); const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
await page.evaluate(() => setInterval(() => { const bt = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Descargar"); if(bt) bt.click(); }, 400));
const res = await page.evaluate(async () => {
  const img = new Image(); img.src = "/__foto.jpg"; await img.decode();
  const { loadOpenCv } = await import("/js/cv/opencv.js"), lib = await loadOpenCv(), P = await import("/unir/precise.js"), E = await import("/unir/engine.js");
  const big = document.createElement("canvas"); big.width = img.width; big.height = img.height; big.getContext("2d").drawImage(img, 0, 0);
  // Tres «disparos»: ventana de 62 % del ancho, desplazada, con giro y escala distintos
  const SW = Math.round(img.width * 0.62), SH = Math.round(img.height * 0.9), shot = (cx, rot, sc) => {
    const c = document.createElement("canvas"); c.width = SW; c.height = SH; const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high";
    x.translate(SW / 2, SH / 2); x.rotate(rot * Math.PI / 180); x.scale(sc, sc); x.translate(-cx, -img.height / 2); x.drawImage(big, 0, 0); return c;
  };
  const shots = [shot(img.width * 0.31, 0, 1), shot(img.width * 0.5 + 0.5, 1.4, 1.02), shot(img.width * 0.69, -1.1, 0.985)];
  const lum = (d, i) => d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722;
  // Desajuste medio en los solapes de fotos contiguas (imágenes RGBA con alfa, posiciones enteras)
  const mis = (imgs, pos) => { let tot = 0, n = 0;
    for(let k = 1; k < imgs.length; k++){ const a = imgs[k - 1], b = imgs[k], dx = Math.round(pos[k].x - pos[k - 1].x), dy = Math.round(pos[k].y - pos[k - 1].y);
      const x0 = Math.max(0, dx), x1 = Math.min(a.w, dx + b.w), y0 = Math.max(0, dy), y1 = Math.min(a.h, dy + b.h);
      for(let y = y0 + 8; y < y1 - 8; y += 2) for(let x = x0 + 8; x < x1 - 8; x += 2){ const ia = (y * a.w + x) * 4, ib = ((y - dy) * b.w + (x - dx)) * 4; if(a.data[ia + 3] < 250 || b.data[ib + 3] < 250) continue; tot += Math.abs(lum(a.data, ia) - lum(b.data, ib)); n++; } }
    return n ? tot / n : NaN; };
  const asImg = c => ({ w: c.width, h: c.height, data: c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.map(v => v) });
  // Colocación de siempre (sin proyección, posiciones enteras)
  const plain = shots.map(asImg).map(i => ({ ...i, data: (() => { const d = new Uint8ClampedArray(i.data); for(let k = 3; k < d.length; k += 4) d[k] = 255; return d; })() }));
  const L = E.layout(plain, "h"); const antes = mis(plain, L.pos);
  // Precisa
  const t0 = performance.now(); const r = await P.placeMosaic(lib.cv, shots, { side: 4000, maxArea: 60e6, interp: "lanczos" }); const ms = Math.round(performance.now() - t0);
  if(r.error) return { error: r.error };
  const despues = mis(r.images.map(i => ({ w: i.w, h: i.h, data: i.data })), r.images.map(i => ({ x: i.x, y: i.y })));
  // Mosaico final con el motor de siempre
  const set = r.images.map(i => ({ w: i.w, h: i.h, data: i.data })), Lp = E.placed(set, r.images.map(i => ({ x: i.x, y: i.y }))), out = E.compose(set, Lp, { blend: 40, useGain: true, crop: true });
  return { antes, despues, ms, found: r.found, mosaico: [out.w, out.h], fotos: r.images.length };
});
console.log(JSON.stringify(res));
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
chk(!res.error, "error: " + res.error); if(!res.error){ chk(res.fotos === 3 && res.found.every(Boolean), "deben encontrarse las tres fotos"); chk(res.despues < res.antes * 0.7, `el desajuste en los solapes debe bajar claramente (${res.despues.toFixed(2)} vs ${res.antes.toFixed(2)})`); chk(res.mosaico[0] > 400 && res.mosaico[1] > 200, "mosaico razonable"); }
chk(!errs.length, "errores de página: " + errs.join("|"));
await b.close(); srv.close(); console.log(bad ? "unir-preciso: FALLO" : "unir-preciso: OK"); process.exit(bad ? 1 : 0);
