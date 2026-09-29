/* ═══════════════════════════════════════════════════════════════
   HDR · MOTOR PREMIUM
   Funciones puras (sin DOM), para el worker. Se activan con el
   interruptor de la corona; el HDR de siempre (engine.js) no cambia.

   Todo en coma flotante, luz lineal y Rec.2020:
     1. Radiancia exacta de cada foto:
        · RAW revelados en lineal (Premium activo al añadirlos): los
          datos del sensor, sin curva que adivinar.
        · JPEG/HEIC/PNG…: curva de respuesta de la cámara estimada del
          propio horquillado (Robertson, 1999), por canal. Se
          compara con la curva sRGB que usa el HDR de siempre y se queda
          la que mejor hace casar las fotos entre sí.
     2. Fusión de máxima verosimilitud: cada foto pesa t² / varianza,
        con la varianza de su ruido (lectura y fotones en RAW; en 8 bits,
        la pendiente de la curva por nivel más el ruido): las tomas
        largas pesan más, las zonas comprimidas por la curva menos, y lo
        quemado o casi negro nada. Es un apilado: con varias tomas
        buenas del mismo punto, el ruido se promedia.
     3. Alineación con fracción de píxel (muestreo bilineal).
     4. Antifantasmas por zonas: lo que se mueve se detecta a baja
        resolución comparando cada foto con la de referencia, se suaviza
        y se ensancha un poco, y se usa como máscara de pesos (sin el
        moteado de la decisión píxel a píxel).
     5. Mapeo tonal: los mismos métodos, pero su salida conserva las
        proporciones RGB (engine.js › emit); `finishPremium` hace tono,
        color y nitidez en OKLab, ajusta la gama a sRGB reduciendo sólo
        el croma y tramado al pasar a 8 bits (o 16 bits sin tramado).
   ═══════════════════════════════════════════════════════════════ */

const S2W = [[0.6274040, 0.3292820, 0.0433136], [0.0690970, 0.9195400, 0.0113612], [0.0163916, 0.0880132, 0.8955950]];
const W2S = [[1.6604910, -0.5876411, -0.0728499], [-0.1245505, 1.1328999, -0.0083494], [-0.0181508, -0.1005789, 1.1187297]];
const Y2020 = [0.2627, 0.6780, 0.0593];
export const LIN_SCALE = 16384;               // RAW lineal en Uint16: valor × 16384 (hasta 4,0)
const TO_LIN = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; TO_LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
const smooth = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };

/* ── 1. Curva de respuesta (Robertson, Borman y Stevenson, 1999) ──
   imgs: RGBA 8 bits reducidos y del mismo tamaño; shifts en esa escala.
   Estimación iterativa con TODOS los píxeles (no unas muestras, como
   Debevec y Malik): se alterna irradiancia de cada punto ↔ valor medio
   de cada nivel de la curva. Devuelve { curves: [Float32Array(256)×3]
   (valor lineal por nivel), kind: "estimada" | "srgb" }: se queda la
   que mejor hace casar las fotos entre sí. */
