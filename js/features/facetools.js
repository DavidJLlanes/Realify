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
  // Porcentaje de aplicación (mezcla con la capa de debajo)
  (await import("../editor/filterlayer.js")).markMixLayer(l, name);
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

/* ── Retoque por zonas de la cara ─────────────────────────────────
   BiSeNet (face parsing) separa en cada cara piel, ojos, boca y labios
   con probabilidades suaves (bordes finos, sin recortes duros). Premium:
     · Piel: suavizado que respeta los bordes (filtro guiado de la propia
       foto, en luz lineal) que conserva parte de la textura: se ve piel,
       no plástico.
     · Ojos: más luz y más claridad (detalle local) en el iris y el blanco.
     · Dientes: sin amarillo y algo más claros, en OKLab, sólo en lo
       claro de la boca (no en la lengua ni en la sombra).
     · Labios: más o menos color, en OKLab (tono intacto).
   El resultado va a una capa nueva. OJO: el modelo se entrenó con datos
   de uso no comercial (ver js/ai/models.js › faceparse). */
const ZONES = [["skin", "Piel", 0, 100, 35], ["eyes", "Ojos", 0, 100, 20], ["teeth", "Dientes", 0, 100, 0], ["lips", "Labios", -100, 100, 0]];

function toLabF(r, g, b, o){
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  o[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s; o[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s; o[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}
function fromLabF(L, a, b, o){
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s; o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s; o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}

/* Prepara una cara: recorte, zonas a su resolución y el «bajo» de la piel */
async function prepareFace(src, rgba, W, H, f){
  const side = Math.max(f.w, f.h) * 2, cx = f.x + f.w / 2, cy = f.y + f.h * 0.45;
  const sx = cx - side / 2, sy = cy - side / 2;
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "#808080"; x.fillRect(0, 0, 512, 512);
  x.imageSmoothingQuality = "high";
  x.drawImage(src, sx, sy, side, side, 0, 0, 512, 512);
  const { runModel } = await import("../ai/runtime.js");
  const r = await runModel("parse", "faceparse", { rgba: x.getImageData(0, 0, 512, 512).data }, [], { title: "Analizando la cara con IA" });
  // Región de la foto (recortada a sus bordes)
  const x0 = Math.max(0, Math.floor(sx)), y0 = Math.max(0, Math.floor(sy));
  const x1 = Math.min(W, Math.ceil(sx + side)), y1 = Math.min(H, Math.ceil(sy + side));
  const w = x1 - x0, h = y1 - y0, n = w * h, k = 512 / side;
  // Zonas ampliadas con interpolación bilineal (bordes suaves)
  const up = g => {
    const o = new Float32Array(n);
    for(let y = 0; y < h; y++){
      const fy = Math.min(511, Math.max(0, (y0 + y + 0.5 - sy) * k - 0.5)), a0 = fy | 0, a1 = Math.min(511, a0 + 1), ty = fy - a0;
      for(let xx = 0; xx < w; xx++){
        const fx = Math.min(511, Math.max(0, (x0 + xx + 0.5 - sx) * k - 0.5)), b0 = fx | 0, b1 = Math.min(511, b0 + 1), tx = fx - b0;
        const t = g[a0 * 512 + b0] + (g[a0 * 512 + b1] - g[a0 * 512 + b0]) * tx, u = g[a1 * 512 + b0] + (g[a1 * 512 + b1] - g[a1 * 512 + b0]) * tx;
        o[y * w + xx] = (t + (u - t) * ty) / 255;
      }
    }
    return o;
  };
  const m = { skin: up(r.groups.skin), eyes: up(r.groups.eyes), mouth: up(r.groups.mouth), lips: up(r.groups.lips) };
  // Luz lineal de la región y su «bajo» (suavizado que respeta bordes)
  const lin = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for(let y = 0; y < h; y++) for(let xx = 0; xx < w; xx++){ const i = ((y0 + y) * W + x0 + xx) * 4, p = y * w + xx; lin[0][p] = DEC[rgba[i]]; lin[1][p] = DEC[rgba[i + 1]]; lin[2][p] = DEC[rgba[i + 2]]; }
  const { guidedFilterAlpha } = await import("../editor/refineedge-math.js");
  /* Resolución real del rostro (fase 3): si la cara es mayor que los 512
     px del modelo, las zonas llegan ampliadas y con el borde borroso; un
     filtro guiado por la propia foto las ajusta a los bordes reales de
     labios, ojos y piel a la resolución de la foto. */
  if(k < 0.9){
    const I = new Float32Array(n);
    for(let p = 0; p < n; p++) I[p] = Math.sqrt(0.2126 * lin[0][p] + 0.7152 * lin[1][p] + 0.0722 * lin[2][p]);
    const gr = Math.max(2, Math.round(1.5 / k));
    for(const key of ["skin", "eyes", "mouth", "lips"]){
      const g = guidedFilterAlpha(I, m[key], w, h, gr, 0.0006);
      for(let p = 0; p < n; p++) g[p] = g[p] < 0 ? 0 : g[p] > 1 ? 1 : g[p];
      m[key] = g;
    }
  }
  // Ojos: un poco agrandados (el borde del iris cuenta)
  m.eyes = boxBlurFloat(m.eyes, w, h, Math.max(1, Math.round(f.w * 0.01))).map(v => Math.min(1, v * 1.6));
  const rad = Math.max(2, Math.round(f.w * 0.03));
  const low = lin.map(ch => guidedFilterAlpha(ch, ch, w, h, rad, 0.0012));
  // Luminancia de la boca para separar los dientes (lo claro)
  let ms = 0, mn = 0;
  for(let p = 0; p < n; p++) if(m.mouth[p] > 0.5){ ms += 0.2126 * lin[0][p] + 0.7152 * lin[1][p] + 0.0722 * lin[2][p]; mn++; }
  return { x0, y0, w, h, m, lin, low, mouthY: mn ? ms / mn : 0.1 };
}

function retouchFace(F, V, out, W){
  const { x0, y0, w, h, m, lin, low } = F, ks = V.skin / 100, ke = V.eyes / 100, kt = V.teeth / 100, kl = V.lips / 100;
  const lab = [0, 0, 0], rgb = [0, 0, 0];
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const p = y * w + x;
    let r = lin[0][p], g = lin[1][p], b = lin[2][p], wgt = 0;
    // Piel: quita el 80 % del detalle fino como máximo (queda textura)
    const s = m.skin[p] * ks;
    if(s > 0.002){ const q = 0.8 * s; r -= (r - low[0][p]) * q; g -= (g - low[1][p]) * q; b -= (b - low[2][p]) * q; wgt = Math.max(wgt, m.skin[p]); }
    // Ojos: más luz y más detalle local
    const e = m.eyes[p] * ke;
    if(e > 0.002){ const gain = 1 + 0.35 * e; r = (r + (lin[0][p] - low[0][p]) * 0.8 * e) * gain; g = (g + (lin[1][p] - low[1][p]) * 0.8 * e) * gain; b = (b + (lin[2][p] - low[2][p]) * 0.8 * e) * gain; wgt = Math.max(wgt, m.eyes[p]); }
    // Dientes: en lo claro de la boca, sin amarillo y algo más claros
    if(kt > 0 && m.mouth[p] > 0.02){
      const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, gate = Math.min(1, Math.max(0, (Y / Math.max(1e-4, F.mouthY) - 0.9) / 0.6));
      const t = m.mouth[p] * gate * kt;
      if(t > 0.002){ toLabF(Math.max(0, r), Math.max(0, g), Math.max(0, b), lab); lab[0] = Math.min(0.99, lab[0] * (1 + 0.08 * t)); if(lab[2] > 0) lab[2] *= 1 - 0.85 * t; lab[1] *= 1 - 0.4 * t; fromLabF(lab[0], lab[1], lab[2], rgb); [r, g, b] = rgb; wgt = Math.max(wgt, m.mouth[p]); }
    }
    // Labios: croma en OKLab (el tono no cambia)
    const l = m.lips[p] * kl;
    if(Math.abs(l) > 0.002){ toLabF(Math.max(0, r), Math.max(0, g), Math.max(0, b), lab); const c = 1 + 0.6 * l; lab[1] *= c; lab[2] *= c; fromLabF(lab[0], lab[1], lab[2], rgb); [r, g, b] = rgb; wgt = Math.max(wgt, m.lips[p]); }
    if(wgt <= 0.002) continue;
    const i = ((y0 + y) * W + x0 + x) * 4;
    out[i] = Math.round(enc(r)); out[i + 1] = Math.round(enc(g)); out[i + 2] = Math.round(enc(b));
    out[i + 3] = Math.max(out[i + 3], Math.round(Math.min(1, wgt * 1.2) * 255));
  }
}

let retouchOpen = false;
export async function openFaceRetouch(){
  if(retouchOpen) return;
  const src = await visibleImage(); if(!src) return;
  const W = src.width, H = src.height;
  let faces;
  try{ faces = await findFaces(src); }
  catch(err){ if(!err.cancelled) toast("No se pudieron buscar caras: " + err.message, "err"); return; }
  if(!faces.length){ toast("No se han encontrado caras en esta foto"); return; }
  faces = faces.sort((a, b) => b.w - a.w).slice(0, 8);
  retouchOpen = true;
  const rgba = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  let prepared = [];
  try{
    // Varias caras: un solo aviso con su progreso y un Cancelar para todas
    const { aiSession } = await import("../ai/runtime.js");
    await aiSession(faces.length === 1 ? "Analizando la cara con IA" : `Analizando ${faces.length} caras con IA`, async step => {
      for(let i = 0; i < faces.length; i++){ step(i, faces.length); prepared.push(await prepareFace(src, rgba, W, H, faces[i])); }
    }, { unit: "cara" });
  }
  catch(err){ retouchOpen = false; if(!err.cancelled && !/cancelad/.test(err.message)) toast("No se pudo analizar la cara: " + err.message, "err"); return; }
  const { createShell, ensureShellStyles } = await import("../ui/fsshell.js");
  await ensureShellStyles();
  const V = Object.fromEntries(ZONES.map(z => [z[0], z[4]]));
  let zone = "skin", out = null, frame = 0;
  const view = document.createElement("canvas"); view.width = W; view.height = H;
  const vx = view.getContext("2d");
  const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H;
  const render = () => {
    frame = 0;
    out = new Uint8ClampedArray(W * H * 4);
    for(const F of prepared) retouchFace(F, V, out, W);
    tmp.getContext("2d").putImageData(new ImageData(out, W, H), 0, 0);
    vx.clearRect(0, 0, W, H); vx.drawImage(src, 0, 0); vx.drawImage(tmp, 0, 0);
    sh.setView(view);
  };
  const schedule = () => { if(!frame) frame = requestAnimationFrame(render); };
  const close = () => { retouchOpen = false; sh.close(); };
  const sh = createShell({
    title: "Retoque de cara", subtitle: `Premium 👑 · ${faces.length === 1 ? "1 cara" : faces.length + " caras"}`, applyLabel: "Aplicar", cls: "face-tool",
    onCancel: close,
    onApply: async () => { const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").putImageData(new ImageData(out, W, H), 0, 0); close(); await toNewLayer(c, "Retoque de cara"); toast("Retoque de cara en una capa nueva", "ok"); }
  });
  sh.setOriginal(src);
  // Mandos mínimos: zona e intensidad (desplegable cerrado)
  const controls = () => {
    const el = document.createElement("div");
    el.className = "face-ctl";
    el.innerHTML = `<select aria-label="Zona">${ZONES.map(z => `<option value="${z[0]}">${z[1]}</option>`).join("")}</select><input type="range" aria-label="Intensidad">`;
    const sel = el.querySelector("select"), rng = el.querySelector("input");
    sel.addEventListener("change", () => { zone = sel.value; sync(); });
    rng.addEventListener("input", () => { V[zone] = +rng.value; sync(); schedule(); });
    return el;
  };
  const sync = () => sh.root.querySelectorAll(".face-ctl").forEach(el => {
    const z = ZONES.find(q => q[0] === zone), rng = el.querySelector("input");
    el.querySelector("select").value = zone; rng.min = z[2]; rng.max = z[3]; rng.value = V[zone];
  });
  sh.mobile.appendChild(controls());
  sh.right.appendChild(controls());
  sync();
  render();
}

/* ── Restaurar caras (GFPGAN) ─────────────────────────────────────
   Para caras borrosas, pequeñas, de fotos antiguas o muy comprimidas.
   Cada cara se alinea a la plantilla FFHQ (ojos, nariz y comisuras en
   su sitio) con una semejanza (giro, escala y desplazamiento), GFPGAN la
   reconstruye a 512×512 y se devuelve a la foto. Premium:
     · Bueno: la cara se recorta de la foto a resolución completa y se
       pega en luz lineal con un borde amplio y suave.
     · Mejor: si la cara es pequeña, la restauración se filtra antes de
       reducirla (sin dientes de sierra); si es mayor que los 512 px del
       modelo, se le suma el detalle de la foto por encima de esa
       resolución (no queda más blanda que el original); se le devuelve
       el color de piel de la foto (GFPGAN tiende a cambiarlo) y el grano
       original, para que no parezca una pegatina.
   Toca una cara para excluirla. El resultado va a una capa nueva. */
const FFHQ = [[192.98138, 239.94708], [318.90277, 240.1936], [256.63416, 314.01935], [201.26117, 371.41043], [313.08905, 371.15118]];

/* Semejanza que lleva los 5 puntos de la cara a la plantilla:
   u = a·x − b·y + tx, v = b·x + a·y + ty */
function alignTo(f){
  const eyes = [...f.eyes].sort((p, q) => p[0] - q[0]), mouth = [...f.mouth].sort((p, q) => p[0] - q[0]);
  const P = [eyes[0], eyes[1], f.nose, mouth[0], mouth[1]];
  let sx = 0, sy = 0, dx = 0, dy = 0;
  for(let k = 0; k < 5; k++){ sx += P[k][0]; sy += P[k][1]; dx += FFHQ[k][0]; dy += FFHQ[k][1]; }
  sx /= 5; sy /= 5; dx /= 5; dy /= 5;
  let num1 = 0, num2 = 0, den = 0;
  for(let k = 0; k < 5; k++){
    const xs = P[k][0] - sx, ys = P[k][1] - sy, xd = FFHQ[k][0] - dx, yd = FFHQ[k][1] - dy;
    num1 += xs * xd + ys * yd; num2 += xs * yd - ys * xd; den += xs * xs + ys * ys;
  }
  const a = num1 / den, b = num2 / den;
  return { a, b, tx: dx - (a * sx - b * sy), ty: dy - (b * sx + a * sy), s: Math.hypot(a, b) };
}

/* Ruido de la foto en una zona (valores codificados 0-1) */
function grainAt(rgba, W, x0, y0, w, h){
  const d = [];
  for(let y = y0 + 1; y < y0 + h - 1; y += 2) for(let x = x0 + 1; x < x0 + w - 1; x += 2){
    const i = (y * W + x) * 4, l = v => 0.299 * rgba[v] + 0.587 * rgba[v + 1] + 0.114 * rgba[v + 2];
    d.push(Math.abs(l(i) - (l(i - 4) + l(i + 4) + l(i - W * 4) + l(i + W * 4)) / 4));
  }
  d.sort((p, q) => p - q);
  return d.length ? Math.min(0.03, 1.4826 * d[d.length >> 1] / 255 * 0.9) : 0;
}

/* Prepara el pegado de una cara ya restaurada */
function prepareRestored(M, out512, rgba, W, H){
  const { a, b, tx, ty, s } = M, n = 512 * 512;
  // Restauración en luz lineal; filtrada si se va a reducir mucho
  let ch = [0, 1, 2].map(c => { const o = new Float32Array(n); for(let p = 0; p < n; p++) o[p] = DEC[out512[p * 4 + c]]; return o; });
  const r = Math.floor(s / 2);
  if(r >= 1) ch = ch.map(o => boxBlurFloat(boxBlurFloat(o, 512, 512, r), 512, 512, Math.max(1, r >> 1)));
  // Región de la foto que cubre la plantilla
  const det = a * a + b * b, inv = (u, v) => [(a * (u - tx) + b * (v - ty)) / det, (-b * (u - tx) + a * (v - ty)) / det];
  const cs = [inv(0, 0), inv(512, 0), inv(0, 512), inv(512, 512)];
  const x0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[0])))), x1 = Math.min(W, Math.ceil(Math.max(...cs.map(c => c[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[1])))), y1 = Math.min(H, Math.ceil(Math.max(...cs.map(c => c[1]))));
  const w = x1 - x0, h = y1 - y0, m = new Float32Array(w * h), col = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
  const sum = [0, 0, 0, 0, 0, 0]; let cnt = 0;
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const X = x0 + x + 0.5, Y = y0 + y + 0.5, u = a * X - b * Y + tx - 0.5, v = b * X + a * Y + ty - 0.5;
    if(u < 0 || v < 0 || u > 511 || v > 511) continue;
    // Borde suave: 24 px de margen y 64 de fundido (en la plantilla)
    const e = Math.min(u, v, 511 - u, 511 - v), mk = Math.min(1, Math.max(0, (e - 24) / 64));
    if(mk <= 0) continue;
    const u0 = u | 0, v0 = v | 0, u1 = Math.min(511, u0 + 1), v1 = Math.min(511, v0 + 1), fu = u - u0, fv = v - v0, p = y * w + x;
    for(let c = 0; c < 3; c++){
      const o = ch[c], t = o[v0 * 512 + u0] + (o[v0 * 512 + u1] - o[v0 * 512 + u0]) * fu, q = o[v1 * 512 + u0] + (o[v1 * 512 + u1] - o[v1 * 512 + u0]) * fu;
      col[c][p] = t + (q - t) * fv;
    }
    m[p] = mk;
    // Color medio del centro de la cara (restaurado y original)
    if(mk >= 1 && Math.abs(u - 256) < 110 && Math.abs(v - 300) < 110){
      const i = ((y0 + y) * W + x0 + x) * 4;
      for(let c = 0; c < 3; c++){ sum[c] += col[c][p]; sum[3 + c] += DEC[rgba[i + c]]; } cnt++;
    }
  }
  // Mismo color de piel que la foto (ganancia por canal, limitada)
  const gain = [0, 1, 2].map(c => cnt ? Math.min(1.25, Math.max(0.8, sum[3 + c] / Math.max(1e-5, sum[c]))) : 1);
  for(let c = 0; c < 3; c++) for(let p = 0; p < w * h; p++) col[c][p] *= gain[c];
  /* Resolución real del rostro (fase 3): GFPGAN pinta la cara a 512 px.
     Si en la foto es mayor, la restauración llega ampliada y más blanda
     que el original; se le suma el detalle de la propia foto que queda
     por encima de esa resolución (lo que el modelo no puede ver), así la
     cara conserva la nitidez real de la foto. */
  if(s < 0.9){
    const rr = Math.max(1, Math.round(0.6 / s)), n2 = w * h;
    for(let c = 0; c < 3; c++){
      const o = new Float32Array(n2);
      for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) o[y * w + x] = DEC[rgba[((y0 + y) * W + x0 + x) * 4 + c]];
      const low = boxBlurFloat(boxBlurFloat(o, w, h, rr), w, h, Math.max(1, rr >> 1));
      for(let p = 0; p < n2; p++) if(m[p] > 0) col[c][p] = Math.max(0, col[c][p] + (o[p] - low[p]));
    }
  }
  return { x0, y0, w, h, m, col, grain: grainAt(rgba, W, x0, y0, w, h) };
}

