/* Prueba de «Panorámica» en el dispositivo (v287): cuatro vistas sintéticas de una escena con textura, tomadas girando la cámara (giro puro)
   con focal y ángulos conocidos y entregadas desordenadas. Debe encontrar las cuatro (también con la escena casi sin contraste), estimar la focal con un error < 1 % (y aplicar el ajuste de haces) y devolver
   un mosaico ancho sin errores de página.
   Uso: node tests/panorama-local.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs", "/opt/npm-tools/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(); page.setDefaultTimeout(0);
const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
await page.evaluate(() => setInterval(() => { const bt = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Descargar"); if(bt) bt.click(); }, 400));

const res = await page.evaluate(async () => {
  const S = await import("/plugins/panorama/stitch.js"), { loadOpenCv } = await import("/js/cv/opencv.js"), R = await import("/plugins/panorama/rotation.js");
  const W = 960, H = 640, F = 760, YAWS = [-36, -12, 12, 36];
  const hash = (x, y) => { let v = Math.imul(x * 73856093 ^ y * 19349663, 0x85ebca6b); v ^= v >>> 13; v = Math.imul(v, 0xc2b2ae35); v ^= v >>> 16; return (v >>> 0) / 4294967296; };
  // Escena cilíndrica: valor a partir del ángulo (acimut) y la altura; ruido de valor a varias escalas
  const noise = (u, v) => { const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y, s = t => t * t * (3 - 2 * t);
    const a = hash(x, y), b2 = hash(x + 1, y), c = hash(x, y + 1), d = hash(x + 1, y + 1);
    return a + (b2 - a) * s(fx) + (c - a) * s(fy) + (a - b2 - c + d) * s(fx) * s(fy); };
  let CONTRAST = 1, NOISE = 0, seed = 5; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const scene = (az, ty) => 0.5 + CONTRAST * (0.15 + 0.85 * (0.5 * noise(az * 60, ty * 60) + 0.3 * noise(az * 150, ty * 150) + 0.2 * noise(az * 400, ty * 400)) - 0.5) + (NOISE ? (rnd() + rnd() + rnd() - 1.5) * NOISE / 255 * 2 : 0);
  const view = yaw => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d", { willReadFrequently: true }), im = x.createImageData(W, H), y0 = yaw * Math.PI / 180;
    for(let j = 0; j < H; j++) for(let i = 0; i < W; i++){ const px = (i - W / 2) / F, py = (j - H / 2) / F, az = y0 + Math.atan(px), ty = py / Math.hypot(1, px), v = Math.round(255 * scene(az, ty)), o = 4 * (j * W + i); im.data[o] = v; im.data[o + 1] = v * 0.92; im.data[o + 2] = v * 0.85; im.data[o + 3] = 255; }
    x.putImageData(im, 0, 0); return c; };
  const order = [2, 0, 3, 1], cans = order.map(k => view(YAWS[k]));
  const { cv } = await loadOpenCv();
  const cam = await R.solveCamera(cv, cans, {});
  const out = await S.stitchLocal(cans, { premium: false, autoCrop: true });
  // Opciones avanzadas: cada proyección y mezcla produce un mosaico válido
  const opts = {};
  for(const projection of ["rect", "stereo", "sph"]){ const o = await S.stitchLocal(cans, { projection, blend: "seam", lens: false, exposure: false, autoOrder: false }); opts[projection] = [o.width, o.height]; }
  // Misma escena con muy poco contraste y ruido: el estirado de contraste debe permitir colocar las cuatro
  CONTRAST = 0.12; NOISE = 3; const flat = order.map(k => view(YAWS[k])), cam2 = await R.solveCamera(cv, flat, {});
  return { f: cam.f, F, ba: !!cam.ba?.used, found: cam.found.filter(Boolean).length, order: cam.order, size: [out.width, out.height], flatFound: cam2.found.filter(Boolean).length, flatF: cam2.f, opts };
});
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
console.log(JSON.stringify(res));
chk(res.found === 4, "no se colocaron las cuatro vistas");
chk(res.ba, "el ajuste de haces no se aplicó");
chk(res.flatFound === 4 && Math.abs(res.flatF - res.F) / res.F < 0.03, `con poco contraste se colocaron ${res.flatFound} de 4 (focal ${res.flatF.toFixed(0)} frente a ${res.F})`);
chk(Math.abs(res.f - res.F) / res.F < 0.01, `focal estimada ${res.f.toFixed(0)} frente a ${res.F}`);
chk(res.size[0] > res.size[1] * 1.5, "el mosaico debería ser claramente más ancho que alto");
for(const p of ["rect", "stereo", "sph"]) chk(res.opts[p] && res.opts[p][0] > 200 && res.opts[p][1] > 100, `proyección ${p}: mosaico ${res.opts[p]}`);
chk(!errs.length, "errores de página: " + errs.join("|"));
await b.close(); srv.close(); console.log(bad ? "panorama-local: FALLO" : "panorama-local: OK"); process.exit(bad ? 1 : 0);
