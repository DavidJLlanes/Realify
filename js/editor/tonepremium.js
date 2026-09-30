/* ═══════════════════════════════════════════════════════════════
   NIVELES Y CURVAS · MODO PREMIUM 👑  (+ sus automáticos)
   Mismos mandos que el modo normal; lo que cambia es el motor:

     · Coma flotante de principio a fin: las curvas y los niveles se
       evalúan en continuo, sin los redondeos intermedios de las tablas
       de 8 bits (canal → maestra → luminosidad) del modo normal, y el
       resultado se trama al volver a 8 bits.
     · La curva o los niveles MAESTROS (RGB) no se aplican canal a canal
       sino a la «norma» de cada color (media de potencias de R, G y B),
       escalando los tres canales por igual: una curva en S ya no
       sobresatura ni cambia el tono (un naranja no se vuelve rojo), y
       un color intenso no se recorta. Las curvas y niveles de CADA
       canal siguen siendo canal a canal: ésos sí sirven para cambiar el
       color.
     · La curva de Luminosidad trabaja en luz lineal (escala R, G y B
       por igual), no sumando niveles codificados.
     · Mapeo de gama (mezcla con el gris de su luminancia, conserva el
       tono) y tramado.
   ═══════════════════════════════════════════════════════════════ */

import { DEC, applyColorMap } from "./premiumcolor.js";

/* sRGB ↔ lineal en coma flotante, por tabla interpolada */
const NT = 4096, DECF = new Float32Array(NT + 2), ENCF = new Float32Array(NT + 2);
for(let i = 0; i <= NT + 1; i++){
  const v = Math.min(1, i / NT);
  DECF[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const q = Math.min(1, (i / NT) ** 2);           // ENC con índice en raíz: fino cerca del negro
  ENCF[i] = q <= 0.0031308 ? 12.92 * q : 1.055 * q ** (1 / 2.4) - 0.055;
}
const dec = e => { e = e < 0 ? 0 : e > 1 ? 1 : e; const f = e * NT, k = f | 0; return DECF[k] + (DECF[k + 1] - DECF[k]) * (f - k); };
const enc = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; const f = Math.sqrt(v) * NT, k = f | 0; return ENCF[k] + (ENCF[k + 1] - ENCF[k]) * (f - k); };

