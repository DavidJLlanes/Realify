/* ═══════════════════════════════════════════════════════════════
   CUADRÍCULA INTELIGENTE
   Guías de composición que se calculan a partir del CONTENIDO de la
   foto, no sólo de sus medidas:

     · Sujeto principal: mapa de relevancia visual (lo que más se
       diferencia del color medio de la imagen, con un ligero sesgo al
       centro, como en Achanta et al. 2009). Se marca su caja y el
       punto fuerte de los tercios más cercano, con una flecha.
     · Horizonte: transformada de Hough sobre los bordes casi
       horizontales. Se dibuja la línea detectada, se dice cuánto está
       inclinada y se propone enderezarla.
     · Rostros: con la API de detección de formas del navegador si
       existe; si no, una estimación por tono de piel. Se marca la
       línea de los ojos, que conviene en el tercio superior.
     · Guías clásicas adaptadas: tercios, proporción áurea, espiral
       áurea orientada HACIA el sujeto (de sus cuatro orientaciones, la
       que tiene el ojo más cerca de él), diagonales y triángulos
       áureos, cruz central y simetría.

   Todo se analiza en una copia reducida (≤ 320 px) de la
   composición, y las guías se dibujan en el hueco de superposición
   de reglas y guías (ver rulers.js), por encima de la imagen.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { on, emit } from "../core/bus.js";
import { flatten } from "./layertree.js";
import { view } from "./view.js";
import { scheduleOverlay } from "./compositor.js";
import { setCompositionOverlay } from "./rulers.js";
import { record } from "../core/history.js";
import { dialog } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";

const KEY = "realify.smartGrid";
const GUIDES = [
  ["subject", "Sujeto principal y punto fuerte"],
  ["horizon", "Horizonte detectado"],
  ["faces", "Rostros y línea de los ojos"],
  ["thirds", "Regla de los tercios"],
  ["phi", "Proporción áurea (cuadrícula φ)"],
  ["spiral", "Espiral áurea (hacia el sujeto)"],
  ["diagonals", "Diagonales y triángulos áureos"],
  ["center", "Centro y simetría"]
];
const cfg = { on: false, subject: true, horizon: true, faces: true, thirds: true, phi: false, spiral: false, diagonals: false, center: false };
/* Se recuerdan qué guías se prefieren, pero NO si está encendida: antes
   se guardaba también `on`, y tras abrirla una vez aparecía sola en
   cada imagen que se abriera, incluso días después. Ahora se enciende
   al usarla y se apaga al abrir otra imagen. */
try{ Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || "{}")); }catch{}
cfg.on = false;
const save = () => { try{ const { on: _, ...prefs } = cfg; localStorage.setItem(KEY, JSON.stringify(prefs)); }catch{} };
save();

let result = null, analyzing = null, dirty = true;
export const smartGridOn = () => cfg.on;

