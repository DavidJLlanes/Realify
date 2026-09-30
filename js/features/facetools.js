/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS DE CARAS (Premium 👑)
   Menú Inteligencia Artificial › Caras y su pestaña del cajón. Todas
   parten de la detección de caras con YuNet (js/ai/faces.js).

     · Difuminar caras: privacidad. Ventana a pantalla completa con las
       caras encontradas; un toque en una la excluye o la vuelve a
       incluir. Estilo (desenfoque, pixelado, relleno) e intensidad.
       Premium: la zona es un óvalo ajustado a la cara (con frente y
       barbilla) de borde suave; el desenfoque se hace en luz lineal
       DESPUÉS de pixelar y con algo de ruido, así no se puede
       «desenfocar al revés» para reconstruir la cara.
     · Ojos rojos: un toque. En cada ojo se buscan los píxeles rojos
       conectados con la pupila (sólo cerca del punto del ojo) y se les
       quita el rojo en luz lineal conservando el brillo del reflejo.
     · Recorte de retrato: abre Recortar con el marco ya encuadrado en
       la cara (ojos en el tercio superior, cabeza y hombros).
   Los resultados de difuminar y de ojos rojos van a una capa nueva.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../core/doc.js";
import { toast, status } from "../ui/toast.js";
import { detectFaces } from "../ai/faces.js";
import { boxBlurFloat } from "../editor/refineedge-math.js";

const DEC = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; DEC[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
const enc = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
const hash = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

/* Las caras se buscan en lo que se VE (la imagen compuesta), no sólo en
   la capa activa: tras difuminar, por ejemplo, la activa es la capa
   nueva, casi transparente. */
async function visibleImage(){
  if(!doc.open || !activeLayer()){ toast("Abre una imagen primero"); return null; }
  const { flatten } = await import("../editor/layertree.js");
  const c = flatten();
  // flatten puede dejar el lienzo en la GPU: una copia legible
  const r = document.createElement("canvas"); r.width = c.width; r.height = c.height;
  r.getContext("2d", { willReadFrequently: true }).drawImage(c, 0, 0);
  return r;
}

/* Capa nueva encima de la activa con `canvas`, un paso de deshacer */
async function toNewLayer(canvas, name){
  const [{ addLayer }, { record }, { emit }] = await Promise.all([import("../core/doc.js"), import("../core/history.js"), import("../core/bus.js")]);
  const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
  const l = addLayer({ name });
  l.ctx.drawImage(canvas, 0, 0);
  l.thumbDirty = true;
  const nextLayers = doc.layers.slice(), nextActive = l.id;
  const put = (layers, active) => { doc.layers = layers.slice(); doc.activeId = active; emit("doc:structure"); emit("doc:change"); };
  record(name, () => put(prevLayers, prevActive), () => put(nextLayers, nextActive));
  emit("doc:structure"); emit("doc:change");
}

async function findFaces(src){
  status("Buscando caras…");
  try{ return await detectFaces(src); }
  finally{ status(""); }
}

/* ── Óvalo de la cara (con frente y barbilla) ── */
const oval = f => ({ cx: f.x + f.w / 2, cy: f.y + f.h * 0.46, rx: f.w * 0.62, ry: f.h * 0.72 });

/* Alfa del óvalo (0-1) en un rectángulo, con el borde suave */
function ovalAlpha(o, x, y){
  const d = Math.hypot((x - o.cx) / o.rx, (y - o.cy) / o.ry);
  return d <= 0.85 ? 1 : d >= 1 ? 0 : (1 - d) / 0.15;
}

/* Efecto sobre el recuadro de una cara (en `d`, RGBA de la foto entera) */
function renderFace(src, W, H, f, style, amount, out){
  const o = oval(f);
  const x0 = Math.max(0, Math.floor(o.cx - o.rx)), y0 = Math.max(0, Math.floor(o.cy - o.ry));
  const x1 = Math.min(W, Math.ceil(o.cx + o.rx)), y1 = Math.min(H, Math.ceil(o.cy + o.ry));
  const w = x1 - x0, h = y1 - y0;
  if(w < 2 || h < 2) return;
  const k = amount / 100;
  // Tamaño del bloque: del 4 % al 16 % del ancho de la cara
  const block = Math.max(2, Math.round(f.w * (0.04 + 0.12 * k)));
  const col = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
  if(style === "solid"){
    // Color medio de la cara, en luz lineal
    const s = [0, 0, 0]; let n = 0;
    for(let y = y0; y < y1; y++) for(let x = x0; x < x1; x++){ if(ovalAlpha(o, x, y) < 1) continue; const i = (y * W + x) * 4; s[0] += DEC[src[i]]; s[1] += DEC[src[i + 1]]; s[2] += DEC[src[i + 2]]; n++; }
    for(let c = 0; c < 3; c++) col[c].fill(n ? s[c] / n : 0.2);
  } else {
    // Pixelado en luz lineal (media de cada bloque)
    for(let by = 0; by < h; by += block) for(let bx = 0; bx < w; bx += block){
      const s = [0, 0, 0]; let n = 0;
      for(let y = by; y < Math.min(h, by + block); y++) for(let x = bx; x < Math.min(w, bx + block); x++){
        const i = ((y0 + y) * W + x0 + x) * 4; s[0] += DEC[src[i]]; s[1] += DEC[src[i + 1]]; s[2] += DEC[src[i + 2]]; n++;
      }
      for(let y = by; y < Math.min(h, by + block); y++) for(let x = bx; x < Math.min(w, bx + block); x++)
        for(let c = 0; c < 3; c++) col[c][y * w + x] = s[c] / n;
    }
    // Desenfoque: tres cajas (≈ gaussiano) sobre el pixelado + ruido
    if(style === "blur"){
      const r = Math.max(1, Math.round(block * 0.9));
      for(let c = 0; c < 3; c++){ let a = col[c]; for(let t = 0; t < 3; t++) a = boxBlurFloat(a, w, h, r); col[c] = a; }
      for(let p = 0; p < w * h; p++){ const nz = (hash(p + x0 * 7919 + y0 * 104729) - 0.5) * 0.012; for(let c = 0; c < 3; c++) col[c][p] = Math.max(0, col[c][p] + nz); }
    }
  }
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const a = ovalAlpha(o, x0 + x, y0 + y); if(a <= 0) continue;
    const i = ((y0 + y) * W + x0 + x) * 4, p = y * w + x;
    const prev = out[i + 3] / 255, na = Math.max(prev, a);
    for(let c = 0; c < 3; c++) out[i + c] = Math.round(enc(col[c][p]));
    out[i + 3] = Math.round(na * 255);
  }
}

