/* Prueba de «Lente por perfil» en el revelador RAW (v251, raw/lens.js): un DNG sintético de una cuadrícula con un perfil propio (distorsión y viñeteo) guardado
   para su cámara. Con la opción activada, los datos lineales salen corregidos ANTES del revelado: el centro no cambia, los bordes se desplazan (la geometría) y
   las esquinas se aclaran (el viñeteo compensado en luz lineal). Sin la opción, nada cambia. Uso: node tests/raw-lente.mjs */
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
  const { colorDng } = await import("/raw/tests/dng-color-fixture.js"), { RawDecoder } = await import("/raw/decoder.js"), { defaults } = await import("/raw/state.js"), { linearReader } = await import("/raw/source.js"), UP = await import("/js/lens/userprofiles.js");
  UP.put({ name: "Prueba Realify", match: { make: "Realify", model: "Color camera" }, distortion: { k: [-0.12, 0, 0] }, vignette: { v: [-0.45, 0, 0] } });
  const W = 320, H = 200, scene = (x, y) => (x % 32 < 3 || y % 32 < 3) ? [0.5, 0.5, 0.5] : [0.2, 0.2, 0.2], file = new File([colorDng(W, H, scene)], "grid.dng");
  const read = async on => { const d = await RawDecoder.open(file, { ...defaults(), lensProfile: on }); const s = d.source, rd = linearReader(s); d.dispose(); return { w: s.width, h: s.height, g: (x, y) => rd((y * s.width + x) * s.channels + 1) }; };
  const a = await read(false), c = await read(true);
  const lum = (r, x, y) => r.g(x, y);
  // Fila 0.45·H: posición de la primera línea vertical (x%32<3) entre x=W-90 y W-1, buscando el máximo local
  const lineX = r => { let best = -1, bv = 0; for(let x = W - 110; x < W - 2; x++){ const v = lum(r, x, Math.round(H * 0.5) + 7); if(v > bv){ bv = v; best = x; } } return best; };
  return { centro: [lum(a, W / 2 | 0, H / 2 | 0 + 7), lum(c, W / 2 | 0, H / 2 | 0 + 7)], esquina: [lum(a, 6, 15), lum(c, 6, 15)], lineaX: [lineX(a), lineX(c)], dims: [c.w, c.h] };
});
console.log(JSON.stringify(res));
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
chk(Math.abs(res.centro[0] - res.centro[1]) < 0.01, "el centro no debe cambiar"); chk(res.esquina[1] > res.esquina[0] * 1.03, `la esquina debe aclararse (viñeteo): ${res.esquina[0].toFixed(3)} → ${res.esquina[1].toFixed(3)}`);
chk(Math.abs(res.lineaX[0] - res.lineaX[1]) >= 1, `una línea cerca del borde debe desplazarse (geometría): ${res.lineaX}`); chk(res.dims[0] === 320 && res.dims[1] === 200, "mismo tamaño");
chk(!errs.length, "errores de página: " + errs.join("|"));
await b.close(); srv.close(); console.log(bad ? "raw-lente: FALLO" : "raw-lente: OK"); process.exit(bad ? 1 : 0);
