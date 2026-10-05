/* Abrir PSD/PSB de 16 bits conservando los 16 bits (v254): reabre lo que escribió tests/psd16-capas.mjs y comprueba capas, 16 bits y viaje de ida y vuelta: una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
const b64 = fs.readFileSync("/tmp/sc/out/p16.psd").toString("base64"), b64b = fs.readFileSync("/tmp/sc/out/p16.psb").toString("base64");
const res = await page.evaluate(async ({ b64, b64b }) => { try{ return await (async () => {
  const D = await import("/js/core/doc.js"), C = await import("/js/io/compatibility.js"), H = await import("/js/core/hisrc.js"), F = await import("/js/io/professional-formats.js");
  const out = {};
  for(const [k, data, name] of [["psd", b64, "p16.psd"], ["psb", b64b, "p16.psb"]]){
    const bin = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    try{ await C.openPsd(new File([bin], name)); }catch(e){ return { err: String(e.stack || e) }; }
    const L = Object.fromEntries(D.doc.layers.map(l => [l.name, l]));
    const f = L["Foto16"], W = 120, Hh = 80, x = 60, y = 40, v = 8000 + x * 300 + y * 7;
    const hs = f && f.hiSrc;
    out[k] = { capas: D.doc.layers.map(l => l.name + (l.type === "group" ? "[g]" : l.type === "adjust" ? "[aj]" : "") + (l.hiSrc ? "·16" : "")), hi: !!hs, rect: hs && [hs.x, hs.y, hs.w, hs.h, hs.canvasW, hs.canvasH],
      valor: hs && Array.from(hs.data.slice(((y - hs.y) * hs.w + (x - hs.x)) * 3, ((y - hs.y) * hs.w + (x - hs.x)) * 3 + 3)), esperado: [v, v >> 1, 65535 - v] };
    // invariante: el lienzo de 8 bits es el redondeo tramado de los 16 bits
    let bad = 0, n = 0; const px = f.ctx.getImageData(0, 0, W, Hh).data;
    for(let yy = 0; yy < Hh; yy += 3) for(let xx = 0; xx < W; xx += 3){ const i = (yy * W + xx) * 4; if(px[i + 3] !== 255) continue; n++; const j = (yy * W + xx) * 3; for(let kk = 0; kk < 3; kk++) if(px[i + kk] !== H.hiToCanvas8(hs.data[j + kk], xx, yy, kk, true)) bad++; }
    out[k].inv = { bad, n };
    out[k].mascara = !!(L["Roja"] && L["Roja"].mask); out[k].ajuste = L["Niveles"] && L["Niveles"].adjustType; out[k].modo = L["Roja"] && L["Roja"].blend;
    out[k].hijo = L["Roja"] && D.doc.layers.find(z => z.id === L["Roja"].groupId)?.name;
  }
  // ida y vuelta: reexportar a 16 bits y releer
  const A = globalThis.agPsd;
  const P = await import("/js/core/high-precision-safe.js?v=4");
  const pr = await P.renderPrecisionAdjustmentStack(120, 80, { bits16: true, alpha: false, background: "#ffffff", layersOnly: false, srgb: false });
  const blob = F.layeredPsd(1, { hi: { composite: pr.data16 } });
  const rp = A.readPsd(new Uint8Array(await blob.arrayBuffer()), { skipThumbnail: true, useImageData: true });
  const flat = list => list.flatMap(c => [c, ...(c.children ? flat(c.children) : [])]), find = list => flat(list).find(c => c.name === "Foto16");
  const lf = find(rp.children); out.vuelta = { bits: rp.bitsPerChannel, data16: lf.imageData.data instanceof Uint16Array, v: Array.from(lf.imageData.data.slice(((40 - lf.top) * lf.imageData.width + (60 - lf.left)) * 4, ((40 - lf.top) * lf.imageData.width + (60 - lf.left)) * 4 + 3)) };
  return out;
  })(); }catch(e){ return { err: String(e.stack || e) }; } }, { b64, b64b });
if(res.err){ console.log(res.err.slice(0, 700)); process.exit(1); }
console.log(JSON.stringify(res));
const good = r => r.hi && JSON.stringify(r.valor) === JSON.stringify(r.esperado) && r.inv.bad === 0 && r.inv.n > 100 && r.mascara && r.ajuste === "levels" && r.modo === "multiply" && r.hijo === "Grupo";
const ok = good(res.psd) && good(res.psb) && res.vuelta.bits === 16 && res.vuelta.data16 && JSON.stringify(res.vuelta.v) === JSON.stringify(res.psd.esperado);
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