/* ── Difuminar caras ─────────────────────────────────────────── */
let blurOpen = false;
export async function openFaceBlur(){
  if(blurOpen) return;
  const src = await visibleImage(); if(!src) return;
  const W = src.width, H = src.height;
  let faces;
  try{ faces = await findFaces(src); }
  catch(err){ if(!err.cancelled) toast("No se pudieron buscar caras: " + err.message, "err"); return; }
  if(!faces.length){ toast("No se han encontrado caras en esta foto"); return; }
  blurOpen = true;
  const { createShell, ensureShellStyles } = await import("../ui/fsshell.js");
  await ensureShellStyles();
  const S = { style: "blur", amount: 60, on: faces.map(() => true) };
  const rgba = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const view = document.createElement("canvas"); view.width = W; view.height = H;
  const vx = view.getContext("2d");
  let layerPx = null;
  const render = () => {
    layerPx = new Uint8ClampedArray(W * H * 4);
    faces.forEach((f, i) => { if(S.on[i]) renderFace(rgba, W, H, f, S.style, S.amount, layerPx); });
    vx.clearRect(0, 0, W, H); vx.drawImage(src, 0, 0);
    const t = document.createElement("canvas"); t.width = W; t.height = H;
    t.getContext("2d").putImageData(new ImageData(layerPx, W, H), 0, 0);
    vx.drawImage(t, 0, 0);
    sh.setView(view); sh.setApplyEnabled(S.on.some(Boolean));
    sh.setSubtitle(`Premium 👑 · ${S.on.filter(Boolean).length} de ${faces.length} caras · toca una para quitarla o ponerla`);
  };
  const close = () => { blurOpen = false; sh.close(); };
  const sh = createShell({
    title: "Difuminar caras", applyLabel: "Aplicar", cls: "face-tool",
    onCancel: close,
    onApply: async () => {
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      c.getContext("2d").putImageData(new ImageData(layerPx, W, H), 0, 0);
      close(); await toNewLayer(c, "Caras difuminadas"); toast("Caras difuminadas en una capa nueva", "ok");
    }
  });
  sh.setOriginal(src);
  sh.setOverlay((cx, t) => {
    faces.forEach((f, i) => {
      cx.setLineDash(S.on[i] ? [] : [6 * t.dpr, 5 * t.dpr]);
      cx.lineWidth = 2 * t.dpr; cx.strokeStyle = S.on[i] ? "#e8a33d" : "#ffffffaa";
      const o = oval(f);
      cx.beginPath(); cx.ellipse(t.ox + o.cx * t.k, t.oy + o.cy * t.k, o.rx * t.k, o.ry * t.k, 0, 0, Math.PI * 2); cx.stroke();
    });
  });
  let down = null;
  sh.setInteract((type, p, e) => {
    if(type === "down"){
      const i = faces.findIndex(f => { const o = oval(f); return Math.hypot((p.x - o.cx) / o.rx, (p.y - o.cy) / o.ry) <= 1; });
      if(i < 0) return false;
      down = { i, x: e.clientX, y: e.clientY }; return true;
    }
    if(type === "up" && down){
      if(Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10){ S.on[down.i] = !S.on[down.i]; render(); }
      down = null;
    }
    return false;
  });
  // Mandos mínimos: estilo e intensidad (los desplegables, cerrados)
  const controls = () => {
    const el = document.createElement("div");
    el.className = "face-ctl";
    el.innerHTML = `<select aria-label="Estilo"><option value="blur">Desenfoque</option><option value="pixel">Pixelado</option><option value="solid">Relleno</option></select>
      <input type="range" min="0" max="100" aria-label="Intensidad">`;
    const sel = el.querySelector("select"), rng = el.querySelector("input");
    sel.value = S.style; rng.value = S.amount;
    sel.addEventListener("change", () => { S.style = sel.value; sync(); render(); });
    rng.addEventListener("input", () => { S.amount = +rng.value; sync(); render(); });
    return el;
  };
  const sync = () => sh.root.querySelectorAll(".face-ctl").forEach(el => {
    el.querySelector("select").value = S.style; el.querySelector("input").value = S.amount;
    el.querySelector("input").disabled = S.style === "solid";
  });
  sh.mobile.appendChild(controls());
  sh.right.appendChild(controls());
  render();
}

