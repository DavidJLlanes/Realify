/* Prueba de desenfoque, enfoque y ruido en coma flotante nativa sobre 16 bits, por el filtro real (v252): una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
   coma flotante (editor/floatadjust.js y floatfilter.js) deben calcular en 16 bits dentro del rectángulo y en 8 bits fuera, devolver el rectángulo,
   y el resultado debe ser coherente: el lienzo es el redondeo de los 16 bits dentro, y el cálculo de 8 bits fuera. Además, el guardado de proyecto
   debe conservar el rectángulo. Uso: node tests/hi-parcial.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(), errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if(/project|16 bits/.test(m.text())) console.log("consola:", m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const res = await page.evaluate(async () => {
  const D = await import("/js/core/doc.js"), H = await import("/js/core/hisrc.js"), B = await import("/js/filters/basic.js"), A = await import("/js/filters/advanced.js");
  const W = 300, Hh = 200, o = {}; D.newDoc(W, Hh, { name: "n" }); const L = D.addLayer({ name: "Fondo" });
  const hi = new Uint16Array(W * Hh * 3); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const j = (y * W + x) * 3, v = Math.round(10000 + x * 150.3 + y * 9.7); hi[j] = v; hi[j + 1] = v; hi[j + 2] = v; }
  const make = () => { const img = L.ctx.createImageData(W, Hh); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4, j = (y * W + x) * 3; for(let k = 0; k < 3; k++) img.data[i + k] = H.hiToCanvas8(hi[j + k], x, y, k, true); img.data[i + 3] = 255; } L.ctx.putImageData(img, 0, 0); L.hiSrc = { data: hi, w: W, h: Hh, dither: true, x: 0, y: 0, canvasW: W, canvasH: Hh }; };
  const run = async (fn, init) => { make(); D.setActive(L.id); const before = new Set(D.doc.layers.map(z => z.id)); const box = document.createElement("div"); document.body.appendChild(box);
    const r = await fn({ container: box, init }); await r.commit(); box.remove();
    return D.doc.layers.find(z => !before.has(z.id)); };
  const blur = await run(B.blur, { radius: 4 }); o.blur = !!blur.hiSrc && blur.hiSrc !== L.hiSrc;
  if(blur.hiSrc){ let e = 0; for(let y = 20; y < Hh - 20; y += 3) for(let x = 20; x < W - 20; x += 3) e = Math.max(e, Math.abs(blur.hiSrc.data[(y * W + x) * 3] - hi[(y * W + x) * 3])); o.errBlur = e;
    const px = blur.ctx.getImageData(0, 0, W, Hh).data; let bad = 0; for(let y = 0; y < Hh; y += 3) for(let x = 0; x < W; x += 3){ const i = (y * W + x) * 4; if(px[i] !== H.hiToCanvas8(blur.hiSrc.data[(y * W + x) * 3], x, y, 0, true)) bad++; } o.badBlur = bad; }
  const sh = await run(B.sharpen, { amount: 80, radius: 2, threshold: 0 }); o.sharpen = !!sh.hiSrc;
  if(sh.hiSrc){ let e = 0; for(let y = 20; y < Hh - 20; y += 3) for(let x = 20; x < W - 20; x += 3) e = Math.max(e, Math.abs(sh.hiSrc.data[(y * W + x) * 3] - hi[(y * W + x) * 3])); o.errSharp = e; }
  const no = await run(B.noise, { amount: 6, mono: true, gaussian: true, seed: 5 }); o.noise = !!no.hiSrc;
  if(no.hiSrc){ let fine = 0, tot = 0; for(let i = 0; i < 3000; i++){ tot++; if((no.hiSrc.data[i * 3] - hi[i * 3]) % 257) fine++; } o.fineNoise = +(fine / tot).toFixed(2); o.muestra = Array.from({length: 8}, (_, i) => no.hiSrc.data[i * 3] - hi[i * 3]); }
  const fino = l => { let f = 0, t = 0; for(let i = 0; i < 3000; i++){ t++; if((l.hiSrc.data[i * 3 + 1] - hi[i * 3 + 1]) % 257) f++; } return +(f / t).toFixed(2); };
  const dev = l => { let e = 0; for(let y = 20; y < Hh - 20; y += 3) for(let x = 20; x < W - 20; x += 3) e = Math.max(e, Math.abs(l.hiSrc.data[(y * W + x) * 3] - hi[(y * W + x) * 3])); return e; };
  for(const [k, fn, init] of [["surface", A.surfaceBlur, { radius: 6, threshold: 60 }], ["channel", A.channelDenoise, { radius: 3 }], ["smart", A.smartSharpen, { amount: 120, radius: 2, threshold: 0 }], ["lens", A.lensBlur, { radius: 6, focus: 20, range: 10 }]]){
    const l = await run(fn, init); o[k] = !!l.hiSrc; if(l.hiSrc){ o[k + "Err"] = dev(l); o[k + "Fino"] = fino(l); } }
  return o;
});
console.log(JSON.stringify(res));
const ok = res.blur && res.errBlur <= 2 && res.badBlur === 0 && res.sharpen && res.errSharp <= 4 && res.noise && res.fineNoise > 0.9 && res.surface && res.channel && res.smart && res.lens && res.surfaceErr <= 400 && res.channelErr <= 400 && res.lensErr <= 400;
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
