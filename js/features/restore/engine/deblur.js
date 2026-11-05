/* ═══════════════════════════════════════════════════════════════
   RESTAURAR · QUITAR DESENFOQUE (puro, sin DOM)
   Deconvolución de Wiener por bloques solapados (FFT) sobre la luminancia en luz lineal, con el núcleo del desenfoque:
   · movimiento: una línea de `largo` px con el `angulo` dado; · enfoque: un disco de `radio` px.
   K (regularización) sube con el ruido estimado, así el ruido no se dispara. Para frenar los halos, el resultado se limita al rango local
   (mínimo y máximo del original ± un margen) y se mezcla con la cantidad pedida. El color se corrige con el mismo cociente de luminancia.
   `estimar` mide el desenfoque: el ángulo por la energía direccional del gradiente, el largo por el lag donde la autocorrelación de la derivada cae al 10 % (una arista desenfocada es un pulso de ese ancho)
   y el radio por el ancho de los bordes fuertes. Entradas: planos (se modifican), valores { tipo, largo, angulo, radio, cantidad }.
   Salida: nada.
   ═══════════════════════════════════════════════════════════════ */
import { porBloques, fft2 } from "./fft2.js";
import { gauss } from "../../portrait/shared/blur.js";

const N = 256;
export const hayDeblur = v => (v.cantidad || 0) > 0;

/** Núcleo (n×n, centrado en 0 con envoltura) normalizado a suma 1 */
export function nucleo(tipo, n, largo, angulo, radio){
  const k = new Float64Array(n * n);
  if(tipo === "movimiento"){
    const a = angulo * Math.PI / 180, L = Math.max(1, largo), pasos = Math.max(2, Math.ceil(L * 4));
    for(let s = 0; s < pasos; s++){ const t = (s / (pasos - 1) - 0.5) * (L - 1); const x = Math.round(Math.cos(a) * t) , y = Math.round(Math.sin(a) * t); k[((y + n) % n) * n + ((x + n) % n)] += 1; }
  } else {
    const r = Math.max(0.5, radio), m = Math.ceil(r) + 1;
    for(let y = -m; y <= m; y++) for(let x = -m; x <= m; x++){ const d = Math.hypot(x, y); k[((y + n) % n) * n + ((x + n) % n)] = Math.min(1, Math.max(0, r + 0.5 - d)); }
  }
  let s = 0; for(const v of k) s += v; for(let i = 0; i < k.length; i++) k[i] /= s || 1;
  return k;
}

export function estimar(Y, W, H, tipo){
  const g = gauss(Y, W, H, 0.8), gx = new Float32Array(W * H), gy = new Float32Array(W * H);
  for(let y = 1; y < H - 1; y++) for(let x = 1; x < W - 1; x++){ const i = y * W + x; gx[i] = (g[i + 1] - g[i - 1]) / 2; gy[i] = (g[i + W] - g[i - W]) / 2; }
  if(tipo === "movimiento"){
    let mejor = 0, mn = 1e30; const dir = a => { const c = Math.cos(a), s = Math.sin(a); let e = 0; for(let i = 0; i < gx.length; i += 3) { const q = gx[i] * c + gy[i] * s; e += q * q; } return e; };
    for(let d = 0; d < 180; d += 6){ const e = dir(d * Math.PI / 180); if(e < mn){ mn = e; mejor = d; } }
    const a = mejor * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), acf = new Float64Array(48);
    for(let y = 2; y < H - 2; y += 2) for(let x = 50; x < W - 50; x += 2){
      const d0 = gx[y * W + x] * c + gy[y * W + x] * s;
      for(let t = 0; t < 48; t++){ const xx = Math.round(x + c * t), yy = Math.round(y + s * t); if(xx < 0 || yy < 0 || xx >= W || yy >= H) continue; acf[t] += d0 * (gx[yy * W + xx] * c + gy[yy * W + xx] * s); }
    }
    let L = 47; for(let t = 1; t < 48; t++) if(acf[t] < 0.1 * acf[0]){ L = t; break; }
    L = Math.max(3, L);
    return { angulo: mejor, largo: L };
  }
  const w = []; const idx = []; for(let i = 0; i < gx.length; i++) idx.push(i);
  const mag = i => Math.hypot(gx[i], gy[i]); idx.sort((a, b) => mag(b) - mag(a));
  for(const i of idx.slice(0, 400)){
    const x = i % W, y = (i - x) / W; if(x < 6 || y < 6 || x >= W - 6 || y >= H - 6) continue;
    let mn = 9, mx = -9; for(let dy = -5; dy <= 5; dy++) for(let dx = -5; dx <= 5; dx++){ const q = g[(y + dy) * W + x + dx]; mn = Math.min(mn, q); mx = Math.max(mx, q); }
    if(mx - mn > 0.03) w.push((mx - mn) / Math.max(mag(i), 1e-6));
  }
  w.sort((a, b) => a - b); return { radio: Math.min(12, Math.max(1, (w.length ? w[w.length >> 1] : 4) / 2)) };
}

