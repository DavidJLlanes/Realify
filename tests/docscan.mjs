/* Prueba de «Escanear documento» (v251): una hoja sintética con texto y sombra, fotografiada en perspectiva sobre una mesa oscura. scanPage debe encontrar el
   documento, devolver una página recta de proporción A4 y con el acabado pedido (papel liso y casi blanco; en «bw», sólo blanco y negro). Dos páginas se
   convierten en un PDF de dos páginas (pdfpro). Uso: node tests/docscan.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(); page.setDefaultTimeout(0); const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
await page.evaluate(() => setInterval(() => { const bt = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Descargar"); if(bt) bt.click(); }, 400));
const res = await page.evaluate(async () => {
  const { loadOpenCv } = await import("/js/cv/opencv.js"), lib = await loadOpenCv(), D = await import("/js/features/docscan.js"), PDF = await import("/js/io/pdfpro.js");
  const sheet = (seed) => { const c = document.createElement("canvas"); c.width = 840; c.height = 1188; const x = c.getContext("2d"); x.fillStyle = "#efe9d8"; x.fillRect(0, 0, 840, 1188);
    x.fillStyle = "#222"; for(let y = 90; y < 1100; y += 34){ let xx = 80; while(xx < 740){ const w = 20 + ((xx * 7 + y * 13 + seed * 31) % 70); x.fillRect(xx, y, Math.min(w, 740 - xx), 10); xx += w + 14; } }
    return c; };
  const photoOf = (sheetC, quad) => { // pegar la hoja en perspectiva sobre una mesa oscura con una sombra de luz
    const cv = lib.cv, W = 1200, H = 1000, bg = document.createElement("canvas"); bg.width = W; bg.height = H; const bx = bg.getContext("2d"); bx.fillStyle = "#3a2d24"; bx.fillRect(0, 0, W, H);
    const src = cv.imread(sheetC), dst = new cv.Mat(), a = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 840, 0, 840, 1188, 0, 1188]), q = cv.matFromArray(4, 1, cv.CV_32FC2, quad.flat()), M = cv.getPerspectiveTransform(a, q);
    cv.warpPerspective(src, dst, M, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
    const lay = document.createElement("canvas"); lay.width = W; lay.height = H; cv.imshow(lay, dst); bx.drawImage(lay, 0, 0);
    const g = bx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)"); bx.globalCompositeOperation = "source-atop"; bx.fillStyle = g; bx.fillRect(0, 0, W, H);
    src.delete(); dst.delete(); a.delete(); q.delete(); M.delete(); return bg; };
  const p1 = photoOf(sheet(1), [[240, 90], [980, 140], [1030, 930], [170, 880]]), p2 = photoOf(sheet(2), [[200, 110], [1000, 100], [980, 900], [220, 930]]);
  const out = {};
  const r1 = await D.scanPage(lib.cv, p1, { finish: "paper", ratio: "a4" }); out.found = r1.found; out.size = [r1.canvas.width, r1.canvas.height];
  const stats = c => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0, mid = 0; for(let y = 20; y < c.height - 20; y += 3) for(let x = 20; x < c.width - 20; x += 3){ const i = (y * c.width + x) * 4, l = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114; s += l; s2 += l * l; n++; if(l > 40 && l < 215) mid++; } const m = s / n; return { mean: m, std: Math.sqrt(s2 / n - m * m), mid: mid / n }; };
  out.paper = stats(r1.canvas);
  const r1b = await D.scanPage(lib.cv, p1, { finish: "bw", ratio: "a4" }); out.bw = stats(r1b.canvas);
  const r1n = await D.scanPage(lib.cv, p1, { finish: "none", ratio: "a4" }); out.none = stats(r1n.canvas);
  const r2 = await D.scanPage(lib.cv, p2, { finish: "paper", ratio: "a4" });
  const { blob, pages } = await PDF.buildPdf([{ canvas: r1.canvas, name: "Página 1" }, { canvas: r2.canvas, name: "Página 2" }], { page: "image", marginMm: 0, dpi: 200, quality: .9 });
  out.pdf = { pages, bytes: blob.size, head: String.fromCharCode(...new Uint8Array(await blob.slice(0, 5).arrayBuffer())) };
  return out;
});
console.log(JSON.stringify(res));
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
chk(res.found, "debe encontrar el documento"); chk(Math.abs(res.size[0] / res.size[1] - 210 / 297) < 0.02, "proporción de la hoja (" + (res.size[0] / res.size[1]).toFixed(3) + ")");
chk(res.paper.mean > 185 && res.paper.mean > res.none.mean + 25, "«Aclarar el papel» debe aclarar claramente (" + res.paper.mean.toFixed(0) + " vs " + res.none.mean.toFixed(0) + ")"); chk(res.paper.std < res.none.std + 5 || res.paper.std < 90, "papel uniforme");
chk(res.bw.mid < 0.03 && res.bw.mean > 175, "bw: sólo blanco y negro y fondo blanco"); chk(res.pdf.pages === 2 && res.pdf.head === "%PDF-", "PDF de dos páginas");
chk(!errs.length, "errores de página: " + errs.join("|"));
await b.close(); srv.close(); console.log(bad ? "docscan: FALLO" : "docscan: OK"); process.exit(bad ? 1 : 0);
