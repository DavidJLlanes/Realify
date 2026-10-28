/* Banco de medidas de «Panorámica» (hoja de ruta, etapa 1). No es una prueba de pasa/falla: mide, con escenas sintéticas de verdad conocida,
   cuánto se equivoca el motor (giro entre fotos y focal), cuánto tarda y cuánta memoria usa, y deja el resultado en JSON para comparar etapas.
   Escenas: base, larga, pulso (giros pequeños en las tres ejes), poca textura, distorsión de lente, paralaje, objetos en movimiento, ruido y exposición.
   Fotos reales (opcional): FOTOS=<carpeta con jpg/png> añade una fila por conjunto, sin verdad conocida (sólo cuántas se colocan y el tiempo).
   Uso: node tests/panorama-banco.mjs   (SALIDA=ruta.json para guardar; ESCENAS=base,larga para elegir) */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs", "/opt/npm-tools/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const FOTOS = process.env.FOTOS ? fs.readdirSync(process.env.FOTOS).filter(f => /\.(jpe?g|png)$/i.test(f)).sort() : [];
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); const m = p.match(/^\/__foto(\d+)$/);
  if(m){ r.writeHead(200, { "Content-Type": "image/jpeg" }); fs.createReadStream(path.join(process.env.FOTOS, FOTOS[+m[1]])).pipe(r); return; }
  if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(); page.setDefaultTimeout(0);
