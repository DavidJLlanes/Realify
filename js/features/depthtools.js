/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS DE PROFUNDIDAD (Premium 👑)
   Menú Inteligencia Artificial › Profundidad y su sitio en el cajón.
   Todas parten del mapa de Depth Anything V2 (js/ai/depth.js), ya
   ajustado a los bordes reales de la foto.

     · Desenfoque por profundidad: toca donde quieras enfocar; lo que
       está más cerca o más lejos se desenfoca en proporción a su
       distancia, como con un objetivo luminoso.
     · Niebla por distancia: bruma que crece con la distancia, del
       color de lo más lejano de la foto (o blanca, cálida, fría).
     · Foto 3D: animación con paralaje (lo cercano se mueve más que lo
       lejano) que se guarda como GIF.

   Procesado Premium («el bueno y el mejor»):
     · Bueno: mezcla en luz lineal y mapa de profundidad afinado a los
       bordes de la foto.
     · Mejor: el desenfoque se hace por capas de distancia con
       convolución normalizada —lo nítido NO se derrama sobre el fondo
       desenfocado, sin halos alrededor de la persona—; las luces
       intensas se abren en «bokeh» como en una lente real y se
       devuelve el grano original a las zonas desenfocadas; la niebla se
       trama para que no haga escalones en el cielo; la foto 3D rellena
       los huecos que deja el paralaje con el fondo, no con estiramientos.
   Desenfoque y niebla van a una capa nueva.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../core/doc.js";
import { toast, status } from "../ui/toast.js";
import { depthMap, depthAt } from "../ai/depth.js";
import { boxBlurFloat } from "../editor/refineedge-math.js";