export function responseCurves(imgs, evs, shifts){
  const srgb = { curves: [TO_LIN, TO_LIN, TO_LIN], kind: "srgb" };
  const n = imgs.length;
  if(n < 2 || Math.max(...evs) - Math.min(...evs) < 0.9) return srgb;
  const { w, h } = imgs[0], t = evs.map(e => Math.pow(2, e - Math.min(...evs)));
  const sx = shifts.map(s => Math.round(s.fdx ?? s.dx)), sy = shifts.map(s => Math.round(s.fdy ?? s.dy));
  // Puntos presentes en todas las fotos (una rejilla, para no pasar de ~150 000)
  const step = Math.max(1, Math.round(Math.sqrt(w * h / 150000))), pts = [];
  for(let y = 1; y < h - 1; y += step) for(let x = 1; x < w - 1; x += step){
    let ok = true; for(let i = 0; i < n && ok; i++){ const X = x + sx[i], Y = y + sy[i]; if(X < 0 || Y < 0 || X >= w || Y >= h) ok = false; }
    if(ok) pts.push(y * w + x);
  }
  if(pts.length < 500) return srgb;
  const P = pts.length, Z = new Uint8Array(P * n);
  const wz = Float64Array.from({ length: 256 }, (_, z) => z < 3 || z > 251 ? 0 : Math.exp(-4 * ((z - 127.5) / 127.5) ** 2));
  const curves = [], polys = [];
  for(let c = 0; c < 3; c++){
    for(let p = 0; p < P; p++){ const y = (pts[p] / w) | 0, x = pts[p] - y * w; for(let i = 0; i < n; i++) Z[p * n + i] = imgs[i].data[((y + sy[i]) * w + x + sx[i]) * 4 + c]; }
    const g = Float64Array.from(TO_LIN), E = new Float64Array(P), sum = new Float64Array(256), cnt = new Float64Array(256);
    for(let it = 0; it < 12; it++){
      for(let p = 0; p < P; p++){
        let a = 0, b = 0;
        for(let i = 0; i < n; i++){ const z = Z[p * n + i], wv = wz[z]; a += wv * g[z] * t[i]; b += wv * t[i] * t[i]; }
        E[p] = b > 0 ? a / b : 0;
      }
      sum.fill(0); cnt.fill(0);
      for(let p = 0; p < P; p++){ if(!E[p]) continue; for(let i = 0; i < n; i++){ const z = Z[p * n + i]; sum[z] += E[p] * t[i]; cnt[z]++; } }
      for(let z = 0; z < 256; z++) if(cnt[z] > 3) g[z] = sum[z] / cnt[z];
      const k = TO_LIN[128] / g[128]; for(let z = 0; z < 256; z++) g[z] *= k;       // escala: 128 → sRGB(128)
    }
    // Pocos niveles con datos (escena casi plana): no hay curva que
    // estimar con garantías; se queda la sRGB.
    let covered = 0, zlo = 255, zhi = 0;
    for(let z = 0; z < 256; z++) if(cnt[z] > 3){ covered++; zlo = Math.min(zlo, z); zhi = Math.max(zhi, z); }
    if(covered < 64 || zhi - zlo < 150) return srgb;
    // Niveles sin datos: interpolados; monótona; suavizado leve
    let last = -1;
    for(let z = 0; z < 256; z++){
      if(cnt[z] > 3 || z === 128){
        if(last >= 0 && z - last > 1) for(let q = last + 1; q < z; q++) g[q] = g[last] + (g[z] - g[last]) * (q - last) / (z - last);
        last = z;
      }
    }
    const first = [...cnt].findIndex(v => v > 3);
    for(let z = 0; z < Math.max(0, first); z++) g[z] = g[first] * z / Math.max(1, first);
    for(let z = last + 1; z < 256; z++) g[z] = g[last] + (g[last] - g[Math.max(0, last - 8)]) / 8 * (z - last);
    // Polinomio de grado 5 (Mitsunaga y Nayar, 1999) ajustado a la curva
    // de Robertson con el peso de los datos de cada nivel: una curva real
    // es suave, y así desaparece la ondulación que dejan los pasos del
    // horquillado (la consistencia entre fotos no la ve).
    // (el ajuste se hace sobre g^(1/2,2), casi recta en z: todos los
    // niveles pesan lo mismo, no sólo las luces)
    const tidy = c => { for(let z = 1; z < 256; z++) c[z] = Math.max(c[z], c[z - 1] + 1e-7); c[0] = 0; const k = TO_LIN[128] / c[128]; for(let z = 0; z < 256; z++) c[z] *= k; return c; };
    polys.push(tidy(polyFit(Float64Array.from(g, v => Math.pow(Math.max(0, v), 1 / 2.2)), cnt, 6).map(v => Math.pow(v, 2.2))));
    curves.push(tidy(Float32Array.from(g, (v, z) => z === 0 || z === 255 ? v : (g[z - 1] + 2 * v + g[z + 1]) / 4)));
  }
  // Consistencia entre fotos: varianza del log de la irradiancia estimada
  const errOf = cv => {
    let e = 0, m = 0;
    for(let p = 0; p < P; p += 3){
      const y = (pts[p] / w) | 0, x = pts[p] - y * w, vals = [];
      for(let i = 0; i < n; i++){ const z = imgs[i].data[((y + sy[i]) * w + x + sx[i]) * 4 + 1]; if(z > 12 && z < 243) vals.push(Math.log(cv[1][z] / t[i])); }
      if(vals.length < 2) continue;
      const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
      for(const v of vals){ e += (v - mu) ** 2; m++; }
    }
    return m ? e / m : Infinity;
  };
  /* Tres candidatas. La consistencia entre fotos no ve una ondulación
     periódica de la curva (con pasos de horquillado iguales es
     invisible), así que se prefiere la polinómica —suave por
     construcción— salvo que case claramente peor que la de Robertson. */
  const eRob = errOf(curves), ePoly = errOf(polys), eSrgb = errOf(srgb.curves);
  const best = ePoly <= eRob * 1.5 + 0.002 ? { curves: polys, err: ePoly } : { curves, err: eRob };
  return best.err < eSrgb * 0.9 ? { ...best, kind: "estimada", errSrgb: eSrgb, errRob: eRob, errPoly: ePoly } : { ...srgb, err: eSrgb, errRob: eRob, errPoly: ePoly };
}

