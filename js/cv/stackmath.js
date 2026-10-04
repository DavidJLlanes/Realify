/* ═══════════════════════════════════════════════════════════════
   MATEMÁTICA DEL APILADO DE FOTOS (fase 7)
   Sin DOM: la usan la herramienta y las pruebas en Node.
   Las fotos llegan ya alineadas, como RGBA de 8 bits a tamaño W×H; el
   alfa vale 0 donde la foto no llega (bordes tras alinear). Todo se
   mezcla en luz LINEAL y se codifica a sRGB con un tramado de ±½ nivel.

     · Reducir ruido: media de las tomas con rechazo de lo que se mueve
       (cada toma se compara con la mediana de las demás, con el ruido
       medido en la propia pila según el nivel de luz).
     · Enfoque: en cada punto gana la toma más nítida (Laplaciano
       suavizado), con transiciones suaves entre zonas.
   ═══════════════════════════════════════════════════════════════ */

export const DEC = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; DEC[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
export const enc = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
const hash = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const VALID = 250;                      // alfa mínimo para fiarse de un píxel

/* ── Ruido de la pila ────────────────────────────────────────── */

const BINS = 16;
/** Mide el ruido de la pila: desviación típica (luz lineal) por nivel de
    luz, con la mediana de las desviaciones absolutas entre tomas. */
export function noiseCurve(imgs, W, H, stride = 7){
  const n = imgs.length, per = Array.from({ length: BINS }, () => []), vals = new Float32Array(n), dev = new Float32Array(n);
  for(let p = 0; p < W * H; p += stride + (p % 5)){
    let k = 0;
    for(let i = 0; i < n; i++){ const o = p * 4; if(imgs[i][o + 3] >= VALID) vals[k++] = DEC[imgs[i][o + 1]]; }
    if(k < 3) continue;
    const s = Array.from(vals.subarray(0, k)).sort((a, b) => a - b), m = s[k >> 1];
    for(let i = 0; i < k; i++) dev[i] = Math.abs(s[i] - m);
    const d = Array.from(dev.subarray(0, k)).sort((a, b) => a - b), mad = d[k >> 1] * (k / (k - 1));
    const b = Math.min(BINS - 1, Math.floor(Math.sqrt(m) * BINS));
    per[b].push(mad);
  }
  const all = per.flat().sort((a, b) => a - b), glob = all.length ? 1.4826 * all[all.length >> 1] : 0.01;
  const sig = per.map(a => { if(a.length < 30) return null; a.sort((x, y) => x - y); return 1.4826 * a[a.length >> 1]; });
  // Huecos: vecino más cercano con datos (o el global)
  for(let b = 0; b < BINS; b++) if(sig[b] === null){ let best = glob, bd = 99; for(let c = 0; c < BINS; c++) if(sig[c] !== null && Math.abs(c - b) < bd){ bd = Math.abs(c - b); best = sig[c]; } sig[b] = best; }
  const floor = Math.max(1e-4, glob * 0.25);
  return v => Math.max(floor, sig[Math.min(BINS - 1, Math.floor(Math.sqrt(v < 0 ? 0 : v) * BINS))]);
}

/* ── Reducir ruido ───────────────────────────────────────────── */

/**
 * Combina las filas [y0, y1) de la pila en `out` (RGBA, alfa 255, de alto y1 − y0).
 * opts.reject: rechazar lo que se mueve; opts.sigmaOf: curva de ruido; opts.ref: toma de referencia.
 */
export function combineNoise(imgs, W, y0, y1, out, { reject = true, sigmaOf = null, ref = 0, T = 3.2 } = {}){
  const n = imgs.length, v = [new Float32Array(n), new Float32Array(n), new Float32Array(n)], idx = new Int32Array(n), tmp = new Float32Array(n);
  for(let y = y0; y < y1; y++) for(let x = 0; x < W; x++){
    const p = y * W + x, o = p * 4;
    let k = 0;
    for(let i = 0; i < n; i++){ if(imgs[i][o + 3] >= VALID){ idx[k] = i; v[0][k] = DEC[imgs[i][o]]; v[1][k] = DEC[imgs[i][o + 1]]; v[2][k] = DEC[imgs[i][o + 2]]; k++; } }
    let r = 0, g = 0, b = 0;
    if(k === 0){                               // nadie llega: lo que haya en la referencia
      r = DEC[imgs[ref][o]]; g = DEC[imgs[ref][o + 1]]; b = DEC[imgs[ref][o + 2]];
    } else if(k <= 2 || !reject || !sigmaOf){
      for(let j = 0; j < k; j++){ r += v[0][j]; g += v[1][j]; b += v[2][j]; } r /= k; g /= k; b /= k;
    } else {
      // Mediana por canal y desviación de cada toma respecto a ella
      const med = [0, 0, 0];
      for(let c = 0; c < 3; c++){ for(let j = 0; j < k; j++) tmp[j] = v[c][j]; const s = tmp.subarray(0, k).sort(); med[c] = (k & 1) ? s[k >> 1] : 0.5 * (s[(k >> 1) - 1] + s[k >> 1]); }
      const sg = [sigmaOf(med[0]), sigmaOf(med[1]), sigmaOf(med[2])];
      let sw = 0;
      for(let j = 0; j < k; j++){
        const d = Math.max(Math.abs(v[0][j] - med[0]) / sg[0], Math.abs(v[1][j] - med[1]) / sg[1], Math.abs(v[2][j] - med[2]) / sg[2]);
        const w = d <= T ? 1 : Math.exp(-((d - T) * (d - T)) / 2.5);
        r += w * v[0][j]; g += w * v[1][j]; b += w * v[2][j]; sw += w;
      }
      if(sw < 1e-6){ r = med[0]; g = med[1]; b = med[2]; } else { r /= sw; g /= sw; b /= sw; }
    }
    const nz = (hash(p) - 0.5) * 0.9, oo = ((y - y0) * W + x) * 4;
    out[oo] = enc(r) + nz; out[oo + 1] = enc(g) + nz; out[oo + 2] = enc(b) + nz; out[oo + 3] = 255;
  }
}

/* ── Enfoque ─────────────────────────────────────────────────── */

function boxH(a, w, h, r, o){        // media móvil horizontal
  for(let y = 0; y < h; y++){
    const base = y * w; let s = 0;
    for(let x = -r; x <= r; x++) s += a[base + Math.min(w - 1, Math.max(0, x))];
    for(let x = 0; x < w; x++){ o[base + x] = s / (2 * r + 1); s += a[base + Math.min(w - 1, x + r + 1)] - a[base + Math.max(0, x - r)]; }
  }
}
function boxV(a, w, h, r, o){        // media móvil vertical
  for(let x = 0; x < w; x++){
    let s = 0;
    for(let y = -r; y <= r; y++) s += a[Math.min(h - 1, Math.max(0, y)) * w + x];
    for(let y = 0; y < h; y++){ o[y * w + x] = s / (2 * r + 1); s += a[Math.min(h - 1, y + r + 1) * w + x] - a[Math.max(0, y - r) * w + x]; }
  }
}
export function boxBlur(a, w, h, r){ const t = new Float32Array(a.length), o = new Float32Array(a.length); boxH(a, w, h, r, t); boxV(t, w, h, r, o); return o; }

/** Nitidez local de una toma en las filas [ya, yb) (con margen), 0 si no vale. */
function sharpness(img, W, ya, yb, r){
  const h = yb - ya, L = new Float32Array(W * h);
  for(let y = 0; y < h; y++) for(let x = 0; x < W; x++){ const o = ((ya + y) * W + x) * 4; L[y * W + x] = img[o + 3] >= VALID ? (img[o] * 0.299 + img[o + 1] * 0.587 + img[o + 2] * 0.114) : -1; }
  const sm = boxBlur(L, W, h, 1), S = new Float32Array(W * h);
  for(let y = 1; y < h - 1; y++) for(let x = 1; x < W - 1; x++){
    const i = y * W + x;
    if(L[i] < 0 || L[i - 1] < 0 || L[i + 1] < 0 || L[i - W] < 0 || L[i + W] < 0) continue;
    S[i] = Math.abs(4 * sm[i] - sm[i - 1] - sm[i + 1] - sm[i - W] - sm[i + W]);
  }
  return boxBlur(S, W, h, r);
}

export const FOCUS_PAD = 16;
/** Combina las filas [y0, y1) eligiendo la toma más nítida en cada punto. */
export function combineFocus(imgs, W, H, y0, y1, out, { power = 6, smooth = 3, ref = 0 } = {}){
  const n = imgs.length, ya = Math.max(0, y0 - FOCUS_PAD), yb = Math.min(H, y1 + FOCUS_PAD), h = yb - ya;
  const S = imgs.map(im => sharpness(im, W, ya, yb, 2));
  const wt = Array.from({ length: n }, () => new Float32Array(W * h));
  for(let i = 0; i < W * h; i++){
    let mx = 0; for(let k = 0; k < n; k++) if(S[k][i] > mx) mx = S[k][i];
    if(mx < 1e-3){ wt[ref][i] = 1; continue; }                    // zona lisa: la referencia
    for(let k = 0; k < n; k++) wt[k][i] = Math.pow(S[k][i] / mx, power);
  }
  const ws = wt.map(a => boxBlur(a, W, h, smooth));               // transiciones suaves entre zonas
  for(let y = y0; y < y1; y++) for(let x = 0; x < W; x++){
    const o = (y * W + x) * 4, i = (y - ya) * W + x;
    let r = 0, g = 0, b = 0, sw = 0;
    for(let k = 0; k < n; k++){
      if(imgs[k][o + 3] < VALID) continue;
      const w = ws[k][i]; if(w <= 0) continue;
      r += w * DEC[imgs[k][o]]; g += w * DEC[imgs[k][o + 1]]; b += w * DEC[imgs[k][o + 2]]; sw += w;
    }
    if(sw <= 1e-9){ r = DEC[imgs[ref][o]]; g = DEC[imgs[ref][o + 1]]; b = DEC[imgs[ref][o + 2]]; sw = 1; }
    r /= sw; g /= sw; b /= sw;
    const nz = (hash(y * W + x) - 0.5) * 0.9, oo = ((y - y0) * W + x) * 4;
    out[oo] = enc(r) + nz; out[oo + 1] = enc(g) + nz; out[oo + 2] = enc(b) + nz; out[oo + 3] = 255;
  }
}
