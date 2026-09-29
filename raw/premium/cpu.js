/* ═══════════════════════════════════════════════════════════════
   REVELADO PREMIUM · CPU
   La referencia exacta del flujo descrito en core.js. La usa el worker
   para el resultado final (por franjas, sin crear nunca la imagen
   entera en coma flotante), la exportación de 16 bits y, si el equipo
   no tiene WebGL2 con texturas flotantes, también la vista previa.
   gpu.js reproduce estas mismas operaciones; tests/premium.mjs mide
   la diferencia entre ambas (ΔE).
   ═══════════════════════════════════════════════════════════════ */
import { Y2020, MID, R_COARSE, R_CHROMA, EPS_COARSE, EPS_HAZE, R_FINE, HALO,
         SRGB_TO_2020, REC2020_TO_SRGB, OK_M1_2020, OK_M2, OK_M2_INV, OK_M1_INV_SRGB,
         decodeLut16, srgbDecode, mapSize, SHOULDER } from "./core.js";

const RY = Y2020[0], GY = Y2020[1], BY = Y2020[2];
const smooth = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
const SRGB8 = Float32Array.from({ length: 256 }, (_, i) => srgbDecode(i / 255));
let _enc = null;
function encTable(){                      // lineal (0..1, 16 384 pasos, índice en raíz) → sRGB 0..1
  if(!_enc){
    _enc = new Float32Array(16385);
    for(let i = 0; i <= 16384; i++){ const v = (i / 16384) ** 2; _enc[i] = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; }
  }
  return _enc;
}
const encode = v => {                     // sRGB exacto a efectos de 16 bits (interpolado)
  if(v <= 0) return 0; if(v >= 1) return 1;
  const t = _enc, f = Math.sqrt(v) * 16384, k = f | 0;
  return t[k] + (t[k + 1 < 16385 ? k + 1 : k] - t[k]) * (f - k);
};
export const grainAt = (x, y) => {
  let v = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0;
  return ((v ^ (v >>> 16)) & 255) / 255 - 0.5;
};
const ditherAt = (x, y, c) => {
  let h = Math.imul(x * 3 + c + 0x2545f491, 0x9e3779b1) ^ Math.imul(y + 0x6a09e667, 0x85ebca77);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return ((h & 1023) + 0.5) / 1024 - 0.5;
};

/* ── lectura de la fuente → Rec.2020 lineal × margen ─────────────
   Tipos de fuente:
   · LibRaw: { linear, data: Uint16Array, channels, scale, encoding:"bt709", space, gain }
   · vista previa ya preparada: { linear, data: Float32Array RGBA, encoding:"linear", space:"rec2020" }
   · ráster (Revelado fotográfico): { raster:true, data: Uint8ClampedArray RGBA } en sRGB */
export function sourceReader(src){
  const W = src.width, ch = src.raster ? 4 : (src.channels || 3), data = src.data;
  const toWide = !src.raster && src.space === "rec2020" ? null : SRGB_TO_2020;
  const gain = (src.gain || 1) * (src.base || 1);
  let dec;
  if(src.raster) dec = i => SRGB8[data[i]];
  else if(src.encoding === "bt709"){
    const lut = decodeLut16(), s = (src.scale || 65535) === 255 ? 256 : 1;
    dec = i => lut[data[i] * s];
  } else { const sc = src.scale || 1; dec = i => data[i] / sc; }
  const m = toWide;
  /* Rellena `out` (3 floats por píxel) con las filas [y0, y1). */
  return (y0, y1, out) => {
    let o = 0;
    for(let y = y0; y < y1; y++){
      let i = y * W * ch;
      for(let x = 0; x < W; x++, i += ch){
        const r = dec(i), g = ch === 1 ? r : dec(i + 1), b = ch === 1 ? r : dec(i + 2);
        if(m){
          out[o++] = (m[0][0] * r + m[0][1] * g + m[0][2] * b) * gain;
          out[o++] = (m[1][0] * r + m[1][1] * g + m[1][2] * b) * gain;
          out[o++] = (m[2][0] * r + m[2][1] * g + m[2][2] * b) * gain;
        } else { out[o++] = r * gain; out[o++] = g * gain; out[o++] = b * gain; }
      }
    }
  };
}