function polyFit(g, cnt, deg){
  const m = deg + 1, A = new Float64Array(m * m), b = new Float64Array(m);
  for(let z = 0; z < 256; z++){
    const wv = Math.sqrt(cnt[z] + 1) * (z < 4 || z > 251 ? 0.1 : 1), x = z / 255, pw = [1];
    for(let k = 1; k < m; k++) pw.push(pw[k - 1] * x);
    for(let i = 0; i < m; i++){ b[i] += wv * pw[i] * g[z]; for(let j = 0; j < m; j++) A[i * m + j] += wv * pw[i] * pw[j]; }
  }
  // Gauss con pivote
  for(let c = 0; c < m; c++){
    let pv = c; for(let r = c + 1; r < m; r++) if(Math.abs(A[r * m + c]) > Math.abs(A[pv * m + c])) pv = r;
    for(let j = 0; j < m; j++){ const t = A[c * m + j]; A[c * m + j] = A[pv * m + j]; A[pv * m + j] = t; }
    { const t = b[c]; b[c] = b[pv]; b[pv] = t; }
    for(let r = c + 1; r < m; r++){ const f = A[r * m + c] / A[c * m + c]; for(let j = c; j < m; j++) A[r * m + j] -= f * A[c * m + j]; b[r] -= f * b[c]; }
  }
  const x = new Float64Array(m);
  for(let i = m - 1; i >= 0; i--){ let t = b[i]; for(let j = i + 1; j < m; j++) t -= A[i * m + j] * x[j]; x[i] = t / A[i * m + i]; }
  return Float32Array.from({ length: 256 }, (_, z) => { let v = 0, p = 1; for(let k = 0; k < m; k++){ v += x[k] * p; p *= z / 255; } return Math.max(0, v); });
}