/* ── Análisis ─────────────────────────────────────────────────── */
function sample(maxSide = 320){
  const full = flatten();
  const k = Math.min(1, maxSide / Math.max(full.width, full.height));
  const w = Math.max(8, Math.round(full.width * k)), h = Math.max(8, Math.round(full.height * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high"; x.drawImage(full, 0, 0, w, h);
  return { c, w, h, d: x.getImageData(0, 0, w, h).data, sx: full.width / w, sy: full.height / h };
}
const srgb = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
const LIN = new Float32Array(256).map((_, i) => srgb(i));
function lab(r, g, b){
  r = LIN[r]; g = LIN[g]; b = LIN[b];
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const X = f((r * .4124 + g * .3576 + b * .1805) / .95047), Y = f(r * .2126 + g * .7152 + b * .0722), Z = f((r * .0193 + g * .1192 + b * .9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
function boxBlur(src, w, h, r){
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ let s = 0, n = 0; for(let k = -r; k <= r; k++){ const xx = x + k; if(xx >= 0 && xx < w){ s += src[y * w + xx]; n++; } } tmp[y * w + x] = s / n; }
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ let s = 0, n = 0; for(let k = -r; k <= r; k++){ const yy = y + k; if(yy >= 0 && yy < h){ s += tmp[yy * w + x]; n++; } } out[y * w + x] = s / n; }
  return out;
}

function findSubject({ w, h, d }){
  const n = w * h, L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
  let mL = 0, mA = 0, mB = 0;
  for(let i = 0; i < n; i++){ const [l, a, b] = lab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); L[i] = l; A[i] = a; B[i] = b; mL += l; mA += a; mB += b; }
  mL /= n; mA /= n; mB /= n;
  const r = Math.max(1, Math.round(Math.min(w, h) / 90));
  const bl = boxBlur(L, w, h, r), ba = boxBlur(A, w, h, r), bb = boxBlur(B, w, h, r);
  const S = new Float32Array(n);
  let mean = 0;
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const i = y * w + x, dx = x / w - .5, dy = y / h - .5;
    const bias = 1 - Math.min(1, (dx * dx + dy * dy) * 1.6) * .55;
    S[i] = Math.hypot(bl[i] - mL, (ba[i] - mA) * 1.2, (bb[i] - mB) * 1.2) * bias; mean += S[i];
  }
  mean /= n;
  let sd = 0; for(let i = 0; i < n; i++) sd += (S[i] - mean) ** 2; sd = Math.sqrt(sd / n);
  const thr = mean + sd * 1.1;
  // Componente conexa más relevante (suma de relevancia) sobre el umbral
  const lbl = new Int32Array(n).fill(-1); let best = null;
  const stack = [];
  for(let i = 0; i < n; i++){
    if(S[i] < thr || lbl[i] >= 0) continue;
    let sum = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, count = 0;
    stack.push(i); lbl[i] = i;
    while(stack.length){
      const j = stack.pop(), x = j % w, y = (j / w) | 0, s = S[j];
      sum += s; sx += x * s; sy += y * s; count++;
      if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
      for(const k of [j - 1, j + 1, j - w, j + w]){
        if(k < 0 || k >= n || lbl[k] >= 0 || S[k] < thr) continue;
        if((k === j - 1 && x === 0) || (k === j + 1 && x === w - 1)) continue;
        lbl[k] = i; stack.push(k);
      }
    }
    if(count > n * .002 && (!best || sum > best.sum)) best = { sum, cx: sx / sum, cy: sy / sum, x0, y0, x1, y1, count };
  }
  if(!best) return null;
  return { x: best.cx / w, y: best.cy / h, box: { x: best.x0 / w, y: best.y0 / h, w: (best.x1 - best.x0 + 1) / w, h: (best.y1 - best.y0 + 1) / h },
           strength: Math.min(1, (best.sum / best.count) / (mean + sd * 3)) };
}

function findHorizon({ w, h, d }){
  const n = w * h, Y = new Float32Array(n);
  for(let i = 0; i < n; i++) Y[i] = d[i * 4] * .2126 + d[i * 4 + 1] * .7152 + d[i * 4 + 2] * .0722;
  const G = boxBlur(Y, w, h, 1);
  const ANG = [], A0 = -15, A1 = 15, STEP = .25;
  for(let a = A0; a <= A1 + 1e-9; a += STEP) ANG.push(a * Math.PI / 180);
  const R = Math.ceil(Math.hypot(w, h)) + 2, acc = new Float32Array(ANG.length * R * 2);
  const cs = ANG.map(Math.cos), sn = ANG.map(Math.sin), cx = w / 2;
  let magSum = 0, cnt = 0;
  const pts = [];
  for(let y = 1; y < h - 1; y++) for(let x = 1; x < w - 1; x++){
    const i = y * w + x;
    const gx = G[i - w + 1] + 2 * G[i + 1] + G[i + w + 1] - G[i - w - 1] - 2 * G[i - 1] - G[i + w - 1];
    const gy = G[i + w - 1] + 2 * G[i + w] + G[i + w + 1] - G[i - w - 1] - 2 * G[i - w] - G[i - w + 1];
    const m = Math.hypot(gx, gy);
    magSum += m; cnt++;
    if(Math.abs(gy) > Math.abs(gx) * 2) pts.push([x, y, m]);
  }
  const mMean = magSum / Math.max(1, cnt);
  for(const [x, y, m] of pts){
    if(m < mMean * 1.6) continue;
    for(let k = 0; k < ANG.length; k++){
      const rho = Math.round(y * cs[k] - (x - cx) * sn[k]) + R;
      acc[k * R * 2 + rho] += 1;
    }
  }
  let bi = 0, bv = 0;
  for(let i = 0; i < acc.length; i++) if(acc[i] > bv){ bv = acc[i]; bi = i; }
  const coverage = bv / w;
  if(coverage < .35) return null;
  const k = Math.floor(bi / (R * 2)), rho = bi % (R * 2) - R, a = ANG[k];
  // y en el centro: rho = y·cos a → y = rho / cos a
  const yc = rho / Math.cos(a);
  return { y: yc / h, angle: a * 180 / Math.PI, coverage };
}

async function findFaces(s){
  if("FaceDetector" in window){
    try{
      const det = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
      const faces = await det.detect(s.c);
      if(faces.length) return faces.map(f => ({ x: f.boundingBox.x / s.w, y: f.boundingBox.y / s.h, w: f.boundingBox.width / s.w, h: f.boundingBox.height / s.h, sure: true }));
      return [];
    }catch{}
  }
  // Estimación por tono de piel (YCbCr), en una copia más pequeña
  const { w, h, d } = s, n = w * h, skin = new Uint8Array(n);
  for(let i = 0; i < n; i++){
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], y = .299 * r + .587 * g + .114 * b;
    const cb = 128 - .168736 * r - .331264 * g + .5 * b, cr = 128 + .5 * r - .418688 * g - .081312 * b;
    skin[i] = y > 45 && cb > 77 && cb < 127 && cr > 136 && cr < 173 && r > g && r > b ? 1 : 0;
  }
  const lbl = new Int32Array(n).fill(-1), out = [], stack = [];
  for(let i = 0; i < n; i++){
    if(!skin[i] || lbl[i] >= 0) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, c = 0; stack.push(i); lbl[i] = i;
    while(stack.length){ const j = stack.pop(), x = j % w, y = (j / w) | 0; c++; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
      for(const k of [j - 1, j + 1, j - w, j + w]){ if(k < 0 || k >= n || lbl[k] >= 0 || !skin[k]) continue; if((k === j - 1 && x === 0) || (k === j + 1 && x === w - 1)) continue; lbl[k] = i; stack.push(k); } }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, fill = c / (bw * bh), ar = bh / bw;
    if(c > n * .006 && fill > .42 && ar > .8 && ar < 1.9 && y0 < h * .7) out.push({ x: x0 / w, y: y0 / h, w: bw / w, h: bh / h, c, sure: false });
  }
  out.sort((a, b) => b.c - a.c);
  return out.slice(0, 3);
}