const DEC = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; DEC[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
const enc = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
const hash = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const PREVIEW = 1280;   // lado largo de la vista previa

/* Lo que se ve (la imagen compuesta), en un lienzo legible */
async function visibleImage(){
  if(!doc.open || !activeLayer()){ toast("Abre una imagen primero"); return null; }
  const { flatten } = await import("../editor/layertree.js");
  const c = flatten();
  const r = document.createElement("canvas"); r.width = c.width; r.height = c.height;
  r.getContext("2d", { willReadFrequently: true }).drawImage(c, 0, 0);
  return r;
}

function scaled(src, side){
  const k = Math.min(1, side / Math.max(src.width, src.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const pixelsOf = c => c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;

/* Foto (a w×h) en luz lineal y su profundidad afinada */
function prepare(canvas, map){
  const w = canvas.width, h = canvas.height, n = w * h, px = pixelsOf(canvas);
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n);
  for(let i = 0, j = 0; i < n; i++, j += 4){ R[i] = DEC[px[j]]; G[i] = DEC[px[j + 1]]; B[i] = DEC[px[j + 2]]; }
  return { w, h, n, px, R, G, B, d: depthAt(map, w, h, px) };
}

/* Mapa de profundidad (con la ventana de progreso) o null si se cancela */
async function getDepth(src){
  try{ return await depthMap(src); }
  catch(err){ if(!err.cancelled) toast("No se pudo calcular la profundidad: " + err.message, "err"); return null; }
}

/* Capa nueva encima de la activa, un paso de deshacer */
async function toNewLayer(canvas, name){
  const { resultToLayer } = await import("../ui/fsshell.js");
  await resultToLayer(canvas, { name, mix: true });
}

/* Ventana a pantalla completa común: vista, comparar y mandos */
async function openShell(opts){
  const { createShell, ensureShellStyles, mountControls } = await import("../ui/fsshell.js");
  await ensureShellStyles();
  const sh = createShell({ cls: "depth-tool", ...opts });
  return { sh, mountControls };
}

/* ── Desenfoque ──────────────────────────────────────────────── */

/* Media por bloques f×f (para desenfocar mucho sin coste) */
function down(a, w, h, f){
  const w2 = Math.max(1, Math.ceil(w / f)), h2 = Math.max(1, Math.ceil(h / f)), o = new Float32Array(w2 * h2), c = new Float32Array(w2 * h2);
  for(let y = 0; y < h; y++){ const yy = (y / f | 0) * w2; for(let x = 0; x < w; x++){ const q = yy + (x / f | 0); o[q] += a[y * w + x]; c[q]++; } }
  for(let i = 0; i < o.length; i++) o[i] /= c[i];
  return { a: o, w: w2, h: h2 };
}
function up(s, w, h, f){
  const o = new Float32Array(w * h), { a, w: w2, h: h2 } = s;
  for(let y = 0; y < h; y++){
    const fy = Math.min(h2 - 1, Math.max(0, (y + 0.5) / f - 0.5)), y0 = fy | 0, y1 = Math.min(h2 - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < w; x++){
      const fx = Math.min(w2 - 1, Math.max(0, (x + 0.5) / f - 0.5)), x0 = fx | 0, x1 = Math.min(w2 - 1, x0 + 1), tx = fx - x0;
      const p = a[y0 * w2 + x0] + (a[y0 * w2 + x1] - a[y0 * w2 + x0]) * tx, q = a[y1 * w2 + x0] + (a[y1 * w2 + x1] - a[y1 * w2 + x0]) * tx;
      o[y * w + x] = p + (q - p) * ty;
    }
  }
  return o;
}
/* Desenfoque casi gaussiano de desviación ≈ r/2 (tres cajas), a menor
   resolución cuando el radio es grande */
function blurMany(chans, w, h, r){
  const f = Math.max(1, Math.min(8, Math.floor(r / 6)));
  const b = Math.max(1, Math.round(r * 0.5 / f));
  return chans.map(a => {
    if(f === 1){ let o = a; for(let t = 0; t < 3; t++) o = boxBlurFloat(o, w, h, b); return o; }
    const s = down(a, w, h, f);
    let o = s.a; for(let t = 0; t < 3; t++) o = boxBlurFloat(o, s.w, s.h, b);
    return up({ a: o, w: s.w, h: s.h }, w, h, f);
  });
}

/* Ruido de la foto (en valores codificados 0-1): mediana del detalle fino */
function grainOf(px, w, h){
  const L = new Float32Array(w * h);
  for(let i = 0, j = 0; i < L.length; i++, j += 4) L[i] = (px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114) / 255;
  const m = boxBlurFloat(L, w, h, 1), diffs = [];
  for(let i = 0; i < L.length; i += 7) diffs.push(Math.abs(L[i] - m[i]));
  diffs.sort((a, b) => a - b);
  return Math.min(0.03, 1.4826 * diffs[diffs.length >> 1] * 1.2);
}

/** Desenfoque por profundidad. `S`: { fx, fy (0-1), amount, dof }. */
function renderDepthBlur(P, S){
  const { w, h, n, R, G, B, d, px } = P;
  const fi = Math.min(h - 1, Math.round(S.fy * h)) * w + Math.min(w - 1, Math.round(S.fx * w));
  // Profundidad del punto enfocado: media de un entorno pequeño
  let dF = 0, cnt = 0; const rr = Math.max(1, Math.round(Math.max(w, h) / 200)), cy = fi / w | 0, cx = fi % w;
  for(let y = Math.max(0, cy - rr); y <= Math.min(h - 1, cy + rr); y++) for(let x = Math.max(0, cx - rr); x <= Math.min(w - 1, cx + rr); x++){ dF += d[y * w + x]; cnt++; }
  dF /= cnt;
  const Rmax = Math.max(w, h) * 0.028 * S.amount / 100;
  const dof = 0.02 + 0.3 * S.dof / 100;
  const coc = new Float32Array(n);
  for(let i = 0; i < n; i++){ const e = Math.max(0, Math.abs(d[i] - dF) - dof) / Math.max(0.05, 1 - dof); coc[i] = Rmax * Math.min(1, e * 1.6); }
  const out = new Uint8ClampedArray(n * 4);
  if(Rmax < 0.6){ out.set(px); return out; }
  // Luces intensas: se refuerzan antes de desenfocar (bokeh)
  const hR = new Float32Array(n), hG = new Float32Array(n), hB = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const l = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i], s = clamp01((l - 0.72) / 0.28), g = 1 + 3 * s * s;
    hR[i] = R[i] * g; hG[i] = G[i] * g; hB[i] = B[i] * g;
  }
  // Capas de desenfoque creciente; cada una sólo con los píxeles que
  // deben estar al menos así de desenfocados (convolución normalizada)
  const N = 6, levels = [null];
  for(let k = 1; k <= N; k++){
    const r = Rmax * k / N, M = new Float32Array(n);
    for(let i = 0; i < n; i++) M[i] = clamp01(coc[i] / r * 2 - 0.5);
    const Mr = new Float32Array(n), Mg = new Float32Array(n), Mb = new Float32Array(n);
    for(let i = 0; i < n; i++){ Mr[i] = hR[i] * M[i]; Mg[i] = hG[i] * M[i]; Mb[i] = hB[i] * M[i]; }
    const [bR, bG, bB, bM] = blurMany([Mr, Mg, Mb, M], w, h, r);
    for(let i = 0; i < n; i++){
      const m = bM[i];
      if(m > 1e-3){ bR[i] /= m; bG[i] /= m; bB[i] /= m; }
      else { bR[i] = R[i]; bG[i] = G[i]; bB[i] = B[i]; }
      // Donde casi no hay vecinos desenfocados, se va hacia el original
      const t = clamp01(m * 4);
      bR[i] = R[i] + (bR[i] - R[i]) * t; bG[i] = G[i] + (bG[i] - G[i]) * t; bB[i] = B[i] + (bB[i] - B[i]) * t;
    }
    levels.push([bR, bG, bB]);
  }
  const grain = grainOf(px, w, h);
  for(let i = 0, j = 0; i < n; i++, j += 4){
    const t = coc[i] / Rmax * N, k = Math.min(N - 1, t | 0), f = t - k;
    const a = levels[k], b = levels[k + 1];
    const r = (a ? a[0][i] : R[i]) * (1 - f) + b[0][i] * f;
    const g = (a ? a[1][i] : G[i]) * (1 - f) + b[1][i] * f;
    const bl = (a ? a[2][i] : B[i]) * (1 - f) + b[2][i] * f;
    // Grano original de vuelta donde se ha desenfocado
    const wgt = Math.min(1, t / 2), nz = (hash(i) + hash(i + 7919) - 1) * grain * 1.7 * wgt * 255;
    out[j] = enc(r) + nz; out[j + 1] = enc(g) + nz; out[j + 2] = enc(bl) + nz; out[j + 3] = 255;
  }
  return out;
}

/* Punto enfocado por defecto: lo que más SOBRESALE de lo que tiene a
   los lados (una persona delante del fondo), no lo más cercano —eso
   suele ser el suelo al pie de la foto—, con algo de extensión y una
   ligera preferencia por el centro */
function defaultFocus(P){
  const { w, h, d } = P;
  const step = Math.max(1, Math.round(Math.max(w, h) / 64)), r = step * 2;
  const rowMed = new Float32Array(h);
  for(let y = 0; y < h; y += step){
    const row = []; for(let x = 0; x < w; x += step) row.push(d[y * w + x]);
    row.sort((a, b) => a - b); rowMed[y] = row[row.length >> 1];
  }
  let best = -Infinity, bx = 0.5, by = 0.5;
  for(let y = r - r % step; y < h - r; y += step) for(let x = r; x < w - r; x += step){
    let s = 0, c = 0;
    for(let yy = y - r; yy <= y + r; yy += step) for(let xx = x - r; xx <= x + r; xx += step){ s += d[yy * w + xx] - rowMed[yy - yy % step]; c++; }
    const v = s / c - 0.15 * Math.hypot(x / w - 0.5, y / h - 0.45);
    if(v > best){ best = v; bx = x / w; by = y / h; }
  }
  return { fx: bx, fy: by };
}

let blurOpen = false;
export async function openDepthBlur(){
  if(blurOpen) return;
  const src = await visibleImage(); if(!src) return;
  const map = await getDepth(src); if(!map) return;
  blurOpen = true;
  const small = scaled(src, PREVIEW), P = prepare(small, map);
  const S = { ...defaultFocus(P), amount: 60, dof: 20 };
  const view = document.createElement("canvas"); view.width = P.w; view.height = P.h;
  const vx = view.getContext("2d");
  let busy = 0;
  const render = () => {
    const id = ++busy;
    requestAnimationFrame(() => {
      if(id !== busy || sh.closed) return;
      vx.putImageData(new ImageData(renderDepthBlur(P, S), P.w, P.h), 0, 0);
      sh.setView(view);
    });
  };
  const close = () => { blurOpen = false; sh.close(); };
  const { sh, mountControls } = await openShell({
    title: "Desenfoque por profundidad", subtitle: "Premium 👑 · toca donde quieras enfocar", applyLabel: "Aplicar",
    onCancel: close,
    onApply: async () => {
      sh.setBusy("Desenfocando a resolución completa…");
      await new Promise(r => setTimeout(r, 30));
      try{
        const full = prepare(src, map);
        const c = document.createElement("canvas"); c.width = full.w; c.height = full.h;
        c.getContext("2d").putImageData(new ImageData(renderDepthBlur(full, S), full.w, full.h), 0, 0);
        close(); await toNewLayer(c, "Desenfoque por profundidad");
        toast("Desenfoque aplicado en una capa nueva", "ok");
      } catch(err){ sh.setBusy(""); toast("No se pudo aplicar: " + err.message, "err"); }
    }
  });
  sh.setOriginal(small);
  sh.setOverlay((cx, t) => {
    const x = t.ox + S.fx * P.w * t.k, y = t.oy + S.fy * P.h * t.k, r = 14 * t.dpr;
    cx.lineWidth = 2 * t.dpr; cx.strokeStyle = "#e8a33d";
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.stroke();
    cx.beginPath(); cx.moveTo(x - r * 1.6, y); cx.lineTo(x - r * 0.6, y); cx.moveTo(x + r * 0.6, y); cx.lineTo(x + r * 1.6, y);
    cx.moveTo(x, y - r * 1.6); cx.lineTo(x, y - r * 0.6); cx.moveTo(x, y + r * 0.6); cx.lineTo(x, y + r * 1.6); cx.stroke();
  });
  let down0 = null;
  sh.setInteract((type, p, e) => {
    if(type === "down"){ down0 = { x: e.clientX, y: e.clientY }; return true; }
    if(type === "up" && down0 && p){
      if(Math.hypot(e.clientX - down0.x, e.clientY - down0.y) < 10 && p.x >= 0 && p.y >= 0 && p.x < P.w && p.y < P.h){
        S.fx = p.x / P.w; S.fy = p.y / P.h; render();
      }
      down0 = null;
    }
    return false;
  });
  mountControls(sh, {
    sections: [{ id: "b", label: "Desenfoque", props: [
      { key: "amount", label: "Desenfoque", type: "range", min: 0, max: 100, def: 60 },
      { key: "dof", label: "Zona nítida", type: "range", min: 0, max: 100, def: 20 }
    ] }],
    get: k => S[k], set: (k, v) => { S[k] = v; render(); }
  });
  render();
}

/* ── Niebla ──────────────────────────────────────────────────── */
const FOG_TINT = { auto: null, white: [0.85, 0.87, 0.9], warm: [0.9, 0.78, 0.62], cool: [0.62, 0.72, 0.86] };

/* Color de la niebla «automático»: el de lo más lejano de la foto,
   aclarado y apagado (la bruma real toma el color del cielo) */
function farColor(P){
  const { n, R, G, B, d } = P, idx = [];
  for(let i = 0; i < n; i += 3) idx.push(i);
  idx.sort((a, b) => d[a] - d[b]);
  const m = Math.max(1, idx.length * 0.06 | 0), s = [0, 0, 0];
  for(let k = 0; k < m; k++){ const i = idx[k]; s[0] += R[i]; s[1] += G[i]; s[2] += B[i]; }
  const c = s.map(v => v / m), l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], L = Math.max(0.45, Math.min(0.85, l));
  return c.map(v => 0.45 * (v / Math.max(1e-4, l)) * L + 0.55 * L);
}