/* ── lectura bilineal de una foto en luz lineal Rec.2020 ──────── */
function makeReader(img, curves){
  const { w, h } = img;
  if(img.lin){
    const L = img.lin, clip = img.clip || [4, 4, 4];
    return (fx, fy, out) => {
      fx = Math.max(0, Math.min(w - 1, fx)); fy = Math.max(0, Math.min(h - 1, fy));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
      let sat = 0;
      for(let c = 0; c < 3; c++){
        const a = L[(y0 * w + x0) * 3 + c], b = L[(y0 * w + x1) * 3 + c], d = L[(y1 * w + x0) * 3 + c], e = L[(y1 * w + x1) * 3 + c];
        const v = ((a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty) / LIN_SCALE;
        out[c] = v; sat = Math.max(sat, Math.max(a, b, d, e) / LIN_SCALE / clip[c]);
      }
      out[3] = sat;                                   // 1 = recorte del sensor
      // Varianza (en unidades de la foto): ruido de lectura + de fotones
      out[4] = 4e-8 + 2e-5 * Math.max(0, (Y2020[0] * out[0] + Y2020[1] * out[1] + Y2020[2] * out[2]));
    };
  }
  const D = img.data, [cr, cg, cb] = curves;
  // Pendiente de la curva por nivel: un nivel de 8 bits (más ~1 de ruido)
  // equivale a g'(z) en luz lineal. Con eso sale la varianza de cada foto.
  const slope = curves.map(g => Float32Array.from({ length: 256 }, (_, z) => (g[Math.min(255, z + 1)] - g[Math.max(0, z - 1)]) / (z === 0 || z === 255 ? 1 : 2)));
  return (fx, fy, out) => {
    fx = Math.max(0, Math.min(w - 1, fx)); fy = Math.max(0, Math.min(h - 1, fy));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const p00 = (y0 * w + x0) * 4, p01 = (y0 * w + x1) * 4, p10 = (y1 * w + x0) * 4, p11 = (y1 * w + x1) * 4;
    const w00 = (1 - tx) * (1 - ty), w01 = tx * (1 - ty), w10 = (1 - tx) * ty, w11 = tx * ty;
    const R = cr[D[p00]] * w00 + cr[D[p01]] * w01 + cr[D[p10]] * w10 + cr[D[p11]] * w11;
    const G = cg[D[p00 + 1]] * w00 + cg[D[p01 + 1]] * w01 + cg[D[p10 + 1]] * w10 + cg[D[p11 + 1]] * w11;
    const B = cb[D[p00 + 2]] * w00 + cb[D[p01 + 2]] * w01 + cb[D[p10 + 2]] * w10 + cb[D[p11 + 2]] * w11;
    out[0] = S2W[0][0] * R + S2W[0][1] * G + S2W[0][2] * B;
    out[1] = S2W[1][0] * R + S2W[1][1] * G + S2W[1][2] * B;
    out[2] = S2W[2][0] * R + S2W[2][1] * G + S2W[2][2] * B;
    let zmax = 0, zmin = 255;
    for(const p of [p00, p01, p10, p11]) for(let c = 0; c < 3; c++){ const z = D[p + c]; if(z > zmax) zmax = z; if(z < zmin) zmin = z; }
    out[3] = zmax / 250;                              // ≥ 1: quemado
    const zr = D[p00], zg = D[p00 + 1], zb = D[p00 + 2];
    const v = ((slope[0][zr] ** 2) * 0.2627 + (slope[1][zg] ** 2) * 0.678 + (slope[2][zb] ** 2) * 0.0593) * (1 / 12 + 1);
    // Casi negro: el nivel 0 esconde todo lo que hay por debajo.
    out[4] = zmax < 3 ? Infinity : v / Math.max(0.05, smooth(2, 12, zmax)) + 1e-12;
  };
}

/* ── 2-4. Fusión ─────────────────────────────────────────────────
   imgs: fotos del mismo tamaño ({w,h,data} y, si son RAW lineales,
   lin/clip); evs; shifts con fdx/fdy (esta escala); rect de salida. */
export function mergePremium(imgs, evs, shifts, rect, { deghost = 0, ref = -1, curves } = {}){
  const n = imgs.length, W = rect.w, H = rect.h, out = new Float32Array(W * H * 3);
  const minEv = Math.min(...evs), t = evs.map(e => Math.pow(2, e - minEv));
  if(ref < 0 || ref >= n){ const so = evs.map((e, i) => [e, i]).sort((a, b) => a[0] - b[0]); ref = so[(so.length - 1) >> 1][1]; }
  const readers = imgs.map(im => makeReader(im, curves));
  const sx = shifts.map(s => s.fdx ?? s.dx), sy = shifts.map(s => s.fdy ?? s.dy);
  const darkest = evs.indexOf(minEv), brightest = evs.indexOf(Math.max(...evs));
  const px = new Float64Array(5), val = new Float64Array(n * 3), wt = new Float64Array(n);
  /* Peso de máxima verosimilitud: t² / varianza (la radiancia es
     valor / t, así que su varianza es varianza / t²), por el recorte. */
  const weightOf = i => px[3] >= 0.98 ? 0 : (1 - smooth(0.85, 0.98, px[3])) * t[i] * t[i] / px[4];
  // Antifantasmas por zonas (máscara a baja resolución)
  let mask = null, mw = 0, mh = 0;
  const thr = [0, 1.0, 0.6, 0.35][deghost] || 0;
  if(thr && n > 1){
    const k = Math.min(1, 256 / Math.max(W, H)); mw = Math.max(2, Math.round(W * k)); mh = Math.max(2, Math.round(H * k));
    const raw = new Float32Array(n * mw * mh);
    for(let y = 0; y < mh; y++) for(let x = 0; x < mw; x++){
      const fx = rect.x + (x + 0.5) / k - 0.5, fy = rect.y + (y + 0.5) / k - 0.5;
      readers[ref](fx + sx[ref], fy + sy[ref], px);
      // Diferencia canal a canal (en log2 y a exposición igualada): un
      // objeto que se mueve puede tener la misma luminancia que el fondo
      // y otro color (un coche rojo sobre asfalto gris).
      const okRef = px[3] < 0.97 && Number.isFinite(px[4]);
      const lr = [0, 1, 2].map(c => Math.log2(Math.max(1e-6, px[c]) / t[ref])), vr = [px[0], px[1], px[2]];
      for(let i = 0; i < n; i++){
        if(i === ref || !okRef){ raw[i * mw * mh + y * mw + x] = 0; continue; }
        readers[i](fx + sx[i], fy + sy[i], px);
        const ok = px[3] < 0.97 && Number.isFinite(px[4]);
        let d = 0;
        // (sólo canales con señal en las dos: en lo muy oscuro el ruido
        // parecería movimiento)
        if(ok) for(let c = 0; c < 3; c++) if(px[c] > 0.004 && vr[c] > 0.004) d = Math.max(d, Math.abs(Math.log2(px[c] / t[i]) - lr[c]));
        raw[i * mw * mh + y * mw + x] = d;
      }
    }
    mask = new Float32Array(n * mw * mh);
    for(let i = 0; i < n; i++){
      const plane = raw.subarray(i * mw * mh, (i + 1) * mw * mh), m = mask.subarray(i * mw * mh, (i + 1) * mw * mh);
      const sm = box2(plane, mw, mh, 1);
      for(let p = 0; p < m.length; p++) m[p] = smooth(thr * 0.6, thr, sm[p]);
      const dil = max2(m, mw, mh, 2), bl = box2(dil, mw, mh, 1);
      m.set(bl);
    }
  }
  const maskAt = (i, x, y) => {
    const u = Math.max(0, Math.min(mw - 1, (x + 0.5) * mw / W - 0.5)), v = Math.max(0, Math.min(mh - 1, (y + 0.5) * mh / H - 0.5));
    const x0 = Math.floor(u), y0 = Math.floor(v), x1 = Math.min(mw - 1, x0 + 1), y1 = Math.min(mh - 1, y0 + 1), tx = u - x0, ty = v - y0, o = i * mw * mh;
    return (mask[o + y0 * mw + x0] * (1 - tx) + mask[o + y0 * mw + x1] * tx) * (1 - ty) + (mask[o + y1 * mw + x0] * (1 - tx) + mask[o + y1 * mw + x1] * tx) * ty;
  };
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    let sw = 0;
    for(let i = 0; i < n; i++){
      readers[i](rect.x + x + sx[i], rect.y + y + sy[i], px);
      const k = 1 / t[i];
      val[i * 3] = px[0] * k; val[i * 3 + 1] = px[1] * k; val[i * 3 + 2] = px[2] * k;
      let wi = weightOf(i);
      if(mask && i !== ref) wi *= 1 - maskAt(i, x, y);
      wt[i] = wi; sw += wi;
    }
    const o = (y * W + x) * 3;
    if(sw > 0 && Number.isFinite(sw)){
      let r = 0, g = 0, b = 0;
      for(let i = 0; i < n; i++){ const k = wt[i] / sw; r += val[i * 3] * k; g += val[i * 3 + 1] * k; b += val[i * 3 + 2] * k; }
      out[o] = Math.max(0, r); out[o + 1] = Math.max(0, g); out[o + 2] = Math.max(0, b);
    } else {
      // Nada fiable: quemado en todas → la más oscura; negro en todas → la más clara.
      readers[darkest](rect.x + x + sx[darkest], rect.y + y + sy[darkest], px);
      const pick = px[3] >= 0.9 ? darkest : brightest;
      readers[pick](rect.x + x + sx[pick], rect.y + y + sy[pick], px);
      const k = 1 / t[pick];
      out[o] = Math.max(0, px[0] * k); out[o + 1] = Math.max(0, px[1] * k); out[o + 2] = Math.max(0, px[2] * k);
    }
  }
  return { w: W, h: H, rad: out, space: "rec2020" };
}
function box2(src, w, h, r){
  const out = new Float32Array(src.length);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    let s = 0, n = 0;
    for(let j = -r; j <= r; j++) for(let i = -r; i <= r; i++){ const xx = x + i, yy = y + j; if(xx >= 0 && yy >= 0 && xx < w && yy < h){ s += src[yy * w + xx]; n++; } }
    out[y * w + x] = s / n;
  }
  return out;
}
function max2(src, w, h, r){
  const out = new Float32Array(src.length);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    let m = 0;
    for(let j = -r; j <= r; j++) for(let i = -r; i <= r; i++){ const xx = x + i, yy = y + j; if(xx >= 0 && yy >= 0 && xx < w && yy < h) m = Math.max(m, src[yy * w + xx]); }
    out[y * w + x] = m;
  }
  return out;
}

