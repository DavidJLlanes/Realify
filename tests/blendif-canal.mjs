/* «Fusionar si» por canal (v256): los tres motores —8 bits (flatten), coma flotante en CPU (precision-stack) y GPU (floatcompositor)— deben dar lo mismo con rangos
   de gris y de canales sueltos (esta capa y subyacente, con rampa partida). Uso: node tests/blendif-canal.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), page = await b.newPage(), errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const res = await page.evaluate(async () => {
  const D = await import("/js/core/doc.js"), G = await import("/js/gpu/floatcompositor.js"), PS = await import("/js/core/precision-stack.js"), LT = await import("/js/editor/layertree.js"), BI = await import("/js/editor/blendif.js");
  const o = {}, W = 128, H = 96; D.newDoc(W, H, { name: "bi" });
  const base = D.addLayer({ name: "Fondo" });
  const g = base.ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#202060"); g.addColorStop(.5, "#c0a040"); g.addColorStop(1, "#f0f0f0"); base.ctx.fillStyle = g; base.ctx.fillRect(0, 0, W, H);
  const top = D.addLayer({ name: "Arriba" });
  const g2 = top.ctx.createLinearGradient(W, 0, 0, H); g2.addColorStop(0, "#ff2030"); g2.addColorStop(.5, "#20ff80"); g2.addColorStop(1, "#4080ff"); top.ctx.fillStyle = g2; top.ctx.fillRect(0, 0, W, H);
  const def = BI.blendIfDefault;
  const cases = {
    gris: { ...def(), thisLayer: { blackMin: 90, blackMax: 140, whiteMin: 255, whiteMax: 255 } },
    rojo: { ...def(), channels: { r: { thisLayer: { blackMin: 60, blackMax: 60, whiteMin: 255, whiteMax: 255 }, underlying: BI.blendIfSideDefault() } } },
    verdeSub: { ...def(), channels: { g: { thisLayer: BI.blendIfSideDefault(), underlying: { blackMin: 30, blackMax: 70, whiteMin: 255, whiteMax: 255 } } } },
    mezcla: { thisLayer: { blackMin: 0, blackMax: 0, whiteMin: 240, whiteMax: 255 }, underlying: BI.blendIfSideDefault(), channels: { b: { thisLayer: { blackMin: 20, blackMax: 50, whiteMin: 255, whiteMax: 255 }, underlying: BI.blendIfSideDefault() }, r: { thisLayer: BI.blendIfSideDefault(), underlying: { blackMin: 0, blackMax: 0, whiteMin: 180, whiteMax: 220 } } } }
  };
  o.activo = Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, BI.isBlendIfActive(v)])); o.defecto = BI.isBlendIfActive(def());
  o.casos = {};
  for(const [name, bi] of Object.entries(cases)){
    top.blendIf = JSON.parse(JSON.stringify(bi));
    const flat = LT.flatten().getContext("2d").getImageData(0, 0, W, H).data, st = await PS._debugStore();
    const cmp8 = (st) => { let sum = 0, mx = 0, n = 0; for(let i = 0; i < W * H; i++){ const a = st.store[i * 4 + 3] / 65535; for(let k = 0; k < 3; k++){ const p = Math.round(st.store[i * 4 + k] / 65535 * 255), e = Math.abs(p - flat[i * 4 + k]) * (a > 0 ? 1 : 0); sum += e; n++; if(e > mx) mx = e; } } return { media: +(sum / n).toFixed(3), max: mx }; };
    const r = { cpu16: cmp8(st) };
    let changed = 0; const none = (() => { top.blendIf = null; const f = LT.flatten().getContext("2d").getImageData(0, 0, W, H).data; top.blendIf = JSON.parse(JSON.stringify(bi)); return f; })();
    for(let i = 0; i < flat.length; i += 4) if(Math.abs(flat[i] - none[i]) + Math.abs(flat[i + 1] - none[i + 1]) + Math.abs(flat[i + 2] - none[i + 2]) > 6) changed++;
    r.cambiaPx = changed;
    if(G.floatAvailable()){
      const plan = G.floatPlan(D.doc.layers, W, H, {});
      if(plan){ const gpu = G._debugFloat(LT.buildLayerTree(D.doc.layers), D.doc.layers, W, H, plan); let mx = 0, sum = 0, n = 0;
        for(let i = 0; i < W * H; i++){ const a = st.store[i * 4 + 3] / 65535; for(let k = 0; k < 3; k++){ const pr = st.store[i * 4 + k] / 65535 * a, e = Math.abs(gpu[i * 4 + k] - pr); sum += e; n++; if(e > mx) mx = e; } }
        r.gpu = { max: +mx.toFixed(4), media: +(sum / n).toFixed(5) }; }
    }
    o.casos[name] = r;
  }
  o.gpuDisponible = G.floatAvailable();
  return o;
});
console.log(JSON.stringify(res, null, 1));
const okc = Object.values(res.activo).every(Boolean) && res.defecto === false && Object.values(res.casos).every(c => c.cambiaPx > 50 && c.cpu16.media < 1.2 && c.cpu16.max <= 4 && (!c.gpu || (c.gpu.max < 0.02 && c.gpu.media < 0.002)));
console.log(okc && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(okc && !errs.length ? 0 : 1);