export async function analyze(){
  if(!doc.open) return null;
  if(analyzing) return analyzing;
  analyzing = (async () => {
    const s = sample();
    const horizon = findHorizon(s), faces = await findFaces(s);
    /* En un retrato el sujeto es la cara, aunque otra cosa llame más la
       atención por color (un traje naranja, un cartel). */
    const f = faces[0];
    const subject = f ? { x: f.x + f.w / 2, y: f.y + f.h * .45, box: { x: f.x, y: f.y, w: f.w, h: f.h }, strength: 1, face: true } : findSubject(s);
    result = { subject, horizon, faces, w: doc.w, h: doc.h };
    dirty = false;
    return result;
  })();
  try{ return await analyzing; } finally{ analyzing = null; scheduleOverlay(); }
}
let timer = 0;
on("doc:change", () => { dirty = true; if(cfg.on){ clearTimeout(timer); timer = setTimeout(analyze, 900); } });
on("doc:new", () => { result = null; dirty = true; if(cfg.on){ cfg.on = false; scheduleOverlay(); } });

/* ── Geometría de las guías ───────────────────────────────────── */
const POWER = [[1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]];
function nearestPower(p){ return POWER.reduce((b, q) => Math.hypot(q[0] - p.x, q[1] - p.y) < Math.hypot(b[0] - p.x, b[1] - p.y) ? q : b, POWER[0]); }
/* Espiral áurea en un rectángulo cualquiera (subdivisión 0,618) */
function spiralArcs(W, H){
  let r = { x: 0, y: 0, w: W, h: H }; const arcs = []; const f = .618;
  for(let i = 0; i < 12; i++){
    const dir = i % 4;
    if(dir === 0){ const pw = r.w * f; arcs.push([r.x + pw, r.y + r.h, pw, r.h, Math.PI, Math.PI * 1.5]); r = { x: r.x + pw, y: r.y, w: r.w - pw, h: r.h }; }
    else if(dir === 1){ const ph = r.h * f; arcs.push([r.x, r.y + ph, r.w, ph, Math.PI * 1.5, Math.PI * 2]); r = { x: r.x, y: r.y + ph, w: r.w, h: r.h - ph }; }
    else if(dir === 2){ const pw = r.w * f; arcs.push([r.x + r.w - pw, r.y, pw, r.h, 0, Math.PI * .5]); r = { x: r.x, y: r.y, w: r.w - pw, h: r.h }; }
    else { const ph = r.h * f; arcs.push([r.x + r.w, r.y + r.h - ph, r.w, ph, Math.PI * .5, Math.PI]); r = { x: r.x, y: r.y, w: r.w, h: r.h - ph }; }
  }
  return { arcs, eye: { x: (r.x + r.w / 2) / W, y: (r.y + r.h / 2) / H } };
}
/* De las cuatro orientaciones de la espiral, la que tiene el ojo más
   cerca del sujeto (o la de siempre si no hay sujeto). */