/* Salida de la fusión de exposición (Mertens), en sRGB codificado →
   luz lineal de pantalla Rec.2020, para pasar por el mismo acabado. */
export function linearFromDisplay(T){
  const { w, h, px } = T, n = w * h, lin = new Float32Array(n * 3);
  const dec = v => v <= 0.04045 ? v / 12.92 : Math.pow((Math.max(0, v) + 0.055) / 1.055, 2.4);
  for(let i = 0; i < n * 3; i += 3){
    const r = dec(px[i]), g = dec(px[i + 1]), b = dec(px[i + 2]);
    for(let c = 0; c < 3; c++) lin[i + c] = S2W[c][0] * r + S2W[c][1] * g + S2W[c][2] * b;
  }
  return { w, h, lin, sat: 1 };
}

/* ── 5. Acabado en OKLab ─────────────────────────────────────── */
const M1 = [[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]];
const M1_2020 = M1.map(row => [0, 1, 2].map(j => row[0] * W2S[0][j] + row[1] * W2S[1][j] + row[2] * W2S[2][j]));
const M2 = [[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]];
const M2I = [[1, 0.3963377774, 0.2158037573], [1, -0.1055613458, -0.0638541728], [1, -0.0894841775, -1.2914855480]];
const M1I = [[4.0767416621, -3.3077115913, 0.2309699292], [-1.2684380046, 2.6097574011, -0.3413193965], [-0.0041960863, -0.7034186147, 1.7076147010]];
const _o = new Float64Array(3);
function lab2srgb(L, a, b){
  let l = L + M2I[0][1] * a + M2I[0][2] * b; l = l * l * l;
  let m = L + M2I[1][1] * a + M2I[1][2] * b; m = m * m * m;
  let s = L + M2I[2][1] * a + M2I[2][2] * b; s = s * s * s;
  _o[0] = M1I[0][0] * l + M1I[0][1] * m + M1I[0][2] * s;
  _o[1] = M1I[1][0] * l + M1I[1][1] * m + M1I[1][2] * s;
  _o[2] = M1I[2][0] * l + M1I[2][1] * m + M1I[2][2] * s;
}
const inG = () => _o[0] >= -1e-7 && _o[1] >= -1e-7 && _o[2] >= -1e-7 && _o[0] <= 1 + 1e-7 && _o[1] <= 1 + 1e-7 && _o[2] <= 1 + 1e-7;
function gamut(L, a, b){
  if(L >= 1){ _o[0] = _o[1] = _o[2] = 1; return; }
  if(L <= 0){ _o[0] = _o[1] = _o[2] = 0; return; }
  lab2srgb(L, a, b); if(inG()) return;
  let lo = 0, hi = 1;
  for(let k = 0; k < 14; k++){ const q = (lo + hi) / 2; lab2srgb(L, a * q, b * q); if(inG()) lo = q; else hi = q; }
  lab2srgb(L, a * lo, b * lo);
  for(let c = 0; c < 3; c++) _o[c] = Math.max(0, Math.min(1, _o[c]));
}
const encS = v => v <= 0 ? 0 : v >= 1 ? 1 : v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
const dither = (x, y, c) => {
  let h = Math.imul(x * 3 + c + 0x2545f491, 0x9e3779b1) ^ Math.imul(y + 0x6a09e667, 0x85ebca77);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return ((h & 1023) + 0.5) / 1024 - 0.5;
};