/* ── Ojos rojos ──────────────────────────────────────────────── */
export async function fixRedEyes(){
  const src = await visibleImage(); if(!src) return;
  const W = src.width, H = src.height;
  let faces;
  try{ faces = await findFaces(src); }
  catch(err){ if(!err.cancelled) toast("No se pudieron buscar caras: " + err.message, "err"); return; }
  if(!faces.length){ toast("No se han encontrado caras en esta foto"); return; }
  const rgba = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const out = new Uint8ClampedArray(W * H * 4);
  let fixed = 0;
  for(const f of faces){
    const [a, b] = f.eyes, dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for(const [ex, ey] of f.eyes){
      const R = Math.max(3, dist * 0.2);
      const x0 = Math.max(0, Math.floor(ex - R)), y0 = Math.max(0, Math.floor(ey - R));
      const x1 = Math.min(W, Math.ceil(ex + R)), y1 = Math.min(H, Math.ceil(ey + R));
      const w = x1 - x0, h = y1 - y0; if(w < 2 || h < 2) continue;
      // Rojez de cada píxel (sólo dentro del círculo del ojo)
      const red = new Uint8Array(w * h);
      for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
        if(Math.hypot(x0 + x - ex, y0 + y - ey) > R) continue;
        const i = ((y0 + y) * W + x0 + x) * 4, r = rgba[i], g = rgba[i + 1], bl = rgba[i + 2];
        if(r > 50 && r - Math.max(g, bl) > 35 && r / (r + g + bl + 1) > 0.45) red[y * w + x] = 1;
      }
      // Sólo lo conectado con la pupila (lo más cerca del centro del ojo)
      let seed = -1, best = Infinity;
      for(let p = 0; p < red.length; p++) if(red[p]){ const d = Math.hypot(x0 + p % w - ex, y0 + ((p / w) | 0) - ey); if(d < best){ best = d; seed = p; } }
      if(seed < 0 || best > R * 0.6) continue;
      const keep = new Uint8Array(w * h), st = [seed]; keep[seed] = 1;
      while(st.length){ const p = st.pop(), x = p % w, y = (p / w) | 0;
        for(const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1])
          if(q >= 0 && red[q] && !keep[q]){ keep[q] = 1; st.push(q); } }
      let n = 0; for(const v of keep) n += v;
      if(n < 3 || n > Math.PI * R * R * 0.7) continue;     // demasiado grande: no es una pupila
      // Borde suave (1-2 px)
      const soft = boxBlurFloat(Float32Array.from(keep), w, h, Math.max(1, Math.round(R / 12)));
      for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
        const p = y * w + x, al = Math.min(1, soft[p] * 1.6); if(al <= 0.02) continue;
        const i = ((y0 + y) * W + x0 + x) * 4;
        // Sin rojo en luz lineal: R pasa a la media de G y B (pupila oscura);
        // el reflejo blanco no es rojo y no se toca
        const g = DEC[rgba[i + 1]], bl = DEC[rgba[i + 2]], r2 = (g + bl) / 2;
        out[i] = Math.round(enc(r2)); out[i + 1] = rgba[i + 1]; out[i + 2] = rgba[i + 2];
        out[i + 3] = Math.max(out[i + 3], Math.round(al * 255));
      }
      fixed++;
    }
  }
  if(!fixed){ toast("No se han encontrado ojos rojos"); return; }
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  c.getContext("2d").putImageData(new ImageData(out, W, H), 0, 0);
  await toNewLayer(c, "Ojos rojos");
  toast(fixed === 1 ? "Corregido 1 ojo rojo" : `Corregidos ${fixed} ojos rojos`, "ok");
}

