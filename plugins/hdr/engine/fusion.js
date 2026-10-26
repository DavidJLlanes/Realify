/* ═══════════════════════════════════════════════════════════════
   engine · fusion
   Parte de plugins/hdr/engine.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { TO_LIN } from "./common.js";
import { clamp01 } from "../../../js/core/util/math.js";
export { clamp01 };

/* ── Fusión de exposición (Mertens) ──────────────────────────── */
function pyrDown(src, w, h, ch){
  const W = Math.max(1, (w + 1) >> 1), H = Math.max(1, (h + 1) >> 1), out = new Float32Array(W * H * ch);
  const K = [1, 4, 6, 4, 1];
  const tmp = new Float32Array(W * h * ch);
  for(let y = 0; y < h; y++) for(let X = 0; X < W; X++){
    const x = X * 2;
    for(let c = 0; c < ch; c++){
      let s = 0;
      for(let k = -2; k <= 2; k++){ const xx = Math.min(w - 1, Math.abs(x + k)); s += src[(y * w + xx) * ch + c] * K[k + 2]; }
      tmp[(y * W + X) * ch + c] = s / 16;
    }
  }
  for(let Y = 0; Y < H; Y++) for(let X = 0; X < W; X++){
    const y = Y * 2;
    for(let c = 0; c < ch; c++){
      let s = 0;
      for(let k = -2; k <= 2; k++){ const yy = Math.min(h - 1, Math.abs(y + k)); s += tmp[(yy * W + X) * ch + c] * K[k + 2]; }
      out[(Y * W + X) * ch + c] = s / 16;
    }
  }
  return { d: out, w: W, h: H };
}