/** T: { w, h, lin (pantalla lineal Rec.2020), sat } → 8 bits con tramado
    ({ w, h, data }) o, con bits = 16, { w, h, data16 } RGB. */
export function finishPremium(T, s, bits = 8){
  const { w, h, lin } = T, n = w * h;
  const bp = s.black / 100 * 0.25, wp = 1 - s.white / 100 * 0.25;
  const gam = Math.pow(2, -s.gamma / 100), con = s.contrast / 100, expo = Math.pow(2, s.exposure / 100 * 1.5);
  const sh = s.shadows / 100, hl = s.highlights / 100;
  const sat = (T.sat ?? 1) * (1 + s.saturation / 100), vib = s.vibrance / 100, satHi = s.satHi / 100, satLo = s.satLo / 100;
  const gr = Math.pow(2, s.temp / 100 * 0.35), gb = Math.pow(2, -s.temp / 100 * 0.35), gg = Math.pow(2, -s.tint / 100 * 0.2);
  // OKLab de toda la imagen (L para la nitidez)
  const Lab = new Float32Array(n * 3);
  for(let i = 0, j = 0; i < n; i++, j += 3){
    const r = Math.max(0, lin[j] * gr * expo), g = Math.max(0, lin[j + 1] * gg * expo), b = Math.max(0, lin[j + 2] * gb * expo);
    const l = Math.cbrt(M1_2020[0][0] * r + M1_2020[0][1] * g + M1_2020[0][2] * b);
    const m = Math.cbrt(M1_2020[1][0] * r + M1_2020[1][1] * g + M1_2020[1][2] * b);
    const q = Math.cbrt(M1_2020[2][0] * r + M1_2020[2][1] * g + M1_2020[2][2] * b);
    Lab[j] = M2[0][0] * l + M2[0][1] * m + M2[0][2] * q;
    Lab[j + 1] = M2[1][0] * l + M2[1][1] * m + M2[1][2] * q;
    Lab[j + 2] = M2[2][0] * l + M2[2][1] * m + M2[2][2] * q;
  }
  let sharpL = null;
  if(s.sharpen > 0){
    const L = new Float32Array(n); for(let i = 0; i < n; i++) L[i] = Lab[i * 3];
    const r = Math.max(1, Math.round(Math.min(w, h) / 1500)), bl = boxSep(L, w, h, r), k = s.sharpen / 100 * 1.2;
    sharpL = new Float32Array(n);
    for(let i = 0; i < n; i++){ const d = (L[i] - bl[i]) * k; sharpL[i] = d / (1 + Math.abs(d) * 12); }   // límite de halo
  }
  const out8 = bits === 8 ? new Uint8ClampedArray(n * 4) : null, out16 = bits === 16 ? new Uint16Array(n * 3) : null;
  for(let i = 0, j = 0; i < n; i++, j += 3){
    let L = Lab[j]; const L0 = L;
    if(sharpL) L += sharpL[i];
    L = (L - bp) / (wp - bp);
    let ny = Math.max(0, Math.min(1, L));
    if(gam !== 1) ny = Math.pow(ny, gam);
    if(sh) ny += sh * 0.35 * Math.pow(1 - ny, 3) * ny * 4;
    if(hl) ny -= hl * 0.35 * Math.pow(ny, 3) * (1 - ny) * 4;
    if(con) ny = Math.max(0, Math.min(1, ny + con * (ny - .5) * (1 - Math.abs(2 * ny - 1)) * 1.2));
    let a = Lab[j + 1], b = Lab[j + 2];
    // El croma acompaña a la luminosidad (se conserva la saturación aparente)
    const ratio = L0 > 1e-4 ? Math.min(4, ny / L0) : 1;
    const C = Math.hypot(a, b) * ratio;
    const k = ratio * sat * (1 + vib * 0.8 * (1 - smooth(0, 0.18, C))) * (1 + satHi * Math.max(0, ny - .5) * 2 + satLo * Math.max(0, .5 - ny) * 2);
    a *= k; b *= k;
    gamut(ny, a, b);
    const x = i % w, y = (i / w) | 0;
    if(out8){ const o = i * 4; for(let c = 0; c < 3; c++) out8[o + c] = encS(_o[c]) * 255 + dither(x, y, c); out8[o + 3] = 255; }
    else for(let c = 0; c < 3; c++) out16[j + c] = Math.round(encS(_o[c]) * 65535);
  }
  return out8 ? { w, h, data: out8 } : { w, h, data16: out16 };
}
function boxSep(src, w, h, r){
  const t = new Float32Array(src.length), o = new Float32Array(src.length);
  for(let y = 0; y < h; y++){ let s = 0, c = 0; for(let x = -r; x <= r; x++) if(x >= 0 && x < w){ s += src[y * w + x]; c++; }
    for(let x = 0; x < w; x++){ t[y * w + x] = s / c; const xo = x - r, xi = x + r + 1; if(xo >= 0){ s -= src[y * w + xo]; c--; } if(xi < w){ s += src[y * w + xi]; c++; } } }
  for(let x = 0; x < w; x++){ let s = 0, c = 0; for(let y = -r; y <= r; y++) if(y >= 0 && y < h){ s += t[y * w + x]; c++; }
    for(let y = 0; y < h; y++){ o[y * w + x] = s / c; const yo = y - r, yi = y + r + 1; if(yo >= 0){ s -= t[yo * w + x]; c--; } if(yi < h){ s += t[yi * w + x]; c++; } } }
  return o;
}