/* ── Recorte de retrato ──────────────────────────────────────── */
export async function faceCrop(){
  const src = await visibleImage(); if(!src) return;
  let faces;
  try{ faces = await findFaces(src); }
  catch(err){ if(!err.cancelled) toast("No se pudieron buscar caras: " + err.message, "err"); return; }
  if(!faces.length){ toast("No se han encontrado caras en esta foto"); return; }
  const { setTool, state, reflowCrop } = await import("../editor/tools.js");
  const { emit } = await import("../core/bus.js");
  setTool("crop");
  // Formato: el que ya tenga Recortar; si es libre, 4:5 (retrato)
  if(state.cropRatio === "free" || state.cropRatio === "orig"){ state.cropRatio = "custom"; state.cropW = 4; state.cropH = 5; }
  const ar = state.cropRatio === "custom" ? (+state.cropW / +state.cropH) : state.cropRatio.split(":").map(Number).reduce((a, b) => a / b);
  // Todas las caras que cuentan (≥ 35 % del tamaño de la mayor)
  const big = Math.max(...faces.map(f => f.w));
  const fs = faces.filter(f => f.w >= big * 0.35);
  const x0 = Math.min(...fs.map(f => f.x)), x1 = Math.max(...fs.map(f => f.x + f.w));
  const y0 = Math.min(...fs.map(f => f.y)), y1 = Math.max(...fs.map(f => f.y + f.h));
  const eyeY = fs.reduce((s, f) => s + (f.eyes[0][1] + f.eyes[1][1]) / 2, 0) / fs.length;
  // Cabeza y hombros: alto ≈ 3,2 veces la cara (o lo que ocupe el grupo)
  let h = Math.max((y1 - y0) * 3.2, (x1 - x0) * 1.6 / ar), w = h * ar;
  if(w > doc.w){ w = doc.w; h = w / ar; }
  if(h > doc.h){ h = doc.h; w = h * ar; }
  let x = (x0 + x1) / 2 - w / 2, y = eyeY - h * 0.36;      // ojos en el tercio superior
  x = Math.max(0, Math.min(doc.w - w, x)); y = Math.max(0, Math.min(doc.h - h, y));
  state.cropRect = { x, y, w, h };
  reflowCrop();
  emit("tool:options");
  toast("Encuadre centrado en la cara: ajústalo si quieres y pulsa Aplicar", "ok");
}