function spiralOrientation(){
  const base = spiralArcs(1, 1).eye, target = result?.subject || null;
  let best = [false, false], bd = Infinity;
  for(const fx of [false, true]) for(const fy of [false, true]){
    const e = { x: fx ? 1 - base.x : base.x, y: fy ? 1 - base.y : base.y };
    const dd = target ? Math.hypot(e.x - target.x, e.y - target.y) : (fx || fy ? 1 : 0);
    if(dd < bd){ bd = dd; best = [fx, fy]; }
  }
  return best;
}

/* ── Dibujo ───────────────────────────────────────────────────── */
function drawComposition(ctx){
  if(!cfg.on || !doc.open) return;
  const W = doc.w, H = doc.h, px = 1 / Math.max(view.zoom, 1e-6);
  const line = (x0, y0, x1, y1, color, width = 1, dash = null) => {
    ctx.save(); ctx.lineWidth = width * px; if(dash) ctx.setLineDash(dash.map(v => v * px));
    ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.moveTo(x0 + px, y0 + px); ctx.lineTo(x1 + px, y1 + px); ctx.stroke();
    ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
  };
  const label = (text, x, y, color = "#fff") => {
    ctx.save(); ctx.font = `600 ${12 * px}px system-ui, sans-serif`; ctx.textBaseline = "top";
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(10,12,16,.72)"; ctx.fillRect(x, y, tw + 10 * px, 18 * px);
    ctx.fillStyle = color; ctx.fillText(text, x + 5 * px, y + 3 * px); ctx.restore();
  };
  if(cfg.thirds){ for(const t of [1 / 3, 2 / 3]){ line(W * t, 0, W * t, H, "rgba(255,255,255,.7)"); line(0, H * t, W, H * t, "rgba(255,255,255,.7)"); } }
  if(cfg.phi){ for(const t of [.382, .618]){ line(W * t, 0, W * t, H, "rgba(255,210,120,.8)", 1, [6, 4]); line(0, H * t, W, H * t, "rgba(255,210,120,.8)", 1, [6, 4]); } }
  if(cfg.center){ line(W / 2, 0, W / 2, H, "rgba(140,220,255,.7)", 1, [3, 4]); line(0, H / 2, W, H / 2, "rgba(140,220,255,.7)", 1, [3, 4]); }
  if(cfg.diagonals){
    line(0, 0, W, H, "rgba(190,160,255,.8)"); line(0, H, W, 0, "rgba(190,160,255,.8)");
    // Perpendiculares desde las otras esquinas (triángulos áureos)
    const foot = (px0, py0, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = ((px0 - ax) * dx + (py0 - ay) * dy) / (dx * dx + dy * dy); return [ax + dx * t, ay + dy * t]; };
    const f1 = foot(W, 0, 0, 0, W, H), f2 = foot(0, H, 0, 0, W, H), f3 = foot(0, 0, 0, H, W, 0), f4 = foot(W, H, 0, H, W, 0);
    line(W, 0, ...f1, "rgba(190,160,255,.55)", 1, [5, 4]); line(0, H, ...f2, "rgba(190,160,255,.55)", 1, [5, 4]);
    line(0, 0, ...f3, "rgba(190,160,255,.55)", 1, [5, 4]); line(W, H, ...f4, "rgba(190,160,255,.55)", 1, [5, 4]);
  }
  if(cfg.spiral){
    const [fx, fy] = spiralOrientation(), { arcs } = spiralArcs(W, H);
    ctx.save(); ctx.translate(fx ? W : 0, fy ? H : 0); ctx.scale(fx ? -1 : 1, fy ? -1 : 1);
    ctx.lineWidth = 1.6 * px; ctx.strokeStyle = "rgba(255,196,80,.9)";
    ctx.beginPath();
    for(const [cx, cy, rx, ry, a0, a1] of arcs) ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, a0, a1);
    ctx.stroke(); ctx.restore();
  }
  if(!result) { if(cfg.subject || cfg.horizon || cfg.faces) label("Analizando la foto…", 8 * px, 8 * px); return; }
  if(cfg.horizon && result.horizon){
    const hz = result.horizon, t = Math.tan(hz.angle * Math.PI / 180), yc = hz.y * H;
    line(0, yc - t * W / 2, W, yc + t * W / 2, "rgba(120,230,160,.95)", 2);
    const third = Math.abs(hz.y - 1 / 3) < Math.abs(hz.y - 2 / 3) ? 1 / 3 : 2 / 3;
    const tilt = Math.abs(hz.angle) >= .3 ? ` · inclinado ${hz.angle.toFixed(1).replace(".", ",")}°` : " · nivelado";
    label(`Horizonte${tilt}`, 8 * px, yc + 6 * px, "#9df0bd");
    if(Math.abs(hz.y - third) > .06) line(0, third * H, W, third * H, "rgba(120,230,160,.55)", 1, [8, 6]);
  }
  if(cfg.faces && result.faces?.length){
    for(const f of result.faces){
      const x = f.x * W, y = f.y * H, w = f.w * W, h = f.h * H;
      ctx.save(); ctx.lineWidth = 1.5 * px; ctx.strokeStyle = "rgba(255,150,200,.95)"; ctx.setLineDash(f.sure ? [] : [5 * px, 4 * px]); ctx.strokeRect(x, y, w, h); ctx.restore();
      const eyes = y + h * .42;
      line(x - w * .25, eyes, x + w * 1.25, eyes, "rgba(255,150,200,.85)", 1, [3, 3]);
      label(f.sure ? "Rostro" : "Rostro (estimado)", x, y - 20 * px, "#ffc2e0");
    }
  }
  if(cfg.subject && result.subject){
    const s = result.subject, b = s.box;
    ctx.save(); ctx.lineWidth = 1.5 * px; ctx.strokeStyle = "rgba(103,148,255,.95)"; ctx.setLineDash([6 * px, 4 * px]);
    ctx.strokeRect(b.x * W, b.y * H, b.w * W, b.h * H); ctx.restore();
    const [qx, qy] = nearestPower(s);
    const sx = s.x * W, sy = s.y * H, tx = qx * W, ty = qy * H;
    ctx.save(); ctx.fillStyle = "#6794ff"; ctx.beginPath(); ctx.arc(sx, sy, 5 * px, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5 * px; ctx.beginPath(); ctx.arc(tx, ty, 9 * px, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    if(Math.hypot(tx - sx, ty - sy) > 12 * px) line(sx, sy, tx, ty, "rgba(103,148,255,.9)", 1.5, [4, 3]);
    label("Sujeto", b.x * W, Math.max(0, b.y * H - 20 * px), "#b9ccff");
  }
}
setCompositionOverlay(drawComposition);

/* ── Resumen en palabras ──────────────────────────────────────── */
export function describe(r = result){
  if(!r) return ["Sin analizar todavía."];
  const out = [];
  if(r.subject){
    const s = r.subject, [qx, qy] = nearestPower(s), dist = Math.hypot(qx - s.x, qy - s.y);
    const where = `${qy < .5 ? "superior" : "inferior"} ${qx < .5 ? "izquierdo" : "derecho"}`;
    const centered = Math.hypot(s.x - .5, s.y - .5) < .08;
    out.push(dist < .07 ? `El sujeto ya cae en el punto fuerte ${where}: buena composición.`
      : centered ? `El sujeto está centrado: funciona para simetría; si no, llévalo al punto fuerte ${where}.`
      : `El sujeto está a un ${Math.round(dist * 100)} % del punto fuerte ${where}. «Recortar para encuadrar» lo lleva ahí.`);
  } else out.push("No hay un sujeto que destaque claramente.");
  if(r.horizon){
    const a = r.horizon.angle, y = r.horizon.y;
    if(Math.abs(a) >= .3) out.push(`El horizonte está inclinado ${a.toFixed(1).replace(".", ",")}°: «Enderezar» lo nivela.`);
    else out.push("El horizonte está nivelado.");
    if(Math.abs(y - .5) < .08) out.push("El horizonte parte la foto por la mitad: suele quedar mejor en un tercio.");
  }
  if(r.faces?.length){
    const f = r.faces[0], eyes = f.y + f.h * .42;
    out.push(`${r.faces.length === 1 ? "Un rostro" : r.faces.length + " rostros"}${r.faces[0].sure ? "" : " (estimado)"}: ${Math.abs(eyes - 1 / 3) < .06 ? "los ojos ya están en el tercio superior." : "conviene que los ojos queden cerca del tercio superior."}`);
  }
  return out;
}

/* ── Acciones ─────────────────────────────────────────────────── */
/** Recorte que lleva el sujeto a su punto fuerte más cercano, con la
    misma proporción que la foto y el mayor tamaño posible. */
export function suggestedCrop(r = result){
  if(!r?.subject) return null;
  const W = doc.w, H = doc.h, s = { x: r.subject.x * W, y: r.subject.y * H };
  const [qx, qy] = nearestPower(r.subject);
  let best = null;
  for(let k = 1; k >= .5; k -= .01){
    const cw = W * k, ch = H * k, x = s.x - qx * cw, y = s.y - qy * ch;
    if(x >= 0 && y >= 0 && x + cw <= W && y + ch <= H){ best = { x, y, w: cw, h: ch }; break; }
  }
  return best && { x: Math.round(best.x), y: Math.round(best.y), w: Math.round(best.w), h: Math.round(best.h) };
}

/* Endereza el documento girando todas las capas lo que marca el
   horizonte y ampliando lo justo para no dejar esquinas vacías. Un
   solo paso de historial: se guardan los lienzos de antes y después. */
export function straighten(angleDeg){
  if(!doc.open || !Number.isFinite(angleDeg) || Math.abs(angleDeg) < .05) return;
  const a = -angleDeg * Math.PI / 180, W = doc.w, H = doc.h;
  const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a));
  const k = Math.max((W * cos + H * sin) / W, (W * sin + H * cos) / H);
  const turn = src => {
    const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
    const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
    x.translate(src.width / 2, src.height / 2); x.rotate(a); x.scale(k, k); x.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  };
  const parts = doc.layers.filter(l => l.canvas && l.type !== "group").map(l => ({ l, before: { canvas: l.canvas, ctx: l.ctx, mask: l.mask } }));
  for(const p of parts){
    const c = turn(p.l.canvas);
    p.after = { canvas: c, ctx: c.getContext("2d"), mask: p.l.mask ? (() => { const m = turn(p.l.mask.canvas); return { ...p.l.mask, canvas: m, ctx: m.getContext("2d") }; })() : null };
  }
  const put = side => { for(const p of parts){ Object.assign(p.l, p[side]); p.l.thumbDirty = true; } emit("doc:structure"); emit("doc:change"); };
  put("after");
  record(`Enderezar ${angleDeg.toFixed(1)}°`, () => put("before"), () => put("after"));
  if(result?.horizon) result.horizon = { ...result.horizon, angle: 0 };
  toast(`Enderezada ${Math.abs(angleDeg).toFixed(1).replace(".", ",")}°`, "ok");
}