/* Corrección de viñeteado de lente (misma fórmula que el revelado de
   siempre, pero aplicada en luz lineal ANTES del tono, que es donde
   ocurre físicamente). */
const lensGain = (P, x, y, W, H) => {
  if(!P.lensVignette) return 1;
  const half = Math.max(W, H) / 2, dx = (x + 0.5 - W / 2) / half, dy = (y + 0.5 - H / 2) / half;
  const e = Math.min(1, dx * dx + dy * dy);
  return 2 ** (P.lensVignette * e * e * 0.8);
};

/* ── cajas (media en ventana, contando sólo lo que hay dentro) ─── */
function boxH(src, dst, w, h, ch, r){
  for(let y = 0; y < h; y++){
    const row = y * w * ch;
    for(let c = 0; c < ch; c++){
      let s = 0;
      for(let x = 0; x <= Math.min(r, w - 1); x++) s += src[row + x * ch + c];
      for(let x = 0; x < w; x++){
        const n = Math.min(w - 1, x + r) - Math.max(0, x - r) + 1;
        dst[row + x * ch + c] = s / n;
        if(x - r >= 0) s -= src[row + (x - r) * ch + c];
        if(x + r + 1 < w) s += src[row + (x + r + 1) * ch + c];
      }
    }
  }
}
function boxV(src, dst, w, h, ch, r){
  const stride = w * ch;
  for(let k = 0; k < stride; k++){
    let s = 0;
    for(let y = 0; y <= Math.min(r, h - 1); y++) s += src[y * stride + k];
    for(let y = 0; y < h; y++){
      const n = Math.min(h - 1, y + r) - Math.max(0, y - r) + 1;
      dst[y * stride + k] = s / n;
      if(y - r >= 0) s -= src[(y - r) * stride + k];
      if(y + r + 1 < h) s += src[(y + r + 1) * stride + k];
    }
  }
}
const box = (src, w, h, ch, r) => { const t = new Float32Array(src.length), o = new Float32Array(src.length); boxH(src, t, w, h, ch, r); boxV(t, o, w, h, ch, r); return o; };

/* Filtro guiado (autoguiado) de dos canales empaquetados (x, y):
   devuelve las medias de los coeficientes (āx, b̄x, āy, b̄y). */
function guided2(xy, w, h, r, epsX, epsY){
  const n = w * h, st = new Float32Array(n * 4);
  for(let i = 0; i < n; i++){ const x = xy[i * 2], y = xy[i * 2 + 1]; st[i*4] = x; st[i*4+1] = x * x; st[i*4+2] = y; st[i*4+3] = y * y; }
  const m = box(st, w, h, 4, r), co = new Float32Array(n * 4);
  for(let i = 0; i < n; i++){
    const mx = m[i*4], vx = Math.max(0, m[i*4+1] - mx * mx), my = m[i*4+2], vy = Math.max(0, m[i*4+3] - my * my);
    const ax = vx / (vx + epsX), ay = vy / (vy + epsY);
    co[i*4] = ax; co[i*4+1] = mx * (1 - ax); co[i*4+2] = ay; co[i*4+3] = my * (1 - ay);
  }
  return box(co, w, h, 4, r);
}

/* ── mapas de baja resolución ────────────────────────────────────
   Media por área (cada píxel del original cuenta en la celda que
   contiene su centro) de la imagen tras margen, balance y viñeteado
   de lente; luego los filtros guiados de la base (log2 Y), la neblina
   (canal mínimo) y el color (R/Y, B/Y). */