function composeRestored(R, rgba, W, k, out){
  const { x0, y0, w, h, m, col, grain } = R;
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const p = y * w + x, a = m[p] * k; if(a <= 0.002) continue;
    const i = ((y0 + y) * W + x0 + x) * 4, nz = (hash(i) + hash(i + 7919) - 1) * grain * 1.7 * a * 255;
    for(let c = 0; c < 3; c++){ const o = DEC[rgba[i + c]]; out[i + c] = Math.round(enc(o + (col[c][p] - o) * a) + nz); }
    out[i + 3] = 255;
  }
}

let restoreOpen = false;
export async function openFaceRestore(){
  if(restoreOpen) return;
  const src = await visibleImage(); if(!src) return;
  const W = src.width, H = src.height;
  let faces;
  try{ faces = await findFaces(src); }
  catch(err){ if(!err.cancelled) toast("No se pudieron buscar caras: " + err.message, "err"); return; }
  if(!faces.length){ toast("No se han encontrado caras en esta foto"); return; }
  faces = faces.sort((a, b) => b.w - a.w).slice(0, 10);
  restoreOpen = true;
  const rgba = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  // Caras alineadas a 512×512 y restauradas todas en una llamada
  const Ms = faces.map(alignTo), crops = Ms.map(M => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.fillStyle = "rgb(135,133,132)"; x.fillRect(0, 0, 512, 512);
    x.imageSmoothingQuality = "high";
    x.setTransform(M.a, M.b, -M.b, M.a, M.tx, M.ty); x.drawImage(src, 0, 0);
    return x.getImageData(0, 0, 512, 512).data;
  });
  let prepared;
  try{
    const { runModel } = await import("../ai/runtime.js");
    const { MODELS } = await import("../ai/models.js");
    const { isMobile } = await import("../core/device.js");
    // Móviles o poca memoria: cada mitad del modelo se suelta antes de cargar la otra
    const lowMem = isMobile() || /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.deviceMemory || 8) <= 4;
    const r = await runModel("faceRestore", "gfpgan_enc", { crops, dec: MODELS.gfpgan_dec, decId: "gfpgan_dec", lowMem }, crops.map(c => c.buffer),
      { title: faces.length === 1 ? "Restaurando la cara con IA" : `Restaurando ${faces.length} caras con IA` });
    prepared = r.outs.map((o, i) => prepareRestored(Ms[i], o, rgba, W, H));
  }catch(err){ restoreOpen = false; if(!err.cancelled && !/cancelad/.test(err.message)) toast("No se pudieron restaurar las caras: " + err.message, "err"); return; }
  const { createShell, ensureShellStyles } = await import("../ui/fsshell.js");
  await ensureShellStyles();
  const S = { amount: 80, on: faces.map(() => true) };
  const view = document.createElement("canvas"); view.width = W; view.height = H;
  const vx = view.getContext("2d"), tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H;
  let out = null, frame = 0;
  const render = () => {
    frame = 0;
    out = new Uint8ClampedArray(W * H * 4);
    prepared.forEach((R, i) => { if(S.on[i]) composeRestored(R, rgba, W, S.amount / 100, out); });
    tmp.getContext("2d").putImageData(new ImageData(out, W, H), 0, 0);
    vx.clearRect(0, 0, W, H); vx.drawImage(src, 0, 0); vx.drawImage(tmp, 0, 0);
    sh.setView(view); sh.setApplyEnabled(S.on.some(Boolean) && S.amount > 0);
    sh.setSubtitle(faces.length === 1 ? "Premium 👑 · 1 cara" : `Premium 👑 · ${S.on.filter(Boolean).length} de ${faces.length} caras · toca una para quitarla o ponerla`);
  };
  const schedule = () => { if(!frame) frame = requestAnimationFrame(render); };
  const close = () => { restoreOpen = false; sh.close(); };
  const sh = createShell({
    title: "Restaurar caras", applyLabel: "Aplicar", cls: "face-tool",
    onCancel: close,
    onApply: async () => { const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").putImageData(new ImageData(out, W, H), 0, 0); close(); await toNewLayer(c, "Caras restauradas"); toast("Caras restauradas en una capa nueva", "ok"); }
  });
  sh.setOriginal(src);
  const box = f => ({ cx: f.x + f.w / 2, cy: f.y + f.h / 2, rx: f.w * 0.6, ry: f.h * 0.65 });
  sh.setOverlay((cx, t) => {
    if(faces.length < 2) return;
    faces.forEach((f, i) => {
      const o = box(f);
      cx.setLineDash(S.on[i] ? [] : [6 * t.dpr, 5 * t.dpr]);
      cx.lineWidth = 2 * t.dpr; cx.strokeStyle = S.on[i] ? "#e8a33d" : "#ffffffaa";
      cx.beginPath(); cx.ellipse(t.ox + o.cx * t.k, t.oy + o.cy * t.k, o.rx * t.k, o.ry * t.k, 0, 0, Math.PI * 2); cx.stroke();
    });
  });
  let down = null;
  sh.setInteract((type, p, e) => {
    if(type === "down"){
      const i = faces.findIndex(f => { const o = box(f); return Math.hypot((p.x - o.cx) / o.rx, (p.y - o.cy) / o.ry) <= 1; });
      if(i < 0 || faces.length < 2) return false;
      down = { i, x: e.clientX, y: e.clientY }; return true;
    }
    if(type === "up" && down){
      if(Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10){ S.on[down.i] = !S.on[down.i]; schedule(); }
      down = null;
    }
    return false;
  });
  // Un solo mando: intensidad
  const controls = () => {
    const el = document.createElement("div");
    el.className = "face-ctl";
    el.innerHTML = `<span>Intensidad</span><input type="range" min="0" max="100" aria-label="Intensidad">`;
    const rng = el.querySelector("input"); rng.value = S.amount;
    rng.addEventListener("input", () => { S.amount = +rng.value; sh.root.querySelectorAll(".face-ctl input").forEach(x => { if(x !== rng) x.value = S.amount; }); schedule(); });
    return el;
  };
  sh.mobile.appendChild(controls());
  sh.right.appendChild(controls());
  render();
}
