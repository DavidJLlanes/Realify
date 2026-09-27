/* ══════════════════════════════════════════════════════════════
   UNMARK · ETAPAS DE PERTURBACIÓN (matemática pura)

   PROVENIENCIA: Basado en https://github.com/wiltodelta/remove-ai-watermarks
   Las etapas de perturbación de píxeles (DWT-DCT, transformación
   geométrica, ruido, etc.) adaptan técnicas del proyecto de referencia
   para romper los soportes estadísticos donde viven las marcas invisibles.

   Todo lo de aquí trabaja sobre planos Float32 (0..1) y arrays
   tipados, sin tocar el DOM: se ejecuta igual en el worker que en
   el hilo principal. Cada etapa recibe los parámetros YA dosificados
   (0..100) y una semilla, y devuelve los planos modificados.
   ══════════════════════════════════════════════════════════════ */

/* ── aleatoriedad reproducible ─────────────────────────────── */
export function rng(seed){
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}
export function gauss(rand){
  let u = 0, v = 0;
  while(u === 0) u = rand();
  while(v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export const N = v => Math.max(0, Math.min(1, v / 100));
export const S = v => Math.max(-1, Math.min(1, v / 100));
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* ── conversión RGBA ↔ planos ───────────────────────────────── */
export function toPlanes(data, n){
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
  for(let p = 0, i = 0; p < n; p++, i += 4){
    r[p] = data[i] / 255; g[p] = data[i+1] / 255; b[p] = data[i+2] / 255;
  }
  return { r, g, b };
}
export function fromPlanes(pl, data, n){
  for(let p = 0, i = 0; p < n; p++, i += 4){
    data[i]   = clamp01(pl.r[p]) * 255 + 0.5 | 0;
    data[i+1] = clamp01(pl.g[p]) * 255 + 0.5 | 0;
    data[i+2] = clamp01(pl.b[p]) * 255 + 0.5 | 0;
  }
}
export const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/* ── desenfoque gaussiano separable (3 pasadas de caja) ─────── */
function boxPass(src, dst, w, h, r){
  const tmp = new Float32Array(w * h);
  const inv = 1 / (2 * r + 1);
  for(let y = 0; y < h; y++){
    const row = y * w;
    let acc = 0;
    for(let x = -r; x <= r; x++) acc += src[row + (x < 0 ? 0 : x >= w ? w - 1 : x)];
    for(let x = 0; x < w; x++){
      tmp[row + x] = acc * inv;
      const xo = x - r, xi = x + r + 1;
      acc += src[row + (xi >= w ? w - 1 : xi)] - src[row + (xo < 0 ? 0 : xo)];
    }
  }
  for(let x = 0; x < w; x++){
    let acc = 0;
    for(let y = -r; y <= r; y++) acc += tmp[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + x];
    for(let y = 0; y < h; y++){
      dst[y * w + x] = acc * inv;
      const yo = y - r, yi = y + r + 1;
      acc += tmp[(yi >= h ? h - 1 : yi) * w + x] - tmp[(yo < 0 ? 0 : yo) * w + x];
    }
  }
}
export function blurPlane(src, w, h, sigma){
  if(sigma <= 0.15) return Float32Array.from(src);
  // Tres cajas de radio r aproximan una gaussiana de σ ≈ sqrt(3·(2r+1)²−… )
  const r = Math.max(1, Math.round(Math.sqrt(sigma * sigma * 12 / 3 + 1) / 2 - 0.5));
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  boxPass(a, b, w, h, r); boxPass(b, a, w, h, r); boxPass(a, b, w, h, r);
  return b;
}

/* ── remuestreo bicúbico (Catmull-Rom) con transformación afín ──
   Un solo paso de muestreo para cualquier combinación de escala,
   rotación y desplazamiento: (x, y) del destino → (u, v) del origen. */
function cubic(t){
  const a = -0.5, at = Math.abs(t);
  if(at <= 1) return (a + 2) * at * at * at - (a + 3) * at * at + 1;
  if(at < 2)  return a * at * at * at - 5 * a * at * at + 8 * a * at - 4 * a;
  return 0;
}
export function sampleAffine(src, sw, sh, dw, dh, M){
  // M = [a, b, c, d, e, f]: u = a·x + b·y + e ; v = c·x + d·y + f
  const out = new Float32Array(dw * dh);
  const [a, b, c, d, e, f] = M;
  const wx = new Float32Array(4), wy = new Float32Array(4);
  for(let y = 0; y < dh; y++){
    for(let x = 0; x < dw; x++){
      const u = a * x + b * y + e, v = c * x + d * y + f;
      const iu = Math.floor(u), iv = Math.floor(v);
      const fu = u - iu, fv = v - iv;
      for(let k = 0; k < 4; k++){ wx[k] = cubic(fu - (k - 1)); wy[k] = cubic(fv - (k - 1)); }
      let acc = 0, wsum = 0;
      for(let j = 0; j < 4; j++){
        let yy = iv + j - 1; yy = yy < 0 ? 0 : yy >= sh ? sh - 1 : yy;
        const row = yy * sw;
        for(let i = 0; i < 4; i++){
          let xx = iu + i - 1; xx = xx < 0 ? 0 : xx >= sw ? sw - 1 : xx;
          const wgt = wx[i] * wy[j];
          acc += src[row + xx] * wgt; wsum += wgt;
        }
      }
      out[y * dw + x] = wsum ? acc / wsum : 0;
    }
  }
  return out;
}
/* Escalado axial separable: pesos bicúbicos precalculados por columna
   y por fila, 4 taps por pasada en vez de 16 por píxel. */
function axisWeights(sn, dn){
  const scale = sn / dn;
  const idx = new Int32Array(dn * 4), wgt = new Float32Array(dn * 4);
  for(let d = 0; d < dn; d++){
    const u = (d + 0.5) * scale - 0.5;
    const iu = Math.floor(u), fu = u - iu;
    let sum = 0;
    for(let k = 0; k < 4; k++){
      const w = cubic(fu - (k - 1));
      let s = iu + k - 1; s = s < 0 ? 0 : s >= sn ? sn - 1 : s;
      idx[d * 4 + k] = s; wgt[d * 4 + k] = w; sum += w;
    }
    if(sum) for(let k = 0; k < 4; k++) wgt[d * 4 + k] /= sum;
  }
  return { idx, wgt };
}
export function resizePlane(src, sw, sh, dw, dh){
  const X = axisWeights(sw, dw), Y = axisWeights(sh, dh);
  const tmp = new Float32Array(dw * sh);
  for(let y = 0; y < sh; y++){
    const row = y * sw, orow = y * dw;
    for(let x = 0; x < dw; x++){
      const k = x * 4;
      tmp[orow + x] = src[row + X.idx[k]] * X.wgt[k] + src[row + X.idx[k+1]] * X.wgt[k+1]
                    + src[row + X.idx[k+2]] * X.wgt[k+2] + src[row + X.idx[k+3]] * X.wgt[k+3];
    }
  }
  const out = new Float32Array(dw * dh);
  for(let y = 0; y < dh; y++){
    const k = y * 4;
    const r0 = Y.idx[k] * dw, r1 = Y.idx[k+1] * dw, r2 = Y.idx[k+2] * dw, r3 = Y.idx[k+3] * dw;
    const w0 = Y.wgt[k], w1 = Y.wgt[k+1], w2 = Y.wgt[k+2], w3 = Y.wgt[k+3];
    const orow = y * dw;
    for(let x = 0; x < dw; x++)
      out[orow + x] = tmp[r0 + x] * w0 + tmp[r1 + x] * w1 + tmp[r2 + x] * w2 + tmp[r3 + x] * w3;
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════
   ETAPAS
   ══════════════════════════════════════════════════════════════ */

/* Rotación + recorte + desplazamiento subpíxel + escala anisótropa,
   en UNA pasada de muestreo. El recorte y la rotación exigen ampliar
   un poco para que no asomen esquinas vacías. */
export function geometry(pl, w, h, p, seed){
  const rand = rng(seed * 7 + 11);
  const rotDeg = N(p.rot) * 0.6 * (rand() < 0.5 ? -1 : 1) * (0.6 + 0.4 * rand());
  const th = rotDeg * Math.PI / 180;
  const cropFrac = N(p.crop) * 0.03;
  const shiftX = (rand() - 0.5) * N(p.shift), shiftY = (rand() - 0.5) * N(p.shift);
  const ax = 1 + (rand() - 0.5) * N(p.aniso) * 0.02;
  const ay = 1 + (rand() - 0.5) * N(p.aniso) * 0.02;
  if(Math.abs(th) < 1e-6 && cropFrac < 1e-6 && Math.abs(shiftX) < 1e-4 && Math.abs(shiftY) < 1e-4 &&
     Math.abs(ax - 1) < 1e-5 && Math.abs(ay - 1) < 1e-5) return pl;

  // Zoom que cubre el giro y el recorte
  const ar = Math.max(w / h, h / w);
  const zRot = Math.cos(th) + ar * Math.abs(Math.sin(th));
  const z = zRot * (1 + cropFrac * 2);
  const cx = w / 2, cy = h / 2;
  const cs = Math.cos(th) / z, sn = Math.sin(th) / z;
  // destino (x,y) → origen: centrar, escalar, girar, descentrar
  const a =  cs / ax, b = sn / ax, c = -sn / ay, d = cs / ay;
  const e = cx - a * cx - b * cy + shiftX;
  const f = cy - c * cx - d * cy + shiftY;
  const M = [a, b, c, d, e, f];
  return {
    r: sampleAffine(pl.r, w, h, w, h, M),
    g: sampleAffine(pl.g, w, h, w, h, M),
    b: sampleAffine(pl.b, w, h, w, h, M)
  };
}

/* Reducción y reconstrucción bicúbica, con mezcla. */
export function resample(pl, w, h, p){
  const scale = 1 - N(p.amt) * 0.5;
  if(scale >= 0.995) return pl;
  const dw = Math.max(4, Math.round(w * scale)), dh = Math.max(4, Math.round(h * scale));
  const mix = N(p.mix);
  const out = {};
  for(const ch of ["r", "g", "b"]){
    const small = resizePlane(pl[ch], w, h, dw, dh);
    const back = resizePlane(small, dw, dh, w, h);
    if(mix >= 0.999){ out[ch] = back; continue; }
    const o = new Float32Array(w * h), src = pl[ch];
    for(let i = 0; i < o.length; i++) o[i] = src[i] + (back[i] - src[i]) * mix;
    out[ch] = o;
  }
  return out;
}

/* ── Haar 2D in-place sobre un plano (una etapa de análisis) ─── */
function haarForward(src, w, h){
  const hw = w >> 1, hh = h >> 1;
  const ll = new Float32Array(hw * hh), lh = new Float32Array(hw * hh),
        hl = new Float32Array(hw * hh), hh_ = new Float32Array(hw * hh);
  for(let y = 0; y < hh; y++){
    for(let x = 0; x < hw; x++){
      const p = (2 * y) * w + 2 * x;
      const a = src[p], b = src[p + 1], c = src[p + w], d = src[p + w + 1];
      const q = y * hw + x;
      ll[q] = (a + b + c + d) * 0.5;
      lh[q] = (a - b + c - d) * 0.5;
      hl[q] = (a + b - c - d) * 0.5;
      hh_[q] = (a - b - c + d) * 0.5;
    }
  }
  return { ll, lh, hl, hh: hh_, bw: hw, bh: hh };
}
function haarInverse(bands, w, h, dst){
  const { ll, lh, hl, hh, bw: hw } = bands;
  for(let y = 0; y < bands.bh; y++){
    for(let x = 0; x < hw; x++){
      const q = y * hw + x;
      const A = ll[q], B = lh[q], C = hl[q], D = hh[q];
      const p = (2 * y) * w + 2 * x;
      dst[p]         = (A + B + C + D) * 0.5;
      dst[p + 1]     = (A - B + C - D) * 0.5;
      dst[p + w]     = (A + B - C - D) * 0.5;
      dst[p + w + 1] = (A - B - C + D) * 0.5;
    }
  }
}

/* DCT-II 2D de bloque n×n (separable, matriz precalculada). */
const DCT_CACHE = new Map();
function dctMatrix(n){
  if(DCT_CACHE.has(n)) return DCT_CACHE.get(n);
  const m = new Float32Array(n * n);
  for(let k = 0; k < n; k++){
    const ck = Math.sqrt((k === 0 ? 1 : 2) / n);
    for(let i = 0; i < n; i++) m[k * n + i] = ck * Math.cos(Math.PI * (2 * i + 1) * k / (2 * n));
  }
  DCT_CACHE.set(n, m);
  return m;
}
function dct2(block, n, out, tmp){
  const m = dctMatrix(n);
  for(let k = 0; k < n; k++)
    for(let j = 0; j < n; j++){
      let s = 0;
      for(let i = 0; i < n; i++) s += m[k * n + i] * block[i * n + j];
      tmp[k * n + j] = s;
    }
  for(let k = 0; k < n; k++)
    for(let l = 0; l < n; l++){
      let s = 0;
      for(let j = 0; j < n; j++) s += m[l * n + j] * tmp[k * n + j];
      out[k * n + l] = s;
    }
}
function idct2(coef, n, out, tmp){
  const m = dctMatrix(n);
  for(let i = 0; i < n; i++)
    for(let l = 0; l < n; l++){
      let s = 0;
      for(let k = 0; k < n; k++) s += m[k * n + i] * coef[k * n + l];
      tmp[i * n + l] = s;
    }
  for(let i = 0; i < n; i++)
    for(let j = 0; j < n; j++){
      let s = 0;
      for(let l = 0; l < n; l++) s += m[l * n + j] * tmp[i * n + l];
      out[i * n + j] = s;
    }
}

/* Luminancia ↔ RGB conservando el croma: se aplica la diferencia de
   luminancia a los tres canales, como hace spectralclean.js. */
function lumaPlane(pl, n){
  const Y = new Float32Array(n);
  for(let i = 0; i < n; i++) Y[i] = luma(pl.r[i], pl.g[i], pl.b[i]);
  return Y;
}
function applyLumaDelta(pl, Y0, Y1, n){
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const d = Y1[i] - Y0[i];
    r[i] = pl.r[i] + d; g[i] = pl.g[i] + d; b[i] = pl.b[i] + d;
  }
  return { r, g, b };
}

/* DWT Haar por niveles; en la banda LL de cada nivel, DCT 4×4 con
   ruido en los coeficientes (el soporte exacto de «dwtDct»); en las
   bandas de detalle, ganancia aleatoria por coeficiente. */
export function dwt(pl, w, h, p, seed){
  const ll = N(p.ll), hf = N(p.hf), levels = Math.max(1, Math.min(3, +p.levels || 2));
  if(ll < 0.001 && hf < 0.001) return pl;
  const rand = rng(seed * 13 + 101);
  const n = w * h;
  const Y0 = lumaPlane(pl, n);

  /* Análisis: se descompone nivel a nivel sin tocar nada. Cada nivel
     trabaja sobre dimensiones pares; la fila o columna impar sobrante
     se conserva en `cur` y se reinyecta al reconstruir. */
  const stack = [];
  let cur = Float32Array.from(Y0), cw = w, ch = h;
  for(let L = 0; L < levels; L++){
    if(cw < 8 || ch < 8) break;
    const ew = cw & ~1, eh = ch & ~1;
    let src = cur;
    if(ew !== cw || eh !== ch){
      src = new Float32Array(ew * eh);
      for(let y = 0; y < eh; y++) src.set(cur.subarray(y * cw, y * cw + ew), y * ew);
    }
    const bands = haarForward(src, ew, eh);
    stack.push({ bands, cw, ch, ew, eh, cur });
    cur = bands.ll; cw = bands.bw; ch = bands.bh;
  }
  if(!stack.length) return pl;

  /* Síntesis: de lo profundo a lo fino. En cada nivel se perturba
     ANTES de invertir, así la LL que recibe cada nivel ya lleva los
     cambios de los niveles inferiores y el resultado es coherente. */
  const B = 4, blk = new Float32Array(B * B), coef = new Float32Array(B * B), tmp = new Float32Array(B * B);
  for(let s = stack.length - 1; s >= 0; s--){
    const { bands, cw: W, ew, eh, cur: base } = stack[s];
    const depth = s + 1;
    if(hf > 0){
      const amp = hf * 0.35, bw = 8;
      for(const key of ["lh", "hl", "hh"]){
        const band = bands[key];
        for(let by = 0; by < bands.bh; by += bw)
          for(let bx = 0; bx < bands.bw; bx += bw){
            const gain = 1 + (rand() * 2 - 1) * amp;
            const add = (rand() * 2 - 1) * hf * 0.004 * depth;
            for(let y = by; y < Math.min(bands.bh, by + bw); y++)
              for(let x = bx; x < Math.min(bands.bw, bx + bw); x++){
                const q = y * bands.bw + x;
                band[q] = band[q] * gain + add;
              }
          }
      }
    }
    if(ll > 0){
      const band = bands.ll, bw = bands.bw, bh = bands.bh;
      // La LL de nivel k lleva ganancia 2^k (Haar sin normalizar);
      // el ruido se escala igual para que la huella en píxel sea la misma.
      const amp = ll * 0.045 * Math.pow(2, depth) / 4;
      for(let by = 0; by + B <= bh; by += B)
        for(let bx = 0; bx + B <= bw; bx += B){
          for(let y = 0; y < B; y++)
            for(let x = 0; x < B; x++) blk[y * B + x] = band[(by + y) * bw + bx + x];
          dct2(blk, B, coef, tmp);
          for(let k = 1; k < B * B; k++) coef[k] += (rand() * 2 - 1) * amp;
          idct2(coef, B, blk, tmp);
          for(let y = 0; y < B; y++)
            for(let x = 0; x < B; x++) band[(by + y) * bw + bx + x] = blk[y * B + x];
        }
    }
    const rec = new Float32Array(ew * eh);
    haarInverse(bands, ew, eh, rec);
    for(let y = 0; y < eh; y++) base.set(rec.subarray(y * ew, y * ew + ew), y * W);
    if(s > 0) stack[s - 1].bands.ll = base;
    else cur = base;
  }
  return applyLumaDelta(pl, Y0, cur, n);
}

/* Tabla de cuantización JPEG de luminancia (calidad 50), para
   dosificar el ruido por coeficiente por debajo de lo visible. */
const QY = [16,11,10,16,24,40,51,61, 12,12,14,19,26,58,60,55, 14,13,16,24,40,57,69,56,
            14,17,22,29,51,87,80,62, 18,22,37,56,68,109,103,77, 24,35,55,64,81,104,113,92,
            49,64,78,87,103,121,120,101, 72,92,95,98,112,100,103,99];

export function dct(pl, w, h, p, seed){
  const amt = N(p.amt);
  if(amt < 0.001) return pl;
  const B = +p.block === 16 ? 16 : 8;
  const rand = rng(seed * 17 + 7);
  const band = N(p.band);            // 0 baja · 1 alta
  const ox = Math.floor(rand() * B), oy = Math.floor(rand() * B);
  const n = w * h;
  const Y0 = lumaPlane(pl, n);
  const Y = Float32Array.from(Y0);
  const blk = new Float32Array(B * B), coef = new Float32Array(B * B), tmp = new Float32Array(B * B);
  // Peso por coeficiente: campana centrada en la banda elegida
  const wgt = new Float32Array(B * B);
  for(let v = 0; v < B; v++)
    for(let u = 0; u < B; u++){
      const f = (u + v) / (2 * (B - 1));          // 0 DC .. 1 esquina
      const g = Math.exp(-Math.pow((f - band) / 0.28, 2));
      const q = QY[(Math.min(7, v * 8 / B | 0)) * 8 + Math.min(7, u * 8 / B | 0)] / 255;
      wgt[v * B + u] = (u === 0 && v === 0) ? 0 : g * q;
    }
  for(let by = oy - B; by < h; by += B){
    for(let bx = ox - B; bx < w; bx += B){
      // bloque con borde replicado
      for(let y = 0; y < B; y++){
        let yy = by + y; yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy;
        for(let x = 0; x < B; x++){
          let xx = bx + x; xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx;
          blk[y * B + x] = Y[yy * w + xx];
        }
      }
      dct2(blk, B, coef, tmp);
      for(let k = 0; k < B * B; k++) coef[k] += (rand() * 2 - 1) * wgt[k] * amt * 0.38 * (B / 8);
      idct2(coef, B, blk, tmp);
      for(let y = 0; y < B; y++){
        const yy = by + y; if(yy < 0 || yy >= h) continue;
        for(let x = 0; x < B; x++){
          const xx = bx + x; if(xx < 0 || xx >= w) continue;
          Y[yy * w + xx] = blk[y * B + x];
        }
      }
    }
  }
  return applyLumaDelta(pl, Y0, Y, n);
}

export function blursharp(pl, w, h, p){
  const blur = N(p.blur), sharp = N(p.sharp), edge = N(p.edge);
  if(blur < 0.001 && sharp < 0.001) return pl;
  const n = w * h;
  const sigmaB = blur * 1.4;
  const out = {};
  // Máscara de contornos sobre la luminancia original
  const Y = lumaPlane(pl, n);
  const Yb = blurPlane(Y, w, h, 1.0);
  const em = new Float32Array(n);
  for(let y = 1; y < h - 1; y++)
    for(let x = 1; x < w - 1; x++){
      const q = y * w + x;
      const gx = Yb[q + 1] - Yb[q - 1], gy = Yb[q + w] - Yb[q - w];
      em[q] = Math.min(1, Math.hypot(gx, gy) * 6);
    }
  for(const ch of ["r", "g", "b"]){
    const src = pl[ch];
    const soft = sigmaB > 0.15 ? blurPlane(src, w, h, sigmaB) : Float32Array.from(src);
    const base = sigmaB > 0.15 ? blurPlane(soft, w, h, 1.0) : blurPlane(src, w, h, 1.0);
    const o = new Float32Array(n);
    for(let i = 0; i < n; i++){
      const detail = soft[i] - base[i];
      const k = sharp * 1.3 * (1 - edge * em[i]);
      o[i] = soft[i] + detail * k;
    }
    out[ch] = o;
  }
  return out;
}

export function noise(pl, w, h, p, seed){
  const lum = N(p.lum), chr = N(p.chr), size = N(p.size);
  if(lum < 0.001 && chr < 0.001) return pl;
  const rand = rng(seed * 31 + 5);
  const n = w * h;
  const sigmaL = lum * 0.08, sigmaC = chr * 0.05;
  // Grano correlacionado: se genera a menor resolución y se amplía
  const k = 1 + size * 2.5;
  const gw = Math.max(2, Math.round(w / k)), gh = Math.max(2, Math.round(h / k));
  const gen = () => {
    const g = new Float32Array(gw * gh);
    for(let i = 0; i < g.length; i++) g[i] = gauss(rand);
    return k > 1.05 ? resizePlane(g, gw, gh, w, h) : g;
  };
  const nl = gen(), nc1 = chr > 0 ? gen() : null, nc2 = chr > 0 ? gen() : null;
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const dl = nl[i] * sigmaL;
    const c1 = nc1 ? nc1[i] * sigmaC : 0, c2 = nc2 ? nc2[i] * sigmaC : 0;
    // Ruido de color en ejes opuestos (R−B, G−(R+B)/2) para no mover la luminancia
    r[i] = pl.r[i] + dl + c1 - c2 * 0.5;
    g[i] = pl.g[i] + dl + c2;
    b[i] = pl.b[i] + dl - c1 - c2 * 0.5;
  }
  return { r, g, b };
}

export function tone(pl, w, h, p){
  const gam = Math.pow(2, S(p.gamma) * 0.22);
  const con = 1 + S(p.contrast) * 0.18;
  const sat = 1 + S(p.sat) * 0.25;
  const hue = S(p.hue) * 8 * Math.PI / 180;
  if(Math.abs(gam - 1) < 1e-4 && Math.abs(con - 1) < 1e-4 && Math.abs(sat - 1) < 1e-4 && Math.abs(hue) < 1e-5) return pl;
  const n = w * h;
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
  const ch = Math.cos(hue), sh = Math.sin(hue);
  for(let i = 0; i < n; i++){
    let R = pl.r[i], G = pl.g[i], B = pl.b[i];
    // YIQ para saturación y matiz
    const Y = 0.299 * R + 0.587 * G + 0.114 * B;
    let I = 0.596 * R - 0.274 * G - 0.322 * B;
    let Q = 0.211 * R - 0.523 * G + 0.312 * B;
    const I2 = (I * ch - Q * sh) * sat, Q2 = (I * sh + Q * ch) * sat;
    R = Y + 0.956 * I2 + 0.621 * Q2;
    G = Y - 0.272 * I2 - 0.647 * Q2;
    B = Y - 1.106 * I2 + 1.703 * Q2;
    // gamma y contraste alrededor del gris medio
    const f = v => { v = Math.pow(clamp01(v), gam); return (v - 0.5) * con + 0.5; };
    r[i] = f(R); g[i] = f(G); b[i] = f(B);
  }
  return { r, g, b };
}

/* Se aplica en la conversión final a 8 bits: reescribe los `bits`
   bajos de una fracción `amt` de píxeles. */
export function lsbWrite(data, n, p, seed){
  const amt = N(p.amt), bits = Math.max(1, Math.min(3, +p.bits || 2));
  if(amt < 0.001) return;
  const rand = rng(seed * 41 + 3);
  const mask = (1 << bits) - 1;
  for(let p2 = 0, i = 0; p2 < n; p2++, i += 4){
    if(amt < 0.999 && rand() > amt) continue;
    data[i]   = (data[i]   & ~mask) | (rand() * (mask + 1) | 0);
    data[i+1] = (data[i+1] & ~mask) | (rand() * (mask + 1) | 0);
    data[i+2] = (data[i+2] & ~mask) | (rand() * (mask + 1) | 0);
  }
}

/* ── tubería completa sobre un RGBA ─────────────────────────── */
export function runPipeline({ data, width: w, height: h, stages, seed, order }, onProgress = () => {}){
  const n = w * h;
  let pl = toPlanes(data, n);
  const active = order.filter(id => stages[id]?.on);
  let done = 0;
  for(const id of active){
    const p = stages[id].p;
    switch(id){
      case "geometry":  pl = geometry(pl, w, h, p, seed); break;
      case "resample":  pl = resample(pl, w, h, p); break;
      case "dwt":       pl = dwt(pl, w, h, p, seed); break;
      case "dct":       pl = dct(pl, w, h, p, seed); break;
      case "blursharp": pl = blursharp(pl, w, h, p); break;
      case "noise":     pl = noise(pl, w, h, p, seed); break;
      case "tone":      pl = tone(pl, w, h, p); break;
      default: break;   // lsb se aplica al cuantizar
    }
    done++;
    onProgress(done / (active.length + 1));
  }
  const out = new Uint8ClampedArray(data.length);
  out.set(data);   // conserva alfa
  fromPlanes(pl, out, n);
  if(stages.lsb?.on) lsbWrite(out, n, stages.lsb.p, seed);
  onProgress(1);
  return out;
}