export function computeMaps(src, P){
  const W = src.width, H = src.height, [mw, mh] = mapSize(W, H), read = sourceReader(src);
  const acc = new Float64Array(mw * mh * 4), row = new Float32Array(W * 3);
  const jx = new Int32Array(W); for(let x = 0; x < W; x++) jx[x] = Math.min(mw - 1, Math.floor((x + 0.5) * mw / W));
  for(let y = 0; y < H; y++){
    read(y, y + 1, row);
    const j = Math.min(mh - 1, Math.floor((y + 0.5) * mh / H)) * mw;
    for(let x = 0; x < W; x++){
      const lg = lensGain(P, x, y, W, H), k = (j + jx[x]) * 4;
      acc[k] += row[x*3] * P.wb[0] * lg; acc[k+1] += row[x*3+1] * P.wb[1] * lg; acc[k+2] += row[x*3+2] * P.wb[2] * lg; acc[k+3]++;
    }
  }
  return mapsFromMeans(acc, mw, mh, P);
}
export function mapsFromMeans(acc, mw, mh, P){
  const n = mw * mh, A = new Float32Array(n * 2), B = new Float32Array(n * 2);
  for(let i = 0; i < n; i++){
    const c = acc[i*4+3] || 1, r = acc[i*4] / c, g = acc[i*4+1] / c, b = acc[i*4+2] / c;
    const Y = RY * r + GY * g + BY * b;
    A[i*2] = Math.log2(Math.max(Y, 1e-6)); A[i*2+1] = Math.max(0, Math.min(r, g, b));
    const ok = Y > 1e-6;
    B[i*2] = ok ? Math.min(16, Math.max(0, r / Y)) : 1; B[i*2+1] = ok ? Math.min(16, Math.max(0, b / Y)) : 1;
  }
  return { mw, mh, A: guided2(A, mw, mh, R_COARSE, EPS_COARSE, EPS_HAZE), B: guided2(B, mw, mh, R_CHROMA, P.epsChroma, P.epsChroma) };
}
function sampleMap(M, mw, mh, u, v, out){           // bilineal, 4 canales
  u = Math.max(0, Math.min(mw - 1, u)); v = Math.max(0, Math.min(mh - 1, v));
  const x0 = Math.floor(u), y0 = Math.floor(v), x1 = Math.min(mw - 1, x0 + 1), y1 = Math.min(mh - 1, y0 + 1), tx = u - x0, ty = v - y0;
  for(let c = 0; c < 4; c++){
    const a = M[(y0*mw+x0)*4+c], b = M[(y0*mw+x1)*4+c], d = M[(y1*mw+x0)*4+c], e = M[(y1*mw+x1)*4+c];
    out[c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
  }
}

/* ── color: OKLab y ajuste de gama a sRGB ─────────────────────── */
const _lab = new Float64Array(3), _rgb = new Float64Array(3);
function labToSrgb(L, a, b){
  let l = L + OK_M2_INV[0][1] * a + OK_M2_INV[0][2] * b; l = l * l * l;
  let m = L + OK_M2_INV[1][1] * a + OK_M2_INV[1][2] * b; m = m * m * m;
  let s = L + OK_M2_INV[2][1] * a + OK_M2_INV[2][2] * b; s = s * s * s;
  const M = OK_M1_INV_SRGB;
  _rgb[0] = M[0][0] * l + M[0][1] * m + M[0][2] * s;
  _rgb[1] = M[1][0] * l + M[1][1] * m + M[1][2] * s;
  _rgb[2] = M[2][0] * l + M[2][1] * m + M[2][2] * s;
}
const inGamut = () => _rgb[0] >= -1e-7 && _rgb[1] >= -1e-7 && _rgb[2] >= -1e-7 && _rgb[0] <= 1 + 1e-7 && _rgb[1] <= 1 + 1e-7 && _rgb[2] <= 1 + 1e-7;
/* Rec.2020 lineal de pantalla → OKLab (_lab) */
function toLab(r, g, b){
  const M = OK_M1_2020;
  const l = Math.cbrt(M[0][0] * r + M[0][1] * g + M[0][2] * b);
  const m = Math.cbrt(M[1][0] * r + M[1][1] * g + M[1][2] * b);
  const s = Math.cbrt(M[2][0] * r + M[2][1] * g + M[2][2] * b);
  _lab[0] = OK_M2[0][0] * l + OK_M2[0][1] * m + OK_M2[0][2] * s;
  _lab[1] = OK_M2[1][0] * l + OK_M2[1][1] * m + OK_M2[1][2] * s;
  _lab[2] = OK_M2[2][0] * l + OK_M2[2][1] * m + OK_M2[2][2] * s;
}
/* Deja en _rgb el sRGB lineal dentro de gama: croma reducido lo justo. */
export function gamutMapLab(L, a, b){
  if(L >= 1){ _rgb[0] = _rgb[1] = _rgb[2] = 1; return; }
  if(L <= 0){ _rgb[0] = _rgb[1] = _rgb[2] = 0; return; }
  labToSrgb(L, a, b);
  if(inGamut()) return;
  let lo = 0, hi = 1;
  for(let k = 0; k < 14; k++){ const t = (lo + hi) / 2; labToSrgb(L, a * t, b * t); if(inGamut()) lo = t; else hi = t; }
  labToSrgb(L, a * lo, b * lo);
  for(let c = 0; c < 3; c++) _rgb[c] = Math.max(0, Math.min(1, _rgb[c]));
}

/* ── una franja ──────────────────────────────────────────────────
   Revela las filas [y0, y1) de una imagen W×H y devuelve sRGB lineal
   de pantalla (3 floats por píxel), ya dentro de gama y con el
   viñeteado creativo. */
/* `sceneOnly`: se para tras la exposición (balance, óptica, ruido y
   exposición aplicados) y devuelve la escena en luz lineal Rec.2020,
   sin tono ni color de pantalla. Es lo que usa la fusión HDR Premium. */
export function renderRows(src, P, maps, y0, y1, sceneOnly = false){
  const W = src.width, H = src.height, read = sourceReader(src);
  const caPad = P.ca ? Math.ceil(Math.abs(P.ca) * Math.max(W, H) / 2) + 2 : 0;
  const a0 = Math.max(0, y0 - HALO), a1 = Math.min(H, y1 + HALO);          // filas trabajadas
  const r0 = Math.max(0, a0 - caPad), r1 = Math.min(H, a1 + caPad);       // filas leídas
  const rows = a1 - a0, n = rows * W;
  let rgb0;
  if(!P.ca && r0 === a0 && r1 === a1){ rgb0 = new Float32Array(n * 3); read(a0, a1, rgb0); }
  else {
    const raw = new Float32Array((r1 - r0) * W * 3); read(r0, r1, raw);
    rgb0 = new Float32Array(n * 3);
    const at = (x, y, c) => raw[((Math.max(r0, Math.min(r1 - 1, y)) - r0) * W + Math.max(0, Math.min(W - 1, x))) * 3 + c];
    const bil = (x, y, c) => {
      x = Math.max(0, Math.min(W - 1, x)); y = Math.max(0, Math.min(H - 1, y));
      const x0 = Math.floor(x), yy = Math.floor(y), x1 = Math.min(W - 1, x0 + 1), y1b = Math.min(H - 1, yy + 1), tx = x - x0, ty = y - yy;
      return (at(x0, yy, c) * (1 - tx) + at(x1, yy, c) * tx) * (1 - ty) + (at(x0, y1b, c) * (1 - tx) + at(x1, y1b, c) * tx) * ty;
    };
    for(let y = a0; y < a1; y++) for(let x = 0; x < W; x++){
      const i = ((y - a0) * W + x) * 3;
      if(P.ca){ const dx = (x + 0.5 - W / 2) * P.ca, dy = (y + 0.5 - H / 2) * P.ca; rgb0[i] = bil(x + dx, y + dy, 0); rgb0[i+1] = at(x, y, 1); rgb0[i+2] = bil(x - dx, y - dy, 2); }
      else { rgb0[i] = at(x, y, 0); rgb0[i+1] = at(x, y, 1); rgb0[i+2] = at(x, y, 2); }
    }
  }
  // Balance, viñeteado de lente y log2 Y
  const half = Math.max(W, H) / 2, wr = P.wb[0], wg = P.wb[1], wb = P.wb[2];
  const L0 = new Float32Array(n);
  const colE = new Float32Array(W); for(let x = 0; x < W; x++){ const d = (x + 0.5 - W / 2) / half; colE[x] = d * d; }
  for(let y = a0; y < a1; y++){
    const dy = (y + 0.5 - H / 2) / half, ey = dy * dy;
    for(let x = 0; x < W; x++){
      const i = (y - a0) * W + x;
      let lg = 1;
      if(P.lensVignette){ const e = Math.min(1, colE[x] + ey); lg = Math.exp(P.lensVignette * e * e * 0.8 * Math.LN2); }
      const r = rgb0[i*3] *= wr * lg, g = rgb0[i*3+1] *= wg * lg, b = rgb0[i*3+2] *= wb * lg;
      L0[i] = Math.log2(Math.max(RY * r + GY * g + BY * b, 1e-6));
    }
  }
  // Filtro guiado fino (r = 2) y medias 3×3 / 5×5 de log2 Y (sólo lo que se use)
  let m5 = null, cf = null, m3 = null;
  if(P.noise > 0 || P.texture){
    const L2 = new Float32Array(n * 2); for(let i = 0; i < n; i++){ const l = L0[i]; L2[i*2] = l; L2[i*2+1] = l * l; }
    m5 = box(L2, W, rows, 2, R_FINE);
    if(P.noise > 0){
      const coef = new Float32Array(n * 2);
      for(let i = 0; i < n; i++){ const m = m5[i*2], v = Math.max(0, m5[i*2+1] - m * m), a = v / (v + P.epsFine); coef[i*2] = a; coef[i*2+1] = m * (1 - a); }
      cf = box(coef, W, rows, 2, R_FINE);
    }
  }
  if(P.sharpen) m3 = box(L0, W, rows, 1, 1);

  // Muestreo bilineal de los mapas: índices por columna, precalculados
  const { mw, mh } = maps, MA = maps.A, MB = maps.B;
  const cx0 = new Int32Array(W), cx1 = new Int32Array(W), ctx = new Float32Array(W);
  for(let x = 0; x < W; x++){ const u = Math.max(0, Math.min(mw - 1, (x + 0.5) * mw / W - 0.5)), f = Math.floor(u); cx0[x] = f; cx1[x] = Math.min(mw - 1, f + 1); ctx[x] = u - f; }
  const local = P.shadows || P.highlights || P.clarity || P.texture || P.sharpen;
  const colorOps = P.saturation !== 1 || P.vibrance || P.hue;
  const out = new Float32Array((y1 - y0) * W * 3);
  const E = Math.log2(P.exposure), c = P.contrast, LN2 = Math.LN2, WS = P.white;
  const cosH = Math.cos(P.hue), sinH = Math.sin(P.hue);
  const T = REC2020_TO_SRGB;
  for(let y = y0; y < y1; y++){
    const v = Math.max(0, Math.min(mh - 1, (y + 0.5) * mh / H - 0.5)), ry0 = Math.floor(v), ry1 = Math.min(mh - 1, ry0 + 1), ty = v - ry0;
    const dy = (y + 0.5 - H / 2) / half, ey = dy * dy;
    for(let x = 0; x < W; x++){
      const i = (y - a0) * W + x, o = ((y - y0) * W + x) * 3;
      const k00 = (ry0 * mw + cx0[x]) * 4, k01 = (ry0 * mw + cx1[x]) * 4, k10 = (ry1 * mw + cx0[x]) * 4, k11 = (ry1 * mw + cx1[x]) * 4;
      const tx = ctx[x], w00 = (1 - tx) * (1 - ty), w01 = tx * (1 - ty), w10 = (1 - tx) * ty, w11 = tx * ty;
      let r = rgb0[i*3], g = rgb0[i*3+1], b = rgb0[i*3+2];
      const l0 = L0[i];
      // 1-2. ruido de luminosidad y de color
      let Ld = l0;
      if(P.noise > 0) Ld = l0 + (cf[i*2] * l0 + cf[i*2+1] - l0) * P.noise;
      if(P.noise > 0 || P.colorNoise > 0){
        const Y0 = RY * r + GY * g + BY * b;
        let cr = Y0 > 1e-6 ? Math.min(16, Math.max(0, r / Y0)) : 1, cb = Y0 > 1e-6 ? Math.min(16, Math.max(0, b / Y0)) : 1;
        if(P.colorNoise > 0){
          const ac = MB[k00] * w00 + MB[k01] * w01 + MB[k10] * w10 + MB[k11] * w11, bc = MB[k00+1] * w00 + MB[k01+1] * w01 + MB[k10+1] * w10 + MB[k11+1] * w11;
          const ab = MB[k00+2] * w00 + MB[k01+2] * w01 + MB[k10+2] * w10 + MB[k11+2] * w11, bb = MB[k00+3] * w00 + MB[k01+3] * w01 + MB[k10+3] * w10 + MB[k11+3] * w11;
          cr += (ac * cr + bc - cr) * P.colorNoise; cb += (ab * cb + bb - cb) * P.colorNoise;
        }
        const Y1 = Math.exp(Ld * LN2); r = cr * Y1; b = cb * Y1; g = Math.max(0, (Y1 - RY * r - BY * b) / GY);
      }
      // 3. exposición
      r *= P.exposure; g *= P.exposure; b *= P.exposure;
      const L = Ld + E;
      if(sceneOnly){ out[o] = r; out[o+1] = g; out[o+2] = b; continue; }
      // 4. neblina
      if(P.dehaze > 0){
        const h0 = Math.max(0, Math.min(rgb0[i*3], rgb0[i*3+1], rgb0[i*3+2]));
        const ah = MA[k00+2] * w00 + MA[k01+2] * w01 + MA[k10+2] * w10 + MA[k11+2] * w11, bh = MA[k00+3] * w00 + MA[k01+3] * w01 + MA[k10+3] * w10 + MA[k11+3] * w11;
        const Hz = Math.max(0, ah * h0 + bh) * P.exposure, k = 0.85 * P.dehaze, t = 1 / (1 - k * Math.min(Hz, 0.8));
        r = Math.max(0, r - k * Hz) * t; g = Math.max(0, g - k * Hz) * t; b = Math.max(0, b - k * Hz) * t;
      } else if(P.dehaze < 0){
        const vv = -P.dehaze * 0.5; r = r * (1 - vv) + vv * 0.3; g = g * (1 - vv) + vv * 0.3; b = b * (1 - vv) + vv * 0.3;
      }
      // 5. tono local sobre la base del filtro guiado
      if(local){
        const Lh = P.dehaze ? Math.log2(Math.max(RY * r + GY * g + BY * b, 1e-6)) : L;
        const ac = MA[k00] * w00 + MA[k01] * w01 + MA[k10] * w10 + MA[k11] * w11, bc = MA[k00+1] * w00 + MA[k01+1] * w01 + MA[k10+1] * w10 + MA[k11+1] * w11;
        let Bs = ac * l0 + bc + E + (Lh - L), D = Lh - Bs;
        if(P.shadows) Bs += P.shadows * 1.6 * (1 - smooth(MID - 6, MID + 0.5, Bs));
        if(P.highlights) Bs += P.highlights * 1.6 * smooth(MID - 1, MID + 4.5, Bs);
        if(P.clarity){ const e = D * P.clarity * 0.9; D += e / (1 + Math.abs(e) * 0.8); }
        if(P.texture){ const e = (l0 - m5[i*2]) * (1 - 0.6 * P.noise) * P.texture * 0.8; D += e / (1 + Math.abs(e) * 2); }
        if(P.sharpen){ const F = l0 - m3[i], th = 0.012 + 0.05 * P.noise, s = Math.sign(F) * Math.max(0, Math.abs(F) - th) * P.sharpen * 1.8; D += Math.max(-0.35, Math.min(0.35, s)); }
        const f = Math.exp((Bs + D - Lh) * LN2); r *= f; g *= f; b *= f;
      }
      // 6. curva fílmica escena → pantalla (sobre la luminancia)
      const Ys = RY * r + GY * g + BY * b;
      if(Ys > 0){
        // Blancos desplazan sólo el hombro: L = softclip(lin − w) + w
        const lin = MID + c * Math.log2(Ys / 0.18) - WS, z = -SHOULDER * lin;
        let yd = Math.min(1, Math.exp(((z > 30 ? lin : -Math.log1p(Math.exp(z)) / SHOULDER) + WS) * LN2));
        if(P.blacks){ const q = 1 - Math.min(1, yd), q2 = q * q; yd = Math.max(0, yd + P.blacks * q2 * q2 * q2); }
        const q = yd / Ys; r *= q; g *= q; b *= q;
      } else { r = g = b = Math.max(0, P.blacks); }
      // 7. color: en OKLab sólo si hace falta (ajustes de color o fuera de gama)
      let sr = T[0][0] * r + T[0][1] * g + T[0][2] * b, sg = T[1][0] * r + T[1][1] * g + T[1][2] * b, sb = T[2][0] * r + T[2][1] * g + T[2][2] * b;
      if(colorOps || sr < 0 || sg < 0 || sb < 0 || sr > 1 || sg > 1 || sb > 1){
        toLab(r, g, b);
        let A = _lab[1], Bb = _lab[2];
        if(P.hue){ const a2 = A * cosH - Bb * sinH; Bb = A * sinH + Bb * cosH; A = a2; }
        if(P.saturation !== 1 || P.vibrance){
          const C = Math.hypot(A, Bb), sc = P.saturation * (1 + P.vibrance * 0.8 * (1 - smooth(0, 0.18, C)));
          A *= sc; Bb *= sc;
        }
        gamutMapLab(_lab[0], A, Bb); sr = _rgb[0]; sg = _rgb[1]; sb = _rgb[2];
      }
      // 8. viñeteado creativo
      if(P.vignette){ const e = Math.min(1, colE[x] + ey), vg = Math.exp(-P.vignette * e * e * 0.8 * LN2); sr *= vg; sg *= vg; sb *= vg; }
      out[o] = sr; out[o+1] = sg; out[o+2] = sb;
    }
  }
  return out;
}

/* Reduce (media por área, en luz lineal) las filas de origen
   [srcY0, srcY0+rows) de ancho W a las filas de salida [d0, d1) de
   ancho ow, con escala vertical s = alto de salida / alto de origen.
   Cada píxel de origen cuenta en el de salida que contiene su centro. */
export function downscale(lin, W, srcY0, rows, ow, d0, d1, s){
  const orows = d1 - d0, acc = new Float64Array(ow * orows * 4);
  const jx = new Int32Array(W); for(let x = 0; x < W; x++) jx[x] = Math.min(ow - 1, Math.floor((x + 0.5) * ow / W));
  for(let y = 0; y < rows; y++){
    const oy = Math.floor((srcY0 + y + 0.5) * s) - d0;
    if(oy < 0 || oy >= orows) continue;
    for(let x = 0; x < W; x++){ const k = (oy * ow + jx[x]) * 4, i = (y * W + x) * 3; acc[k] += lin[i]; acc[k+1] += lin[i+1]; acc[k+2] += lin[i+2]; acc[k+3]++; }
  }
  const out = new Float32Array(ow * orows * 3);
  for(let i = 0; i < ow * orows; i++){ const n = acc[i*4+3] || 1; out[i*3] = acc[i*4] / n; out[i*3+1] = acc[i*4+1] / n; out[i*3+2] = acc[i*4+2] / n; }
  return out;
}
/* Filas de origen que caen en las filas de salida [d0, d1). */
export const sourceRowsFor = (d0, d1, s, H) => [Math.max(0, Math.ceil(d0 / s - 0.5)), Math.min(H, Math.ceil(d1 / s - 0.5))];

/* Codifica sRGB lineal de pantalla a 8 bits (grano + tramado) o a 16. */
export function encode8(lin, w, rows, oy0, grain){
  encTable();
  const out = new Uint8ClampedArray(w * rows * 4);
  for(let y = 0; y < rows; y++) for(let x = 0; x < w; x++){
    const i = (y * w + x) * 3, o = (y * w + x) * 4, gy = oy0 + y;
    const l = Math.min(1, 0.2126 * lin[i] + 0.7152 * lin[i+1] + 0.0722 * lin[i+2]);
    const n = grain ? grainAt(x, gy) * grain * 0.035 * (1 - l * l) : 0;
    for(let c = 0; c < 3; c++) out[o + c] = (encode(lin[i + c]) + n) * 255 + ditherAt(x, gy, c);
    out[o + 3] = 255;
  }
  return out;
}
export function encode16(lin, w, rows, oy0, grain){
  encTable();
  const out = new Uint16Array(w * rows * 3);
  for(let y = 0; y < rows; y++) for(let x = 0; x < w; x++){
    const i = (y * w + x) * 3, gy = oy0 + y;
    const l = Math.min(1, 0.2126 * lin[i] + 0.7152 * lin[i+1] + 0.0722 * lin[i+2]);
    const n = grain ? grainAt(x, gy) * grain * 0.035 * (1 - l * l) : 0;
    for(let c = 0; c < 3; c++) out[i + c] = Math.round(Math.max(0, Math.min(1, encode(lin[i + c]) + n)) * 65535);
  }
  return out;
}