/* ── Radiance .hdr (RGBE, 32 bits por píxel) ─────────────────────
   El mapa de radiancia tal cual, para mapear el tono en otro programa.
   Primarios sRGB/Rec.709 (lo que esperan los lectores): los colores
   fuera de sRGB se recortan a 0 en el canal negativo. */
export function radianceHDR(R){
  const { w, h, rad } = R;
  const head = `#?RADIANCE\n# Realify · fusión HDR Premium\nFORMAT=32-bit_rle_rgbe\nEXPOSURE=1.0\n\n-Y ${h} +X ${w}\n`;
  const hb = new TextEncoder().encode(head), out = new Uint8Array(hb.length + w * h * 4);
  out.set(hb);
  let o = hb.length;
  for(let i = 0; i < w * h * 3; i += 3){
    const r0 = rad[i], g0 = rad[i + 1], b0 = rad[i + 2];
    const r = Math.max(0, W2S[0][0] * r0 + W2S[0][1] * g0 + W2S[0][2] * b0), g = Math.max(0, W2S[1][0] * r0 + W2S[1][1] * g0 + W2S[1][2] * b0), b = Math.max(0, W2S[2][0] * r0 + W2S[2][1] * g0 + W2S[2][2] * b0);
    const m = Math.max(r, g, b);
    if(m < 1e-32){ out[o++] = 0; out[o++] = 0; out[o++] = 0; out[o++] = 0; continue; }
    const e = Math.ceil(Math.log2(m) + 1e-9), f = 256 / Math.pow(2, e);
    out[o++] = Math.min(255, r * f); out[o++] = Math.min(255, g * f); out[o++] = Math.min(255, b * f); out[o++] = e + 128;
  }
  return out;
}

/* ── Reducción de una foto lineal (Uint16 RGB) ─────────────────── */
export function downscaleLin(img, maxSide){
  const { w, h, lin } = img, k = Math.min(1, maxSide / Math.max(w, h));
  if(k >= 1 || !lin) return lin;
  const W = Math.max(1, Math.round(w * k)), H = Math.max(1, Math.round(h * k)), out = new Uint16Array(W * H * 3), sx = w / W, sy = h / H;
  for(let y = 0; y < H; y++){
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for(let x = 0; x < W; x++){
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, c = 0;
      for(let yy = y0; yy < y1; yy++) for(let xx = x0; xx < x1; xx++){ const i = (yy * w + xx) * 3; r += lin[i]; g += lin[i + 1]; b += lin[i + 2]; c++; }
      const o = (y * W + x) * 3; out[o] = r / c + 0.5; out[o + 1] = g / c + 0.5; out[o + 2] = b / c + 0.5;
    }
  }
  return out;
}