/* ── Diálogo ──────────────────────────────────────────────────── */
export async function openSmartGrid(){
  if(!doc.open){ toast("No hay documento abierto", "err"); return; }
  const body = document.createElement("div");
  body.innerHTML = `
    <label class="chk"><input type="checkbox" data-k="on"> <b>Mostrar la cuadrícula inteligente</b></label>
    <div class="section-label" style="margin-top:10px">Guías</div>
    <div class="sg-list" style="display:grid;gap:4px">${GUIDES.map(([k, l]) => `<label class="chk"><input type="checkbox" data-k="${k}"> ${l}</label>`).join("")}</div>
    <div class="section-label" style="margin-top:12px">Análisis de esta foto</div>
    <ul class="sg-report hint" style="margin:4px 0 8px 18px;padding:0"></ul>
    <div class="seg sg-actions">
      <button type="button" data-a="reanalyze">Volver a analizar</button>
      <button type="button" data-a="crop">Recortar para encuadrar</button>
      <button type="button" data-a="level">Enderezar horizonte</button>
    </div>`;
  const report = body.querySelector(".sg-report");
  const refresh = () => {
    report.innerHTML = describe().map(t => `<li>${t}</li>`).join("");
    body.querySelector('[data-a="crop"]').disabled = !suggestedCrop();
    body.querySelector('[data-a="level"]').disabled = !(result?.horizon && Math.abs(result.horizon.angle) >= .3);
  };
  body.querySelectorAll("[data-k]").forEach(i => {
    i.checked = !!cfg[i.dataset.k];
    i.addEventListener("change", async () => {
      cfg[i.dataset.k] = i.checked; save(); scheduleOverlay();
      if(cfg.on && (dirty || !result)){ await analyze(); refresh(); }
    });
  });
  body.addEventListener("click", async e => {
    const b = e.target.closest("[data-a]"); if(!b) return;
    if(b.dataset.a === "reanalyze"){ dirty = true; await analyze(); refresh(); }
    else if(b.dataset.a === "level"){ straighten(result.horizon.angle); refresh(); }
    else if(b.dataset.a === "crop"){
      pendingCrop = suggestedCrop();
      if(pendingCrop) closeDlg?.(null);
    }
  });
  if(!cfg.on){ cfg.on = true; save(); body.querySelector('[data-k="on"]').checked = true; }
  report.innerHTML = "<li>Analizando…</li>";
  analyze().then(refresh);
  scheduleOverlay();
  let pendingCrop = null, closeDlg = null;
  await dialog({ title: "Cuadrícula inteligente", body, onOpen: (_, api) => { closeDlg = api.close; },
                 buttons: [{ label: "Cerrar", primary: true, value: "ok" }] });
  /* «Recortar para encuadrar»: al cerrar, la herramienta Recortar con
     el marco ya puesto donde lleva el sujeto a su punto fuerte. */
  if(pendingCrop){
    const { setTool, state } = await import("./tools.js");
    setTool("crop");
    state.cropRect = pendingCrop; scheduleOverlay();
    toast("Recorte propuesto: ajústalo si quieres y pulsa «Aplicar»");
  }
}
export function toggleSmartGrid(){
  cfg.on = !cfg.on; save();
  if(cfg.on) analyze(); else scheduleOverlay();
  toast(cfg.on ? "Cuadrícula inteligente activada" : "Cuadrícula inteligente desactivada");
}
