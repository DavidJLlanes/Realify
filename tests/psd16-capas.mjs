/* PSD/PSB de 16 bits con capas (v254): documento con una capa de 16 bits, máscara, grupo, estilos y ajustes → layeredPsd(hi) → tests/psd16_check.py lo lee con psd-tools: una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
  const D = await import("/js/core/doc.js"), F = await import("/js/io/professional-formats.js"), H = await import("/js/core/hisrc.js"), P = await import("/js/core/high-precision-safe.js?v=4");
  const W = 120, Hh = 80; D.newDoc(W, Hh, { name: "p16" });
  const toB64 = async b => { const u = new Uint8Array(await b.arrayBuffer()); let s = ""; for(let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
  // capa de fondo con 16 bits reales (degradado fino)
  const bg = D.addLayer({ name: "Foto16" });
  const hi = new Uint16Array(W * Hh * 3); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const j = (y * W + x) * 3, v = 8000 + x * 300 + y * 7; hi[j] = v; hi[j + 1] = v >> 1; hi[j + 2] = 65535 - v; }
  const img = bg.ctx.createImageData(W, Hh); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4, j = (y * W + x) * 3; for(let k = 0; k < 3; k++) img.data[i + k] = H.hiToCanvas8(hi[j + k], x, y, k, true); img.data[i + 3] = 255; }
  bg.ctx.putImageData(img, 0, 0); bg.hiSrc = { data: hi, w: W, h: Hh, dither: true, x: 0, y: 0, canvasW: W, canvasH: Hh };
  // grupo con una capa dentro, con máscara y estilos
  const g = D.addLayer({ name: "Grupo", type: "group" });
  const r = D.addLayer({ name: "Roja" }); r.ctx.fillStyle = "#ff0000"; r.ctx.fillRect(20, 20, 60, 40); r.groupId = g.id; r.blend = "multiply"; r.opacity = .8;
  r.mask = { canvas: document.createElement("canvas") }; r.mask.canvas.width = W; r.mask.canvas.height = Hh; const mx = r.mask.canvas.getContext("2d"); mx.fillStyle = "#000"; mx.fillRect(0, 0, 50, Hh); r.mask.ctx = mx;
  r.styles = { shadow: { enabled: true, color: "#000000", opacity: 75, blur: 4, x: 3, y: 3 }, glow: { enabled: false }, stroke: { enabled: false }, gradient: { enabled: false } };
  const l = D.addLayer({ name: "Niveles", type: "adjust" }); l.adjustType = "levels"; l.adjustParams = { inLow: 10, inHigh: 240, gamma: 1.2, outLow: 0, outHigh: 255, channel: "rgb" };
  const pr = await P.renderPrecisionAdjustmentStack(W, Hh, { bits16: true, alpha: false, background: "#ffffff", layersOnly: false, srgb: false });
  const M = await import("/js/io/metadata.js");
  const mm = M.filterMetadata(null, { author: false, date: false, camera: false, gps: false, text: false, ids: false, maker: false }, { w: W, h: Hh, over: { title: "Título PSD", author: "Ana PSD", copyright: "© Ana", keywords: ["a", "b"], date: "2024-05-03T18:30", lat: 40.5, lon: -3.25 } });
  const meta = { xmp: mm.xmp, exif: mm.exif };
  const blob = F.layeredPsd(1, { hi: { composite: pr.data16 }, meta });
  const blobB = F.layeredPsd(1, { psb: true, hi: { composite: pr.data16 }, meta });
  const blob8 = F.layeredPsd(1, { meta });
  // relectura con ag-psd (profundidad y capas)
  const A = globalThis.agPsd; A.initializeCanvas?.((w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; });
  const rp = A.readPsd(new Uint8Array(await blob.arrayBuffer()), { skipThumbnail: true, useImageData: true });
  const names = x => x.children.flatMap(c => [c.name + (c.children ? "[g]" : ""), ...(c.children ? names(c) : [])]);
  return { psd: await toB64(blob), psb: await toB64(blobB), p8: await toB64(blob8), bits: rp.bitsPerChannel, names: names(rp), size: blob.size, hiSample: Array.from(hi.slice(((40 * W + 60) * 3), ((40 * W + 60) * 3) + 3)) };
});
fs.mkdirSync("/tmp/sc/out", { recursive: true });
fs.writeFileSync("/tmp/sc/out/p8.psd", Buffer.from(res.p8, "base64")); fs.writeFileSync("/tmp/sc/out/p16.psd", Buffer.from(res.psd, "base64")); fs.writeFileSync("/tmp/sc/out/p16.psb", Buffer.from(res.psb, "base64"));
console.log(JSON.stringify({ bits: res.bits, names: res.names, size: res.size, hiSample: res.hiSample }));
const ok = res.bits === 16 && res.names.some(n => /Foto16/.test(n)) && res.names.some(n => /Grupo\[g\]/.test(n));
console.log(ok && !errs.length ? "OK (falta psd16_check.py)" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