function ruido(Y, W, H){
  const d = []; for(let y = 1; y < H - 1; y += 3) for(let x = 1; x < W - 1; x += 3){ const i = y * W + x; d.push(Math.abs(4 * Y[i] - Y[i - 1] - Y[i + 1] - Y[i - W] - Y[i + W])); }
  d.sort((a, b) => a - b); return (d[d.length >> 1] || 0) / 0.6745 / 2.45;
}

export function quitarDesenfoque(p, v){
  const { W, H, R, G, B, Y } = p, n = W * H, c = Math.min(100, Math.max(0, v.cantidad || 0)) / 100;
  if(c <= 0) return;
  const tipo = v.tipo === "enfoque" ? "enfoque" : "movimiento";
  let { largo, angulo, radio } = v; const auto = estimar(Y, W, H, tipo);
  if(!largo) largo = auto.largo; if(angulo == null || v.auto) angulo = auto.angulo != null ? auto.angulo : 0; if(!radio) radio = auto.radio;
  const K = nucleo(tipo, N, largo, angulo, radio), kr = Float64Array.from(K), ki = new Float64Array(N * N); fft2(kr, ki, N);
  const sig = ruido(Y, W, H), Kreg = Math.max(0.004, (sig * sig) * 500) * (1.6 - c * 0.9);
  const lw = new Float32Array(n); for(let i = 0; i < n; i++) lw[i] = Math.pow(Math.max(Y[i], 0), 1 / 2.2);
  const [r] = porBloques([lw], W, H, N, (re, im) => {
    for(let i = 0; i < N * N; i++){ const a = kr[i], b = ki[i], d = a * a + b * b + Kreg, wr = (re[i] * a + im[i] * b) / d, wi = (im[i] * a - re[i] * b) / d; re[i] = wr; im[i] = wi; }
  });
  const mn = new Float32Array(n), mx = new Float32Array(n);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ let a = 9, b = -9; for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++){ const q = lw[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))]; if(q < a) a = q; if(q > b) b = q; } mn[y * W + x] = a; mx[y * W + x] = b; }
  for(let i = 0; i < n; i++){
    const marg = 0.008 + 0.02 * (mx[i] - mn[i]), nuevo = Math.min(mx[i] + marg, Math.max(mn[i] - marg, r[i])), y2 = Math.pow(Math.max(0, lw[i] + c * (nuevo - lw[i])), 2.2), k = y2 / Math.max(Y[i], 1e-5);
    const f = Math.min(3, Math.max(0.33, k)); R[i] = Math.min(1, R[i] * f); G[i] = Math.min(1, G[i] * f); B[i] = Math.min(1, B[i] * f);
  }
  for(let i = 0; i < n; i++) Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
}