function renderFog(P, S, tint){
  const { n, R, G, B, d } = P, out = new Uint8ClampedArray(n * 4);
  // Opacidad máxima según la densidad; crece con la distancia de forma
  // suave (lo cercano casi limpio, lo lejano velado)
  const top = 0.92 * S.density / 100, start = 0.85 * S.start / 100;
  for(let i = 0, j = 0; i < n; i++, j += 4){
    const t = clamp01(((1 - d[i]) - start) / Math.max(0.1, 1 - start)), sm = t * t * (3 - 2 * t);
    const f = top * sm * Math.sqrt(sm);
    const nz = (hash(i) - 0.5) * 0.9;     // tramado: sin escalones en degradados
    out[j] = enc(R[i] + (tint[0] - R[i]) * f) + nz;
    out[j + 1] = enc(G[i] + (tint[1] - G[i]) * f) + nz;
    out[j + 2] = enc(B[i] + (tint[2] - B[i]) * f) + nz;
    out[j + 3] = 255;
  }
  return out;
}

let fogOpen = false;
export async function openDepthFog(){
  if(fogOpen) return;
  const src = await visibleImage(); if(!src) return;
  const map = await getDepth(src); if(!map) return;
  fogOpen = true;
  const small = scaled(src, PREVIEW), P = prepare(small, map), auto = farColor(P);
  const S = { color: "auto", density: 50, start: 30 };
  const tintOf = () => FOG_TINT[S.color] || auto;
  const view = document.createElement("canvas"); view.width = P.w; view.height = P.h;
  const vx = view.getContext("2d");
  let busy = 0;
  const render = () => {
    const id = ++busy;
    requestAnimationFrame(() => {
      if(id !== busy || sh.closed) return;
      vx.putImageData(new ImageData(renderFog(P, S, tintOf()), P.w, P.h), 0, 0);
      sh.setView(view);
    });
  };
  const close = () => { fogOpen = false; sh.close(); };
  const { sh, mountControls } = await openShell({
    title: "Niebla por distancia", subtitle: "Premium 👑", applyLabel: "Aplicar",
    onCancel: close,
    onApply: async () => {
      sh.setBusy("Aplicando a resolución completa…");
      await new Promise(r => setTimeout(r, 30));
      try{
        const full = prepare(src, map);
        const c = document.createElement("canvas"); c.width = full.w; c.height = full.h;
        c.getContext("2d").putImageData(new ImageData(renderFog(full, S, tintOf()), full.w, full.h), 0, 0);
        close(); await toNewLayer(c, "Niebla por distancia");
        toast("Niebla aplicada en una capa nueva", "ok");
      } catch(err){ sh.setBusy(""); toast("No se pudo aplicar: " + err.message, "err"); }
    }
  });
  sh.setOriginal(small);
  mountControls(sh, {
    sections: [{ id: "f", label: "Niebla", props: [
      { key: "density", label: "Densidad", type: "range", min: 0, max: 100, def: 50 },
      { key: "start", label: "Empieza a", type: "range", min: 0, max: 100, def: 30, unit: " %" },
      { key: "color", label: "Color", type: "select", options: [["auto", "Automático"], ["white", "Blanca"], ["warm", "Cálida"], ["cool", "Fría"]] }
    ] }],
    get: k => S[k], set: (k, v) => { S[k] = v; render(); }
  });
  render();
}