const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
await page.evaluate(() => setInterval(() => { const bt = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Descargar"); if(bt) bt.click(); }, 400));

const rows = await page.evaluate(async ({ only, nFotos }) => {
  const S = await import("/plugins/panorama/stitch.js"), { loadOpenCv } = await import("/js/cv/opencv.js"), R = await import("/plugins/panorama/rotation.js");
  const { cv } = await loadOpenCv();
  const W = 960, H = 640, F = 760, D = Math.PI / 180;
  // ── escena cilíndrica con textura de ruido de valor (a varias escalas)
  const hash = (x, y) => { let v = Math.imul(x * 73856093 ^ y * 19349663, 0x85ebca6b); v ^= v >>> 13; v = Math.imul(v, 0xc2b2ae35); v ^= v >>> 16; return (v >>> 0) / 4294967296; };
  const noise = (u, v) => { const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y, s = t => t * t * (3 - 2 * t);
    const a = hash(x, y), b2 = hash(x + 1, y), c = hash(x, y + 1), d = hash(x + 1, y + 1); return a + (b2 - a) * s(fx) + (c - a) * s(fy) + (a - b2 - c + d) * s(fx) * s(fy); };
  const scene = (az, ty, contrast) => 0.5 + contrast * (0.5 * noise(az * 60, ty * 60) + 0.3 * noise(az * 150, ty * 150) + 0.2 * noise(az * 400, ty * 400) - 0.5);
  const mul = (a, b) => { const o = Array(9).fill(0); for(let i = 0; i < 3; i++) for(let j = 0; j < 3; j++) for(let k = 0; k < 3; k++) o[3 * i + j] += a[3 * i + k] * b[3 * k + j]; return o; };
  const rx = a => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)], ry = a => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)], rz = a => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const truth = v => mul(mul(ry(v.yaw * D), rx((v.pitch || 0) * D)), rz((v.roll || 0) * D));
  const angleBetween = (A, B) => { let tr = 0; for(let i = 0; i < 9; i++) tr += A[i] * B[i]; return Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) / D; };   // ángulo de Aᵀ·B
  let seed = 12345; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const render = (v, o) => {
    const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d", { willReadFrequently: true }), im = x.createImageData(W, H), Rm = truth(v);
    const RC = 3, cx = v.cx || 0, k1 = o.k1 || 0, gain = v.gain || 1;
    for(let j = 0; j < H; j++) for(let i = 0; i < W; i++){
      let px = (i - W / 2) / F, py = (j - H / 2) / F; const r2 = px * px + py * py; px *= 1 + k1 * r2; py *= 1 + k1 * r2;
      const n = Math.hypot(px, py, 1), d = [px / n, py / n, 1 / n], w = [Rm[0] * d[0] + Rm[1] * d[1] + Rm[2] * d[2], Rm[3] * d[0] + Rm[4] * d[1] + Rm[5] * d[2], Rm[6] * d[0] + Rm[7] * d[1] + Rm[8] * d[2]];
      // rayo desde (cx,0,0) hasta el cilindro de radio RC (x²+z²=RC²)
      const a = w[0] * w[0] + w[2] * w[2], bq = cx * w[0], cq = cx * cx - RC * RC, s = (-bq + Math.sqrt(bq * bq - a * cq)) / a, hx = cx + s * w[0], hz = s * w[2], hy = s * w[1];
      let val = scene(Math.atan2(hx, hz), hy / RC, o.contrast ?? 0.9) * gain; if(o.noise) val += (rnd() + rnd() + rnd() - 1.5) * o.noise / 255 * 2;
      const q = Math.max(0, Math.min(255, 255 * val)), p = 4 * (j * W + i); im.data[p] = q; im.data[p + 1] = q * 0.92; im.data[p + 2] = q * 0.85; im.data[p + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    for(let k = 0; k < (o.movers || 0); k++){   // objetos que se mueven: manchas con textura propia en sitios distintos por foto
      const cxm = W * (0.2 + 0.6 * rnd()), cym = H * (0.3 + 0.4 * rnd()), rr = 60 + 40 * rnd(), pix = x.getImageData(cxm - rr, cym - rr, 2 * rr, 2 * rr);
      for(let j = 0; j < 2 * rr; j++) for(let i = 0; i < 2 * rr; i++) if(Math.hypot(i - rr, j - rr) < rr){ const q = 255 * hash(i >> 2, j >> 2 ^ k * 7), p = 4 * (j * 2 * rr + i); pix.data[p] = q; pix.data[p + 1] = 255 - q; pix.data[p + 2] = 128; }
      x.putImageData(pix, cxm - rr, cym - rr);
    }
    return c;
  };
  const range = (n, step, from) => Array.from({ length: n }, (_, i) => ({ yaw: (from ?? -step * (n - 1) / 2) + i * step }));
  const SC = {
    base:        { views: range(4, 24), o: {} },
    larga:       { views: range(10, 22), o: {} },
    pulso:       { views: range(6, 25).map(v => ({ ...v, pitch: (rnd() - 0.5) * 6, roll: (rnd() - 0.5) * 4 })), o: {} },
    pocatextura: { views: range(4, 24), o: { contrast: 0.12, noise: 3 } },
    distorsion:  { views: range(5, 24), o: { k1: -0.08 } },
    paralaje:    { views: range(5, 24).map((v, i) => ({ ...v, cx: 0.12 * (i - 2) })), o: {} },
    largadificil: { views: range(10, 22).map(v => ({ ...v, pitch: (rnd() - 0.5) * 4, roll: (rnd() - 0.5) * 3 })), o: { contrast: 0.35, noise: 6 } },
    moviles:     { views: range(5, 24), o: { movers: 3 } },
    ruido:       { views: range(5, 24).map((v, i) => ({ ...v, gain: [0.8, 1.1, 0.9, 1.2, 1][i] })), o: { noise: 10 } }
  };
  const out = [];
  const heap = () => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  for(const name of Object.keys(SC)){
    if(only && !only.includes(name)) continue;
    seed = 12345 + name.length;
    const { views, o } = SC[name], order = views.map((_, i) => i).sort((a, b) => ((a * 7 + 3) % views.length) - ((b * 7 + 3) % views.length));   // desordenadas, siempre igual
    const cans = order.map(k => render(views[k], o)), tr = order.map(k => truth(views[k]));
    const t0 = performance.now(); let tOrden = null; const cam = await R.solveCamera(cv, cans, { onProgress: m => { if(tOrden == null && /^Analizando/.test(m)) tOrden = performance.now() - t0; } }); const tSolve = performance.now() - t0;
    const errs = [], consec = [];
    for(let i = 0; i < cans.length; i++) for(let j = i + 1; j < cans.length; j++) if(cam.R[i] && cam.R[j]){ const e = Math.abs(angleBetween(cam.R[i], cam.R[j]) - angleBetween(tr[i], tr[j])); errs.push(e); }
    const yawOrder = order.map((k, i) => [views[k].yaw, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]), ok = JSON.stringify(cam.order) === JSON.stringify(yawOrder) || JSON.stringify(cam.order) === JSON.stringify([...yawOrder].reverse());
    let res = null, tAll = null, msg = "";
    const t1 = performance.now();
    try{ const c = await S.stitchLocal(cans, { premium: false, autoCrop: true }); res = [c.width, c.height]; tAll = performance.now() - t1; }catch(e){ msg = e.code + ": " + e.message; }
    out.push({ escena: name, fotos: cans.length, colocadas: cam.found.filter(Boolean).length, ordenOk: ok, focalErrPct: +(100 * Math.abs(cam.f - F) / F).toFixed(2),
      giroMedioGrados: errs.length ? +(errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(3) : null, giroMaxGrados: errs.length ? +Math.max(...errs).toFixed(3) : null,
      ba: cam.ba && (cam.ba.used ? `${cam.ba.pairs}p/${cam.ba.shortcuts}a ${cam.ba.medBefore.toFixed(1)}→${cam.ba.medAfter.toFixed(1)}px` : (cam.ba.error || 'no')), msSolve: Math.round(tSolve), msOrden: tOrden == null ? 0 : Math.round(tOrden), msTotal: tAll && Math.round(tAll), mosaico: res, heapMB: heap(), fallo: msg || undefined });
  }
  // Fotos reales: sin verdad conocida
  if(nFotos){
    const cans = []; for(let i = 0; i < nFotos; i++){ const im = new Image(); im.src = `/__foto${i}`; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d", { willReadFrequently: true }).drawImage(im, 0, 0); cans.push(c); }
    const t0 = performance.now(); let res = null, msg = "";
    try{ const c = await S.stitchLocal(cans, { premium: false, autoCrop: true }); res = [c.width, c.height]; }catch(e){ msg = e.code + ": " + e.message; }
    out.push({ escena: "fotos reales", fotos: cans.length, msTotal: Math.round(performance.now() - t0), mosaico: res, heapMB: heap(), fallo: msg || undefined });
  }
  return out;
}, { only: process.env.ESCENAS ? process.env.ESCENAS.split(",") : null, nFotos: FOTOS.length });

console.table(rows.map(r => ({ escena: r.escena, fotos: r.fotos, colocadas: r.colocadas, orden: r.ordenOk, "focal %": r.focalErrPct, "giro med °": r.giroMedioGrados, "giro máx °": r.giroMaxGrados, ba: r.ba, "solve ms": r.msSolve, "orden ms": r.msOrden, "total ms": r.msTotal, mosaico: r.mosaico?.join("×"), "heap MB": r.heapMB, fallo: r.fallo })));
if(process.env.SALIDA) fs.writeFileSync(process.env.SALIDA, JSON.stringify(rows, null, 2));
if(errs.length) console.log("Errores de página:", errs.join(" | "));
await b.close(); srv.close();
