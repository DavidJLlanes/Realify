/* Banco de medidas de «Panorámica» (hoja de ruta, etapa 1). No es una prueba de pasa/falla: mide, con escenas sintéticas de verdad conocida,
   cuánto se equivoca el motor (giro entre fotos y focal), cuánto tarda y cuánta memoria usa, y deja el resultado en JSON para comparar etapas.
   Calidad de costura (escenas sin paralaje ni cambios de exposición): error medio y percentil 95 (niveles 0-255) frente a la escena real, y «doble» = % de píxeles de solape que no se parecen a ninguna de las fotos que los cubren (error > 12: mezcla de dos fotos distintas, fantasmas) entre el mosaico y la escena real
   en los píxeles donde se solapan dos o más fotos, con la mezcla «seam» (por distancia al borde) y «multiband» (costura inteligente + bandas).
   Escenas: base, larga, pulso (giros pequeños en las tres ejes), poca textura (y muy poca, y larga con poca textura), distorsión de lente, paralaje, objetos en movimiento, ruido y exposición.
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

const { rows, png: pngs } = await page.evaluate(async ({ only, nFotos }) => {
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
      const cxm = Math.round(W * (0.6 + 0.22 * rnd())), cym = Math.round(H * (0.25 + 0.5 * rnd())), rr = Math.round(50 + 35 * rnd()), pix = x.getImageData(cxm - rr, cym - rr, 2 * rr, 2 * rr);
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
    muypoca:     { views: range(4, 24), o: { contrast: 0.05, noise: 3 } },
    texturalarga: { views: range(8, 22).map(v => ({ ...v, pitch: (rnd() - 0.5) * 4, roll: (rnd() - 0.5) * 3 })), o: { contrast: 0.15, noise: 4 } },
    distorsion:  { views: range(5, 24), o: { k1: -0.08 } },
    paralaje:    { views: range(5, 24).map((v, i) => ({ ...v, cx: 0.12 * (i - 2) })), o: {} },
    largadificil: { views: range(10, 22).map(v => ({ ...v, pitch: (rnd() - 0.5) * 4, roll: (rnd() - 0.5) * 3 })), o: { contrast: 0.35, noise: 6 } },
    moviles:     { views: range(5, 24), o: { movers: 2 } },
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
    // Calidad de costura frente a la escena real (sólo donde la verdad es exacta: sin paralaje ni ganancias)
    let costura = null;
    if(["base", "larga", "pulso", "moviles"].includes(name) && cam.found.every(Boolean)){
      const E = await import("/plugins/panorama/engine.js"), wp = await R.warpPanorama(cv, cans, cam, { projection: "cyl", interp: "linear" });
      if(wp.images){
        const placedOrder = cam.order.filter(i => cam.R[i]), mid = placedOrder[(placedOrder.length - 1) >> 1], Tm = tr[mid];
        const pos = wp.images.map(im => ({ x: im.x, y: im.y })), set = wp.images.map(im => ({ w: im.w, h: im.h, data: im.data })), Lyt = E.placed(set, pos);
        costura = {};
        for(const fusion of ["seam", "multiband"]){
          const t2 = performance.now(), mos = E.compose(set, Lyt, { fusion, crop: false }), ms = Math.round(performance.now() - t2), cnt = new Uint8Array(mos.w * mos.h);
          // Cuántas fotos cubren cada píxel y, de ellas, cuánto se parece el mosaico a la que más se le parece (con su ganancia de exposición):
          // un píxel mezclado de dos fotos distintas (doble) no se parece a ninguna; uno de una sola foto, sí.
          const minD = new Float32Array(mos.w * mos.h).fill(Infinity);
          wp.images.forEach((wi, k) => { const g = Lyt.gains[k]; for(let y = 0; y < wi.h; y++) for(let x = 0; x < wi.w; x++){ const s = (y * wi.w + x) * 4; if(wi.data[s + 3] <= 127) continue; const X = x + wi.x, Y = y + wi.y; if(X >= mos.w || Y >= mos.h) continue; cnt[Y * mos.w + X]++;
            const o = (Y * mos.w + X) * 4, d = (Math.abs(mos.data[o] - Math.min(255, wi.data[s] * g)) + Math.abs(mos.data[o + 1] - Math.min(255, wi.data[s + 1] * g)) + Math.abs(mos.data[o + 2] - Math.min(255, wi.data[s + 2] * g))) / 3; if(d < minD[Y * mos.w + X]) minD[Y * mos.w + X] = d; } });
          let nOv = 0, nDoble = 0; for(let o = 0; o < cnt.length; o++) if(cnt[o] >= 2){ nOv++; if(minD[o] > 12) nDoble++; }
          const errs = [];
          for(let Y = 0; Y < mos.h; Y += 2) for(let X = 0; X < mos.w; X += 2){
            if(cnt[Y * mos.w + X] < 2) continue;
            const th = (X + wp.origin.x) / cam.f, v = (Y + wp.origin.y) / cam.f, d = [Math.sin(th), v, Math.cos(th)];
            const w = [Tm[0] * d[0] + Tm[1] * d[1] + Tm[2] * d[2], Tm[3] * d[0] + Tm[4] * d[1] + Tm[5] * d[2], Tm[6] * d[0] + Tm[7] * d[1] + Tm[8] * d[2]];
            const q = 255 * scene(Math.atan2(w[0], w[2]), w[1] / Math.hypot(w[0], w[2]), 0.9), o = (Y * mos.w + X) * 4;
            errs.push((Math.abs(mos.data[o] - q) + Math.abs(mos.data[o + 1] - q * 0.92) + Math.abs(mos.data[o + 2] - q * 0.85)) / 3);
          }
          if(only && only.length === 1){ const cv2 = document.createElement("canvas"); cv2.width = mos.w; cv2.height = mos.h; cv2.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(mos.data), mos.w, mos.h), 0, 0); (window.__png ||= {})[fusion] = cv2.toDataURL("image/png"); }   // con una sola escena se guardan los mosaicos para mirarlos
          errs.sort((a, b) => a - b);
          costura[fusion] = { medio: +(errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(2), p95: +errs[Math.floor(errs.length * 0.95)].toFixed(1), doble: +(100 * nDoble / Math.max(1, nOv)).toFixed(2), ms };
        }
      }
    }
    let res = null, tAll = null, msg = "";
    const t1 = performance.now();
    try{ const c = await S.stitchLocal(cans, { premium: false, autoCrop: true }); res = [c.width, c.height]; tAll = performance.now() - t1; }catch(e){ msg = e.code + ": " + e.message; }
    out.push({ escena: name, fotos: cans.length, colocadas: cam.found.filter(Boolean).length, ordenOk: ok, focalErrPct: +(100 * Math.abs(cam.f - F) / F).toFixed(2),
      giroMedioGrados: errs.length ? +(errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(3) : null, giroMaxGrados: errs.length ? +Math.max(...errs).toFixed(3) : null,
      ba: cam.ba && (cam.ba.used ? `${cam.ba.pairs}p/${cam.ba.shortcuts}a ${cam.ba.medBefore.toFixed(1)}→${cam.ba.medAfter.toFixed(1)}px${cam.ba.lens ? (cam.ba.lens.accepted ? ` lente k=${cam.ba.lens.k.map(v => v.toFixed(3))}` : " lente no") : ""}` : (cam.ba.error || 'no')), msSolve: Math.round(tSolve), msOrden: tOrden == null ? 0 : Math.round(tOrden), msTotal: tAll && Math.round(tAll), mosaico: res, costura, heapMB: heap(), fallo: msg || undefined });
  }
  // Fotos reales: sin verdad conocida
  if(nFotos){
    const cans = []; for(let i = 0; i < nFotos; i++){ const im = new Image(); im.src = `/__foto${i}`; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d", { willReadFrequently: true }).drawImage(im, 0, 0); cans.push(c); }
    const small = cans.map(c => { const k = 1100 / c.height, o = document.createElement("canvas"); o.width = Math.round(c.width * k); o.height = 1100; o.getContext("2d", { willReadFrequently: true }).drawImage(c, 0, 0, o.width, o.height); return o; });
    const cam = await R.solveCamera(cv, small, {}), lensInfo = cam.ba?.lens ? ` lente ${cam.ba.lens.accepted ? "k=" + cam.ba.lens.k.map(v => v.toFixed(3)) : "no"}` : "";
    const t0 = performance.now(); let res = null, msg = "";
    try{ const c = await S.stitchLocal(cans, { premium: false, autoCrop: true }); res = [c.width, c.height]; }catch(e){ msg = e.code + ": " + e.message; }
    out.push({ escena: "fotos reales", fotos: cans.length, colocadas: cam.found.filter(Boolean).length, ordenOk: undefined, ba: cam.ba?.used ? `${cam.ba.pairs}p/${cam.ba.shortcuts}a ${cam.ba.medBefore.toFixed(1)}→${cam.ba.medAfter.toFixed(1)}px${lensInfo} f=${cam.f.toFixed(0)}` : "no", msTotal: Math.round(performance.now() - t0), mosaico: res, heapMB: heap(), fallo: msg || undefined });
  }
  return { rows: out, png: window.__png || null };
}, { only: process.env.ESCENAS ? process.env.ESCENAS.split(",") : null, nFotos: FOTOS.length });

if(pngs && process.env.SALIDA) for(const [k, v] of Object.entries(pngs)) fs.writeFileSync(process.env.SALIDA.replace(/\.json$/, `_${k}.png`), Buffer.from(v.split(",")[1], "base64"));
console.table(rows.map(r => ({ escena: r.escena, fotos: r.fotos, colocadas: r.colocadas, orden: r.ordenOk, "focal %": r.focalErrPct, "giro med °": r.giroMedioGrados, "giro máx °": r.giroMaxGrados, ba: r.ba, "solve ms": r.msSolve, "orden ms": r.msOrden, "total ms": r.msTotal, mosaico: r.mosaico?.join("×"), "costura seam": r.costura && `${r.costura.seam.medio}/${r.costura.seam.p95}/${r.costura.seam.doble}%`, "costura mb": r.costura && `${r.costura.multiband.medio}/${r.costura.multiband.p95}/${r.costura.multiband.doble}%`, "heap MB": r.heapMB, fallo: r.fallo })));
if(process.env.SALIDA) fs.writeFileSync(process.env.SALIDA, JSON.stringify(rows, null, 2));
if(errs.length) console.log("Errores de página:", errs.join(" | "));
await b.close(); srv.close();