/* ── Foto 3D ─────────────────────────────────────────────────── */
const GIF_SIDE = 720, FRAMES = 30;

/* Fondo para los huecos del paralaje: cada píxel toma el color del
   vecino MÁS LEJANO de su entorno (lo que queda detrás al moverse) */
function backfill(P){
  const { w, h, n, px, d } = P, r = Math.max(2, Math.round(Math.max(w, h) / 90)), out = new Uint8ClampedArray(px);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    let bi = y * w + x, bd = d[bi];
    for(let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy += 2) for(let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx += 2){
      const q = yy * w + xx; if(d[q] < bd - 0.02){ bd = d[q]; bi = q; }
    }
    const i = (y * w + x) * 4, s = bi * 4;
    out[i] = px[s]; out[i + 1] = px[s + 1]; out[i + 2] = px[s + 2];
  }
  return out;
}

/* Un fotograma: lo más cercano se desplaza (dx, dy) píxeles y, con
   `push`, se acerca (paralaje radial); el punto de apoyo (lo que no se
   mueve) es la profundidad `pivot`; `zoom` esconde los bordes */
function frame3D(P, bg, dx, dy, push, zoom, pivot, out){
  const { w, h, px, d } = P;
  const cx = w / 2, cy = h / 2;
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const bx = cx + (x - cx) / zoom, by = cy + (y - cy) / zoom;
    // Origen del píxel: se itera porque la profundidad es la del origen
    let sx = bx, sy = by, z = 0;
    for(let it = 0; it < 3; it++){
      const qx = Math.min(w - 1, Math.max(0, sx | 0)), qy = Math.min(h - 1, Math.max(0, sy | 0));
      z = d[qy * w + qx] - pivot;
      sx = bx - dx * z - push * z * (bx - cx); sy = by - dy * z - push * z * (by - cy);
    }
    const qx = Math.min(w - 1, Math.max(0, Math.round(sx))), qy = Math.min(h - 1, Math.max(0, Math.round(sy)));
    const s = (qy * w + qx) * 4, o = (y * w + x) * 4;
    // Si el origen no casa con la profundidad buscada, es una zona que
    // se ha destapado: se usa el fondo reconstruido
    const zz = d[qy * w + qx] - pivot, src = Math.abs(zz - z) > 0.08 ? bg : px;
    out[o] = src[s]; out[o + 1] = src[s + 1]; out[o + 2] = src[s + 2]; out[o + 3] = 255;
  }
}