/* ── Curvas en continuo (misma interpolación monótona que curves.js) ── */
export function curveFloat(points, N = 1024){
  const pts = (points && points.length ? points : [[0, 0], [255, 255]]).slice().sort((a, b) => a[0] - b[0]);
  const t = new Float32Array(N), n = pts.length;
  const cl = v => v < 0 ? 0 : v > 255 ? 255 : v;
  if(n === 1){ t.fill(cl(pts[0][1])); return t; }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), d = [], m = [];
  for(let i = 0; i < n - 1; i++){ const h = xs[i + 1] - xs[i]; d[i] = h === 0 ? 0 : (ys[i + 1] - ys[i]) / h; }
  m[0] = d[0];
  for(let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  m[n - 1] = d[n - 2];
  for(let i = 0; i < n - 1; i++){
    if(d[i] === 0){ m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if(s > 9){ const f = 3 / Math.sqrt(s); m[i] = f * a * d[i]; m[i + 1] = f * b * d[i]; }
  }
  for(let k = 0; k < N; k++){
    const x = k * 255 / (N - 1);
    if(x <= xs[0]){ t[k] = cl(ys[0]); continue; }
    if(x >= xs[n - 1]){ t[k] = cl(ys[n - 1]); continue; }
    let i = 0; while(i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
    t[k] = cl((2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1]);
  }
  return t;
}
/* Niveles en continuo (mismos parámetros que el modo normal) */
export function levelFloat(p, N = 1024){
  const t = new Float32Array(N), span = Math.max(1e-3, p.inHigh - p.inLow), inv = 1 / (p.gamma || 1);
  for(let k = 0; k < N; k++){
    let v = (k * 255 / (N - 1) - p.inLow) / span;
    v = v <= 0 ? 0 : v >= 1 ? 1 : Math.pow(v, inv);
    t[k] = p.outLow + v * (p.outHigh - p.outLow);
  }
  return t;
}
const isIdentity = (T, N) => { for(let k = 0; k < N; k += 7) if(Math.abs(T[k] - k * 255 / (N - 1)) > 0.02) return false; return true; };
const look = (T, e) => { const N = T.length, f = (e < 0 ? 0 : e > 1 ? 1 : e) * (N - 1), k = f | 0; return (k >= N - 1 ? T[N - 1] : T[k] + (T[k + 1] - T[k]) * (f - k)) / 255; };


/* Motor común: una transformación PURA de cada color, así que se apoya
   en premiumcolor.js (mapeo de gama, tramado, memoria de colores y, en
   la vista previa, tabla de 33³ colores interpolada). `chan` = [Fr, Fg,
   Fb] (tablas de canal o null); `master` tabla sobre la norma (o null)
   con peso `wc`; `lum` tabla de luminosidad (o null) con peso `wl`. */
function applyTone(data, { chan = null, master = null, wc = 1, lum = null, wl = 1 }, fast = false){
  const N = 1024;
  if(chan && chan.every(T => !T || isIdentity(T, N))) chan = null;
  if(master && (isIdentity(master, N) || wc <= 0)) master = null;
  if(lum && (isIdentity(lum, N) || wl <= 0)) lum = null;
  if(!chan && !master && !lum) return;
  applyColorMap(data, (R, G, B, rgb) => {
    let r, g, b;
    if(chan){
      r = dec(chan[0] ? look(chan[0], R / 255) : R / 255);
      g = dec(chan[1] ? look(chan[1], G / 255) : G / 255);
      b = dec(chan[2] ? look(chan[2], B / 255) : B / 255);
    } else { r = DEC[R]; g = DEC[G]; b = DEC[B]; }
    if(master){
      const q2 = r * r + g * g + b * b;
      if(q2 > 0){
        const Nn = (r * r * r + g * g * g + b * b * b) / q2;
        const m = 1 + (dec(look(master, enc(Nn))) / Nn - 1) * wc;
        r *= m; g *= m; b *= m;
      } else { const z = dec(look(master, 0)) * wc; r = g = b = z; }
    }
    if(lum){
      const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if(Y > 0){ const m = 1 + (dec(look(lum, enc(Y))) / Y - 1) * wl; r *= m; g *= m; b *= m; }
      else { const z = dec(look(lum, 0)) * wl; r = g = b = z; }
    }
    rgb[0] = r; rgb[1] = g; rgb[2] = b;
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return Y < 0 ? 0 : Y > 1 ? 1 : Y;      // gris de su luminancia, para el mapeo de gama
  }, { fast });
}

/* Niveles: `state.ch` = { rgb, r, g, b } */
export function applyLevelsPremium(data, state, { fast = false } = {}){
  const c = state.ch;
  applyTone(data, { chan: [levelFloat(c.r), levelFloat(c.g), levelFloat(c.b)], master: levelFloat(c.rgb) }, fast);
}

/* Curvas: { points: { rgb, r, g, b, lum }, link, mix } */
export function applyCurvesPremium(data, s, { fast = false } = {}){
  const P = s.points, wl = s.link ? s.mix / 100 : 1, wc = s.link ? 1 - wl : 1;
  applyTone(data, {
    chan: [curveFloat(P.r), curveFloat(P.g), curveFloat(P.b)],
    master: curveFloat(P.rgb), wc,
    lum: curveFloat(s.link ? P.rgb : P.lum), wl
  }, fast);
}

/* ── Automáticos ─────────────────────────────────────────────────
   Muestra de ≤ 600 px. En vez de recortar cada canal por su cuenta
   (lo que tiñe la foto cuando un canal es estrecho por la propia
   escena), se buscan los colores MÁS OSCUROS y MÁS CLAROS de verdad
   (el 0,1 % de menor y de mayor luminancia) y se usan como punto negro
   y blanco de cada canal: así se neutralizan las dominantes de las
   sombras y de las luces sin inventarse colores. Después, un ajuste de
   los medios tonos lleva la mediana hacia L* 48, con topes. */
function measure(data, w, h){
  const step = Math.max(1, Math.round(Math.sqrt(w * h / 360000)));
  const px = [];
  for(let y = 0; y < h; y += step) for(let x = 0; x < w; x += step){
    const i = (y * w + x) * 4; if(data[i + 3] < 128) continue;
    px.push([data[i], data[i + 1], data[i + 2], data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722]);
  }
  if(!px.length) return null;
  px.sort((a, b) => a[3] - b[3]);
  const k = Math.max(1, Math.round(px.length * 0.001));
  const avg = arr => [0, 1, 2].map(c => arr.reduce((s, p) => s + p[c], 0) / arr.length);
  const dark = avg(px.slice(0, k)), light = avg(px.slice(-k));
  const med = px[px.length >> 1][3];
  return { dark, light, med };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Estado de Niveles (formato de levels() en adjustments.js) */
export function autoLevelsState(data, w, h){
  const m = measure(data, w, h);
  const lvl = (lo, hi) => ({ inLow: Math.round(clamp(lo, 0, 250)), inHigh: Math.round(clamp(Math.max(hi, lo + 5), 5, 255)), gamma: 1, outLow: 0, outHigh: 255 });
  const st = { channel: "rgb", premium: true, ch: { rgb: lvl(0, 255), r: lvl(0, 255), g: lvl(0, 255), b: lvl(0, 255) } };
  if(!m) return st;
  // Negro/blanco por canal a partir de los colores extremos (con un poco
  // de margen para no recortar)
  ["r", "g", "b"].forEach((c, i) => { st.ch[c] = lvl(m.dark[i] * 0.9, m.light[i] + (255 - m.light[i]) * 0.1); });
  // Medios: mediana (tras estirar) hacia L* 48 ≈ 115 codificado
  const lumOf = v => (v - (m.dark[0] * 0.2126 + m.dark[1] * 0.7152 + m.dark[2] * 0.0722)) /
                     Math.max(1, (m.light[0] * 0.2126 + m.light[1] * 0.7152 + m.light[2] * 0.0722) - (m.dark[0] * 0.2126 + m.dark[1] * 0.7152 + m.dark[2] * 0.0722));
  const x = clamp(lumOf(m.med), 0.02, 0.98), target = 115 / 255;
  st.ch.rgb.gamma = +clamp(Math.log(x) / Math.log(target), 0.6, 1.8).toFixed(3);
  return st;
}

/* Puntos de Curvas. Normal: sólo la maestra (negro, medio, blanco).
   Premium: además, negro y blanco de cada canal (neutraliza las
   dominantes como en Niveles). */
export function autoCurvePoints(data, w, h, premium){
  const m = measure(data, w, h), I = () => [[0, 0], [255, 255]];
  const pts = { rgb: I(), r: I(), g: I(), b: I(), lum: I() };
  if(!m) return pts;
  const L = c => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  const lo = clamp(L(m.dark) * 0.9, 0, 120), hi = clamp(L(m.light) + (255 - L(m.light)) * 0.1, 135, 255);
  const mid = clamp(m.med, lo + 10, hi - 10), target = mid + (118 - mid) * 0.6;
  const mp = clamp((mid - lo) / (hi - lo) * 255, 20, 235), mt = clamp((target - lo) / (hi - lo) * 255, 30, 225);
  pts.rgb = [[Math.round(lo), 0], [Math.round(lo + (hi - lo) * mp / 255), Math.round(mt)], [Math.round(hi), 255]];
  if(premium){
    // Por canal: llevar el color más oscuro y el más claro a neutro,
    // relativo a la maestra (que ya estira la luminancia)
    ["r", "g", "b"].forEach((c, i) => {
      const dl = m.dark[i] - L(m.dark), ll = m.light[i] - L(m.light);
      pts[c] = [[Math.round(clamp(dl, 0, 60)), 0], [255 - Math.round(clamp(-ll, 0, 60)), 255]]
        .map(([x, y]) => [x, y]);
      if(dl < 0) pts[c][0] = [0, Math.round(clamp(-dl, 0, 60))];
      if(ll > 0) pts[c][1] = [255, 255 - Math.round(clamp(ll, 0, 60))];
    });
  }
  return pts;
}
