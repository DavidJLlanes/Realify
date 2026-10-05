/* Prueba de «Alineación precisa 👑» en la Fusión HDR (v251): tres exposiciones de una foto hechas «a pulso» (giro y escala distintos y medio píxel de desplazamiento).
   Se carga el horquillado en la ventana HDR, se mira la nitidez del resultado con la alineación de siempre (desplazamientos) y tras activar la precisa (OpenCV:
   homografías ORB+ECC aplicadas en el worker): la fusión debe salir claramente más nítida y el aviso confirmar las fotos alineadas.
   Uso: node tests/hdr-preciso.mjs <foto.jpg> */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const foto = process.argv[2]; if(!foto){ console.log("Uso: node tests/hdr-preciso.mjs <foto.jpg>"); process.exit(2); }
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p === "/__foto.jpg"){ r.writeHead(200, { "Content-Type": "image/jpeg" }); fs.createReadStream(foto).pipe(r); return; }
  if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }); page.setDefaultTimeout(0); const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
await page.evaluate(() => setInterval(() => { const bt = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Descargar"); if(bt) bt.click(); }, 400));
// Tres exposiciones con pequeñas diferencias de giro y escala
const jpgs = await page.evaluate(async () => {
  const img = new Image(); img.src = "/__foto.jpg"; await img.decode();
  const W = 900, H = Math.round(900 * img.height / img.width), out = [];
  for(const [ev, rot, sc, dx] of [[0.45, 0, 1, 0], [1, 1.1, 1.015, 6.4], [2.1, -0.9, 0.99, -5.6]]){
    const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high";
    x.translate(W / 2 + dx, H / 2); x.rotate(rot * Math.PI / 180); x.scale(sc * 1.08, sc * 1.08); x.translate(-W / 2, -H / 2); x.drawImage(img, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H); for(let i = 0; i < d.data.length; i += 4) for(let k = 0; k < 3; k++) d.data[i + k] = Math.min(255, Math.round(255 * Math.pow(d.data[i + k] / 255 * ev, 0.9)));
    x.setTransform(1, 0, 0, 1, 0, 0); x.putImageData(d, 0, 0);
    out.push(Array.from(new Uint8Array(await (await new Promise(r => c.toBlob(r, "image/jpeg", .95))).arrayBuffer())));
  }
  return out;
});
await page.evaluate(async () => { const m = await import("/hdr/index.js"); window.__hdr = m.openHdr(); });
await page.waitForSelector("[data-add]");
const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.locator("[data-add]").click()]);
await fc.setFiles(jpgs.map((d, i) => ({ name: `exp${i}.jpg`, mimeType: "image/jpeg", buffer: Buffer.from(d) })));
await page.waitForFunction(() => document.querySelectorAll(".fsp-photo").length >= 3, null, { timeout: 120000 });
await page.waitForTimeout(4000);
const nitidez = async () => {
  const png = await page.locator(".fsp-stage").screenshot(); if(process.env.SHOTS) fs.writeFileSync(process.env.SHOTS + "-" + (globalThis.__n = (globalThis.__n || 0) + 1) + ".png", png);
  return page.evaluate(async b64 => {
    const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
    const W = im.width, H = im.height, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, W, H).data, L = new Float32Array(W * H);
    for(let i = 0, j = 0; i < L.length; i++, j += 4) L[i] = d[j] * .2126 + d[j + 1] * .7152 + d[j + 2] * .0722;
    let s = 0, s2 = 0, n = 0; for(let y = Math.round(H * 0.45); y < Math.round(H * 0.8); y++) for(let xx = Math.round(W * 0.05); xx < W - 20; xx++){ const i = y * W + xx, v = 4 * L[i] - L[i - 1] - L[i + 1] - L[i - W] - L[i + W]; s += v; s2 += v * v; n++; }
    return { w: W, h: H, lap: s2 / n - (s / n) ** 2 };
  }, png.toString("base64"));
};
const antes = await nitidez();
// Activar la alineación precisa (mando «Alineación precisa 👑 (OpenCV)»)
const lab = page.locator("label, .fsp-row, .fsp-prop").filter({ hasText: "Alineación precisa" }).first();
await lab.scrollIntoViewIfNeeded().catch(() => {});
await lab.locator("input[type=checkbox], [role=switch], .sw, .toggle").first().click({ force: true }).catch(async () => { await lab.click(); });
await page.waitForFunction(() => /alineadas con precisión|No se pudo alinear con precisión|Alineación precisa:/.test(document.getElementById("toast")?.textContent || ""), null, { timeout: 600000 });
const aviso = await page.evaluate(() => document.getElementById("toast").textContent);
await page.waitForTimeout(5000);
const despues = await nitidez();
console.log(JSON.stringify({ antes, despues, aviso }));
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
chk(/alineadas con precisión \(2 de 2\)/.test(aviso), "las dos fotos deben alinearse con precisión: " + aviso); chk(despues.lap > antes.lap * 1.05, `la fusión debe ser más nítida (${despues.lap.toFixed(1)} vs ${antes.lap.toFixed(1)})`);
chk(!errs.length, "errores de página: " + errs.join("|"));
await b.close(); srv.close(); console.log(bad ? "hdr-preciso: FALLO" : "hdr-preciso: OK"); process.exit(bad ? 1 : 0);