function pyrUp(src, W, H, w, h, ch){
  // Bilineal: suficiente para reconstruir y mucho más rápido que el núcleo 5×5.
  const out = new Float32Array(w * h * ch);
  for(let y = 0; y < h; y++){
    const fy = Math.min(H - 1, Math.max(0, (y - 0.5) / 2)), y0 = Math.floor(fy), y1 = Math.min(H - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < w; x++){
      const fx = Math.min(W - 1, Math.max(0, (x - 0.5) / 2)), x0 = Math.floor(fx), x1 = Math.min(W - 1, x0 + 1), tx = fx - x0;
      for(let c = 0; c < ch; c++){
        const a = src[(y0 * W + x0) * ch + c], b = src[(y0 * W + x1) * ch + c], d = src[(y1 * W + x0) * ch + c], e = src[(y1 * W + x1) * ch + c];
        out[(y * w + x) * ch + c] = (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty;
      }
    }
  }
  return out;
}

/** imgs RGBA 8 bits alineados (con shifts) → Float32 RGB 0-1 fusionado. */
export function fuseMertens(imgs, shifts, rect, s, { deghost = 0, ref = -1, evs = null } = {}){
  const n = imgs.length, W = rect.w, H = rect.h, N = W * H, w = imgs[0].w;
  const wc = s.wContrast / 100, ws = s.wSat / 100, we = s.wExpo / 100, sig = 0.12 + 0.2 * (s.expoWidth / 100);
  const levels = Math.max(1, Math.min(9, Math.floor(Math.log2(Math.min(W, H))) - 2));
  // Referencia antifantasmas y EV para comparar
  if(evs && deghost && (ref < 0 || ref >= n)){ const so = evs.map((e, i) => [e, i]).sort((a, b) => a[0] - b[0]); ref = so[(so.length - 1) >> 1][1]; }
  const minEv = evs ? Math.min(...evs) : 0;
  const thr = [0, 1.6, 0.9, 0.45][deghost] || 0;
  const crop = i => {
    const out = new Float32Array(N * 3), d = imgs[i].data, { dx, dy } = shifts[i];
    for(let y = 0; y < H; y++){
      const sy = Math.min(imgs[i].h - 1, Math.max(0, rect.y + y + dy));
      for(let x = 0; x < W; x++){
        const sx = Math.min(w - 1, Math.max(0, rect.x + x + dx)), p = (sy * w + sx) * 4, o = (y * W + x) * 3;
        out[o] = d[p] / 255; out[o + 1] = d[p + 1] / 255; out[o + 2] = d[p + 2] / 255;
      }
    }
    return out;
  };
  const refImg = thr && evs ? crop(ref) : null;
  const weightOf = (px, i) => {
    const g = new Float32Array(N);
    for(let p = 0; p < N; p++) g[p] = px[p * 3] * .299 + px[p * 3 + 1] * .587 + px[p * 3 + 2] * .114;
    const Wt = new Float32Array(N);
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      const p = y * W + x;
      const lap = Math.abs(4 * g[p] - g[y * W + Math.max(0, x - 1)] - g[y * W + Math.min(W - 1, x + 1)] - g[Math.max(0, y - 1) * W + x] - g[Math.min(H - 1, y + 1) * W + x]);
      const r = px[p * 3], gg = px[p * 3 + 1], b = px[p * 3 + 2], m = (r + gg + b) / 3;
      const sat = Math.sqrt(((r - m) ** 2 + (gg - m) ** 2 + (b - m) ** 2) / 3);
      const ex = Math.exp(-((r - .5) ** 2) / (2 * sig * sig)) * Math.exp(-((gg - .5) ** 2) / (2 * sig * sig)) * Math.exp(-((b - .5) ** 2) / (2 * sig * sig));
      let wt = Math.pow(lap + 1e-3, wc) * Math.pow(sat + 1e-3, ws) * Math.pow(ex + 1e-6, we) + 1e-12;
      if(refImg && i !== ref){
        const e = Math.pow(2, evs[i] - evs[ref]);
        const La = TO_LIN[Math.round(clamp01(g[p]) * 255)] / e;
        const gr = refImg[p * 3] * .299 + refImg[p * 3 + 1] * .587 + refImg[p * 3 + 2] * .114;
        const Lr = TO_LIN[Math.round(clamp01(gr) * 255)];
        if(gr > .03 && gr < .97 && g[p] > .03 && g[p] < .97 && La > 0 && Lr > 0 && Math.abs(Math.log2(La / Lr)) > thr) wt *= .002;
      }
      Wt[p] = wt;
    }
    return Wt;
  };
  // 1ª pasada: suma de pesos para normalizar.
  const sumW = new Float32Array(N);
  for(let i = 0; i < n; i++){ const Wt = weightOf(crop(i), i); for(let p = 0; p < N; p++) sumW[p] += Wt[p]; }
  // 2ª pasada: se acumula la pirámide laplaciana ponderada de cada foto.
  let acc = null, sizes = null;
  for(let i = 0; i < n; i++){
    const px = crop(i), Wt = weightOf(px, i);
    for(let p = 0; p < N; p++) Wt[p] /= sumW[p];
    // Pirámides
    const gI = [{ d: px, w: W, h: H }], gW = [{ d: Wt, w: W, h: H }];
    for(let l = 1; l < levels; l++){ gI.push(pyrDown(gI[l - 1].d, gI[l - 1].w, gI[l - 1].h, 3)); gW.push(pyrDown(gW[l - 1].d, gW[l - 1].w, gW[l - 1].h, 1)); }
    if(!acc){ acc = gI.map(g => new Float32Array(g.w * g.h * 3)); sizes = gI.map(g => [g.w, g.h]); }
    for(let l = 0; l < levels; l++){
      const cur = gI[l], wl = gW[l].d, a = acc[l];
      let lap = cur.d;
      if(l < levels - 1){
        const up = pyrUp(gI[l + 1].d, gI[l + 1].w, gI[l + 1].h, cur.w, cur.h, 3);
        lap = new Float32Array(cur.d.length);
        for(let k = 0; k < lap.length; k++) lap[k] = cur.d[k] - up[k];
      }
      for(let p = 0, k = 0; p < wl.length; p++, k += 3){ const ww = wl[p]; a[k] += lap[k] * ww; a[k + 1] += lap[k + 1] * ww; a[k + 2] += lap[k + 2] * ww; }
    }
  }
  // Reconstrucción
  let img = acc[levels - 1];
  for(let l = levels - 2; l >= 0; l--){
    const [w1, h1] = sizes[l + 1], [w0, h0] = sizes[l];
    const up = pyrUp(img, w1, h1, w0, h0, 3), a = acc[l];
    for(let k = 0; k < up.length; k++) up[k] += a[k];
    img = up;
  }
  for(let k = 0; k < img.length; k++) img[k] = clamp01(img[k]);
  return { w: W, h: H, px: img };
}
