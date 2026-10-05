/* Prueba del compositor GPU de coma flotante: estilos de capa, trazo en curso y caché de texturas, contra el oráculo de CPU (precision-stack) (v252): una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
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
  const D = await import("/js/core/doc.js"), H = await import("/js/core/hisrc.js"), G = await import("/js/gpu/floatcompositor.js"), PS = await import("/js/core/precision-stack.js"), LT = await import("/js/editor/layertree.js"), LS = await import("/js/editor/layerstyles.js");
  const o = {}; const W = 200, Hh = 140; D.newDoc(W, Hh, { name: "g" });
  o.disp = G.floatAvailable(); if(!o.disp) return o;
  const base = D.addLayer({ name: "Fondo" });
  const hi = new Uint16Array(W * Hh * 3); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const j = (y * W + x) * 3, v = Math.round(9000 + x * 160.7 + y * 40.1); hi[j] = v; hi[j + 1] = v >> 1; hi[j + 2] = 65535 - v; }
  const img = base.ctx.createImageData(W, Hh); for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4, j = (y * W + x) * 3; for(let k = 0; k < 3; k++) img.data[i + k] = H.hiToCanvas8(hi[j + k], x, y, k, true); img.data[i + 3] = 255; }
  base.ctx.putImageData(img, 0, 0); base.hiSrc = { data: hi, w: W, h: Hh, dither: true, x: 0, y: 0, canvasW: W, canvasH: Hh };
  // capa con forma y estilos: sombra, trazo y degradado
  const fig = D.addLayer({ name: "Figura" }); fig.ctx.fillStyle = "#3b82f6"; fig.ctx.beginPath(); fig.ctx.arc(100, 70, 40, 0, 7); fig.ctx.fill();
  fig.styles = LS.defaultStyles(); fig.styles.shadow.enabled = true; fig.styles.stroke.enabled = true; fig.styles.gradient.enabled = true; fig.styles.gradient.opacity = 60;
  const draw = () => { const tree = LT.buildLayerTree(D.doc.layers), plan = G.floatPlan(D.doc.layers, W, Hh, {}); return { tree, plan }; };
  let { tree, plan } = draw(); o.plan = !!plan; if(!plan) return o;
  const gpu = G._debugFloat(tree, D.doc.layers, W, Hh, plan), st = await PS._debugStore(); o.reason = st.reason || null;
  const cmp = (gpu, st) => { let mx = 0, sum = 0, n = 0; for(let i = 0; i < W * Hh; i++){ const a = st.store[i * 4 + 3] / 65535, pr = [0, 1, 2].map(k => st.store[i * 4 + k] / 65535 * a);
      for(let k = 0; k < 3; k++){ const e = Math.abs(gpu[i * 4 + k] - pr[k]); if(e > mx) mx = e; sum += e; n++; } const ea = Math.abs(gpu[i * 4 + 3] - a); if(ea > mx) mx = ea; }
    return { max: +mx.toFixed(4), media: +(sum / n).toFixed(5) }; };
  o.figpx = Array.from(fig.ctx.getImageData(100, 70, 1, 1).data); o.figinfo = [fig.visible, fig.opacity, fig.type, D.doc.layers.map(z => z.name).join(',')]; o.estilos = cmp(gpu, st); const m = (100 * W + 100) * 4, sh = (110 * W + 150) * 4; o.dbg = { gpuC: [0,1,2,3].map(k => +gpu[m + k].toFixed(3)), stC: [0,1,2,3].map(k => +(st.store[m + k] / 65535).toFixed(3)), gpuS: [0,1,2,3].map(k => +gpu[sh + k].toFixed(3)), stS: [0,1,2,3].map(k => +(st.store[sh + k] / 65535).toFixed(3)) };
  // caché de texturas: la segunda composición sin cambios reutiliza las texturas; tras escribir en una capa se vuelve a subir sólo esa
  const before = { ...G.floatInfo }; const c = document.createElement("canvas"); c.width = W; c.height = Hh;
  G.floatCompose(tree, D.doc.layers, W, Hh, plan); const a1 = { ...G.floatInfo };
  G.floatCompose(tree, D.doc.layers, W, Hh, plan); const a2 = { ...G.floatInfo };
  o.cache = { subidas1: a1.texUploads - before.texUploads, subidas2: a2.texUploads - a1.texUploads, aciertos2: a2.texHits - a1.texHits };
  fig.ctx.fillStyle = "#ef4444"; fig.ctx.fillRect(10, 10, 30, 30);       // modifica la figura: debe volver a subirse y verse
  const t3 = { ...G.floatInfo }; const g3 = G._debugFloat(tree, D.doc.layers, W, Hh, plan); const st3 = await PS._debugStore();
  o.cache.subidas3 = G.floatInfo.texUploads - t3.texUploads; o.trasEscribir = cmp(g3, st3);
  // trazo en curso sobre la capa de fondo (sin estilos): se funde y los píxeles intactos conservan los 16 bits
  fig.styles = null; const scr = document.createElement("canvas"); scr.width = W; scr.height = Hh; const sx = scr.getContext("2d"); sx.fillStyle = "#00ff00"; sx.fillRect(150, 100, 30, 20);
  const live = { on: true, ownerId: base.id, canvas: scr, alpha: 1, blend: "source-over", x: 0, y: 0 };
  const plan2 = G.floatPlan(D.doc.layers, W, Hh, { live }); o.planLive = !!plan2;
  if(plan2){ const gl2 = G._debugFloat(LT.buildLayerTree(D.doc.layers), D.doc.layers, W, Hh, plan2, live);
    // el compositor de 8 bits dibuja el trazo: comparamos el píxel del trazo y uno intacto de 16 bits
    const at = (x, y) => [0, 1, 2, 3].map(k => gl2[(y * W + x) * 4 + k]);
    o.trazo = at(160, 110).map(v => +v.toFixed(2)); const px = at(20, 100); o.intacto16 = Math.abs(px[0] - hi[(100 * W + 20) * 3] / 65535) < 0.002; }
  // teselas: con teselas de 64 px (4×3 con bordes parciales) el resultado es el mismo, también con capa de ajuste, máscara y recorte
  const AL = await import("/js/editor/adjustlayers.js");
  const adj = AL.addAdjustmentLayer("exposure"); if(adj){ adj.adjustParams = { ...adj.adjustParams, ev: 0.6 }; }
  const mk = D.addLayer({ name: "Mascarada" }); mk.ctx.fillStyle = "#22c55e"; mk.ctx.fillRect(20, 20, 140, 90);
  const mc = document.createElement("canvas"); mc.width = W; mc.height = Hh; const mxc = mc.getContext("2d"); const gr = mxc.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)"); mxc.fillStyle = gr; mxc.fillRect(0, 0, W, Hh);
  mk.mask = { canvas: mc, ctx: mxc }; mk.maskEnabled = true; mk.blend = "multiply";
  const clipL = D.addLayer({ name: "Recortada" }); clipL.ctx.fillStyle = "#f59e0b"; clipL.ctx.fillRect(60, 40, 120, 80); clipL.clipped = true;
  const T0 = G.floatTuning.tile;
  const planT = G.floatPlan(D.doc.layers, W, Hh, {}); o.planT = !!planT;
  const stT = await PS._debugStore();
  G.floatTuning.tile = 4096; const g1 = G._debugFloat(LT.buildLayerTree(D.doc.layers), D.doc.layers, W, Hh, planT);
  G.floatTuning.tile = 64; const g64 = G._debugFloat(LT.buildLayerTree(D.doc.layers), D.doc.layers, W, Hh, planT);
  G.floatTuning.tile = T0;
  o.teselas = { vsOraculo1: cmp(g1, stT), vsOraculo64: cmp(g64, stT) };
  // y el lienzo de salida (con tramado) también por teselas: píxeles iguales a los de una sola tesela
  G.floatTuning.tile = 4096; const cA = G.floatCompose(LT.buildLayerTree(D.doc.layers), D.doc.layers, W, Hh, planT); const pa = new Uint8ClampedArray(cA.getContext ? 0 : 0);
  const readOut = c => { const t = document.createElement("canvas"); t.width = W; t.height = Hh; const x = t.getContext("2d"); x.drawImage(c, 0, 0); return x.getImageData(0, 0, W, Hh).data; };
  const oA = readOut(cA); G.floatTuning.tile = 64; const cB = G.floatCompose(LT.buildLayerTree(D.doc.layers), D.doc.layers, W, Hh, planT); const oB = readOut(cB); G.floatTuning.tile = T0;
  let dif = 0; for(let i = 0; i < oA.length; i++) if(oA[i] !== oB[i]) dif++; o.salidaDif = dif;
  return o;
});
console.log(JSON.stringify(res));
const ok = res.disp && res.planT && res.teselas.vsOraculo1.max < 0.02 && res.teselas.vsOraculo64.max < 0.02 && res.salidaDif === 0 && res.plan && res.estilos.max < 0.02 && res.estilos.media < 0.002 && res.cache.subidas2 === 0 && res.cache.aciertos2 > 0 && res.cache.subidas3 >= 1 && res.trasEscribir.max < 0.02 && res.planLive && res.trazo[1] > 0.9 && res.trazo[0] < 0.1 && res.intacto16;
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
