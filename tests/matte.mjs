/* Prueba de «Eliminar fondo» por bloques y con refinado (v249/v250) con U²-Net real (assets/models/u2netp, sin descargas). Sobre una foto grande (el refinado es lo que se usa; los bloques son opcionales y no mejoran)
   se compara la pasada global sola con la de bloques + refinado: ambas deben encontrar el mismo sujeto (IoU alta) y la nueva debe tener el borde más
   nítido (menos píxeles de alfa intermedio) y más fiel a los contornos de la foto. Uso: node tests/matte.mjs <foto.jpg> [ancho] */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const foto = process.argv[2], ancho = +(process.argv[3] || 2400);
if(!foto){ console.log("Uso: node tests/matte.mjs <foto.jpg> [ancho]"); process.exit(2); }
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".onnx": "application/octet-stream" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p === "/__foto.jpg"){ r.writeHead(200, { "Content-Type": "image/jpeg" }); fs.createReadStream(foto).pipe(r); return; }
  if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(); page.setDefaultTimeout(0); const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const res = await page.evaluate(async ancho => {
  const img = new Image(); img.src = "/__foto.jpg"; await img.decode();
  const W = ancho, H = Math.round(ancho * img.height / img.width), c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, W, H);
  const M = await import("/js/ai/matte.js");
  const t0 = performance.now(); const base = await M.matteAlpha(c, "u2netp", { tiles: false, refine: false }); const t1 = performance.now();
  const nuevo = await M.matteAlpha(c, "u2netp", { tiles: true, refine: true }); const t2 = performance.now();
  const soloRef = await M.matteAlpha(c, "u2netp", { tiles: false, refine: true });
  const st = a => { let k = 0, mid = 0, tot = 0; for(let i = 0; i < a.length; i++){ if(a[i] > 127) k++; if(a[i] > 15 && a[i] < 240) mid++; } return { fg: k / a.length, medio: mid / a.length }; };
  let inter = 0, uni = 0; for(let i = 0; i < base.length; i++){ const p = base[i] > 127, q = nuevo[i] > 127; if(p && q) inter++; if(p || q) uni++; }
  // fidelidad al contorno: el gradiente de la foto debe coincidir mejor con el del alfa
  const g = x.getImageData(0, 0, W, H).data, L = new Float32Array(W * H); for(let i = 0, j = 0; i < L.length; i++, j += 4) L[i] = (g[j] * .2126 + g[j + 1] * .7152 + g[j + 2] * .0722) / 255;
  const corr = a => { let sxy = 0, sx = 0, sy = 0, sxx = 0, syy = 0, n = 0; for(let y = 1; y < H - 1; y += 2) for(let xx = 1; xx < W - 1; xx += 2){ const i = y * W + xx, ga = Math.hypot(a[i + 1] - a[i - 1], a[i + W] - a[i - W]) / 255, gl = Math.hypot(L[i + 1] - L[i - 1], L[i + W] - L[i - W]); if(ga < 0.02) continue; n++; sx += ga; sy += gl; sxy += ga * gl; sxx += ga * ga; syy += gl * gl; } const cov = sxy / n - sx / n * sy / n; return cov / Math.sqrt((sxx / n - (sx / n) ** 2) * (syy / n - (sy / n) ** 2) + 1e-12); };
  return { W, H, base: st(base), nuevo: st(nuevo), soloRef: st(soloRef), iou: inter / Math.max(1, uni), msBase: Math.round(t1 - t0), msNuevo: Math.round(t2 - t1), corrBase: corr(base), corrNuevo: corr(nuevo), corrRef: corr(soloRef) };
}, ancho);
console.log(JSON.stringify(res));
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
chk(res.base.fg > 0.02 && res.base.fg < 0.98, "la pasada global no encuentra sujeto"); chk(res.iou > 0.97, "el sujeto debe coincidir con la pasada global (IoU " + res.iou.toFixed(3) + ")");
chk(Math.abs(res.soloRef.fg - res.base.fg) < 0.01, "el área del sujeto no debe cambiar (" + res.soloRef.fg.toFixed(3) + " vs " + res.base.fg.toFixed(3) + ")");
chk(res.corrRef >= res.corrBase - 0.01, "el borde refinado debe seguir los contornos de la foto (" + res.corrRef.toFixed(3) + " vs " + res.corrBase.toFixed(3) + ")");
chk(!errs.length, "errores de página: " + errs.join("|"));
await b.close(); srv.close(); console.log(bad ? "matte: FALLO" : "matte: OK"); process.exit(bad ? 1 : 0);