/* Recorridos: [x, y, acercamiento] a lo largo del ciclo */
const PATHS = {
  circle: t => [Math.cos(t), Math.sin(t) * 0.6, 0],
  horizontal: t => [Math.sin(t), 0, 0],
  zoom: t => [0, 0, (1 - Math.cos(t)) / 2]
};

let d3Open = false;
export async function openPhoto3D(){
  if(d3Open) return;
  const src = await visibleImage(); if(!src) return;
  const map = await getDepth(src); if(!map) return;
  d3Open = true;
  const small = scaled(src, GIF_SIDE), P = prepare(small, map), bg = backfill(P);
  // Punto de apoyo: una profundidad media-alta (el sujeto casi quieto)
  const sorted = Float32Array.from(P.d).sort(), pivot = sorted[sorted.length * 0.7 | 0];
  const S = { amount: 50, path: "circle" };
  const view = document.createElement("canvas"); view.width = P.w; view.height = P.h;
  const vx = view.getContext("2d"), buf = new Uint8ClampedArray(P.w * P.h * 4);
  const drawFrame = (f, into) => {
    const t = f / FRAMES * Math.PI * 2, [a, b, zm] = PATHS[S.path](t), k = S.amount / 100;
    const amp = Math.max(P.w, P.h) * 0.035 * k;
    frame3D(P, bg, a * amp, b * amp, zm * 0.12 * k, 1 + 0.04 * k, pivot, into);
  };
  let f = 0;
  const timer = setInterval(() => {
    if(sh.closed) return;
    drawFrame(f, buf); vx.putImageData(new ImageData(buf, P.w, P.h), 0, 0); sh.setView(view);
    f = (f + 1) % FRAMES;
  }, 70);
  const close = () => { d3Open = false; clearInterval(timer); sh.close(); };
  /* Guardar como corresponde en cada sistema:
       · iPhone/iPad: la hoja del sistema («Guardar imagen» → Fotos).
         Safari sólo la abre justo tras un toque: crear el GIF tarda, así
         que va en dos pasos («Crear GIF» y, ya listo, «Guardar»).
       · Android: descarga (Descargas, se ve en la galería).
       · Ordenador: descarga. */
  const { isAndroid } = await import("../core/device.js");
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Mac/.test(navigator.platform || "") && navigator.maxTouchPoints > 1);
  const baseName = (doc.name || "foto").replace(/\.[^.]+$/, "") + "-3d.gif";
  let ready = null;   // el GIF ya creado (iPhone, a la espera del toque de Guardar)
  const saveGif = async blob => {
    const { saveOrShare } = await import("../io/export.js");
    const how = await saveOrShare(blob, baseName, ios ? "share" : isAndroid() ? "download" : "auto");
    if(how === "cancelled"){ toast("No se ha guardado: pulsa Guardar otra vez cuando quieras"); return false; }
    toast(how === "shared" ? "Foto 3D lista: elige «Guardar imagen» para tenerla en Fotos" : "Foto 3D guardada como GIF (Descargas)", "ok");
    return true;
  };
  const { sh, mountControls } = await openShell({
    title: "Foto 3D", subtitle: "Premium 👑 · se guarda como GIF animado", applyLabel: ios ? "Crear GIF" : "Guardar GIF",
    onCancel: close,
    onApply: async () => {
      if(ready){ if(await saveGif(ready)) close(); return; }
      sh.setBusy("Creando el GIF…");
      await new Promise(r => setTimeout(r, 30));
      try{
        const frames = [];
        for(let k = 0; k < FRAMES; k++){
          const c = document.createElement("canvas"); c.width = P.w; c.height = P.h;
          const b = new Uint8ClampedArray(P.w * P.h * 4); drawFrame(k, b);
          c.getContext("2d", { willReadFrequently: true }).putImageData(new ImageData(b, P.w, P.h), 0, 0);
          frames.push(c);
        }
        const { gifFromCanvases } = await import("../io/formats.js");
        const blob = await gifFromCanvases(frames, { delay: 70, loop: 0, onProgress: p => sh.setBusy(`Creando el GIF… ${Math.round(p * 100)} %`) });
        sh.setBusy("");
        if(ios){
          // Segundo paso: un toque nuevo para que Safari abra la hoja
          ready = blob;
          sh.setApplyLabel("Guardar");
          sh.setSubtitle("GIF listo · pulsa Guardar");
          return;
        }
        if(await saveGif(blob)) close();
      } catch(err){ sh.setBusy(""); toast("No se pudo crear el GIF: " + err.message, "err"); }
    }
  });
  sh.setOriginal(small);
  mountControls(sh, {
    sections: [{ id: "m", label: "Movimiento", props: [
      { key: "amount", label: "Movimiento", type: "range", min: 10, max: 100, def: 50 },
      { key: "path", label: "Recorrido", type: "select", options: [["circle", "Círculo"], ["horizontal", "Lateral"], ["zoom", "Acercar"]] }
    ] }],
    get: k => S[k], set: (k, v) => {
      S[k] = v;
      // Otro movimiento: el GIF creado ya no vale
      if(ready){ ready = null; sh.setApplyLabel("Crear GIF"); sh.setSubtitle("Premium 👑 · se guarda como GIF animado"); }
    }
  });
}
