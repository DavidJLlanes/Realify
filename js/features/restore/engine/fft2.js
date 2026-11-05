/* ═══════════════════════════════════════════════════════════════
   RESTAURAR · FFT 2D (puro, sin DOM)
   Transformada de Fourier en dos dimensiones y su inversa para bloques cuadrados de lado potencia de dos, apoyada en fft1d de
   js/analysis/fft.js. Entradas: re, im (Float64Array n×n, se modifican) y n. Salida: nada (los bloques quedan transformados).
   ═══════════════════════════════════════════════════════════════ */
import { fft1d } from "../../../analysis/fft.js";

function filas(re, im, n){
  const fr = new Float64Array(n), fi = new Float64Array(n);
  for(let y = 0; y < n; y++){ fr.set(re.subarray(y * n, y * n + n)); fi.set(im.subarray(y * n, y * n + n)); fft1d(fr, fi, n); re.set(fr, y * n); im.set(fi, y * n); }
}
function trasponer(a, n){ for(let y = 0; y < n; y++) for(let x = y + 1; x < n; x++){ const t = a[y * n + x]; a[y * n + x] = a[x * n + y]; a[x * n + y] = t; } }

export function fft2(re, im, n){ filas(re, im, n); trasponer(re, n); trasponer(im, n); filas(re, im, n); trasponer(re, n); trasponer(im, n); }
export function ifft2(re, im, n){
  for(let i = 0; i < im.length; i++) im[i] = -im[i];
  fft2(re, im, n);
  const k = 1 / (n * n); for(let i = 0; i < re.length; i++){ re[i] *= k; im[i] = -im[i] * k; }
}

/** Mosaico solapado: aplica `fn(re, im, n, canalIndice)` al espectro de cada bloque ventaneado (Hann) y suma los bloques (la ventana Hann con paso n/2 suma 1). */
export function porBloques(planos, W, H, n, fn){
  const hop = n / 2, win = new Float64Array(n); for(let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * (i + 0.5) / n);
  const out = planos.map(() => new Float32Array(W * H)), re = new Float64Array(n * n), im = new Float64Array(n * n);
  for(let by = -hop; by < H; by += hop) for(let bx = -hop; bx < W; bx += hop){
    planos.forEach((pl, c) => {
      for(let y = 0; y < n; y++) for(let x = 0; x < n; x++){
        const sx = Math.min(W - 1, Math.max(0, bx + x)), sy = Math.min(H - 1, Math.max(0, by + y));
        re[y * n + x] = pl[sy * W + sx] * win[x] * win[y]; im[y * n + x] = 0;
      }
      fft2(re, im, n); fn(re, im, n, c); ifft2(re, im, n);
      for(let y = 0; y < n; y++){ const yy = by + y; if(yy < 0 || yy >= H) continue; for(let x = 0; x < n; x++){ const xx = bx + x; if(xx < 0 || xx >= W) continue; out[c][yy * W + xx] += re[y * n + x]; } }
    });
  }
  return out;
}
