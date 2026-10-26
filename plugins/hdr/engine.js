/* ═══════════════════════════════════════════════════════════════
   HDR · MOTOR
   Funciones puras sobre píxeles (sin DOM): se usan desde el worker
   (plugins/hdr/worker.js) para la vista previa, las miniaturas y el resultado
   final a resolución completa.

   Canal de trabajo:
     1. Exposición relativa de cada foto (EXIF o estimada, ver
        `estimateEv`) → factor 2^EV.
     2. Alineación por desplazamiento con mapas de umbral mediano
        (Ward, «MTB»), robusta a la diferencia de exposición.
     3a. Mapa de radiancia (Debevec, curva sRGB conocida) con pesos en
         sombrero y ANTIFANTASMAS: lo que se mueve entre tomas (ramas,
         personas, agua) se toma sólo de la foto de referencia.
     3b. o Fusión de exposición (Mertens) directamente sobre las fotos.
     4. Mapeo tonal: Detalles realzados (local, base/detalle con filtro
        guiado, como el «Details Enhancer» de Photomatix), Compresor de
        tonos (Reinhard) o Fotográfico (logarítmico de Drago).
     5. Ajustes finales en espacio de pantalla (puntos negro/blanco,
        gamma, contraste, sombras, luces, saturación por zonas,
        temperatura, nitidez).
   ═══════════════════════════════════════════════════════════════ */

import { TO_LIN } from "./engine/common.js";
import { clamp01 } from "./engine/fusion.js";
export { ALIGN, alignGradient, alignShift, alignExposureThreshold, alignPair, alignAll } from "./engine/align.js";
export { fuseMertens } from "./engine/fusion.js";

for(let i = 0; i < 256; i++){ const v = i / 255; TO_LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }

const encode = v => { v = clamp01(v); return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };

/* Tabla para codificar deprisa (0-1 lineal → 0-1 sRGB) */
const ENC_N = 4096, ENC = new Float32Array(ENC_N + 1);

for(let i = 0; i <= ENC_N; i++) ENC[i] = encode(i / ENC_N);

const enc = v => v <= 0 ? 0 : v >= 1 ? 1 : ENC[(v * ENC_N) | 0];

/* ── Reducción de tamaño (caja) de una imagen RGBA 8 bits ── */
export function downscale(img, maxSide){
  const { w, h, data } = img;
  const k = Math.min(1, maxSide / Math.max(w, h));
  if(k >= 1) return img;
  const W = Math.max(1, Math.round(w * k)), H = Math.max(1, Math.round(h * k));
  const out = new Uint8ClampedArray(W * H * 4);
  const sx = w / W, sy = h / H;
  for(let y = 0; y < H; y++){
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for(let x = 0; x < W; x++){
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for(let yy = y0; yy < y1; yy++) for(let xx = x0; xx < x1; xx++){
        const i = (yy * w + xx) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3]; n++;
      }
      const o = (y * W + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
    }
  }
  return { w: W, h: H, data: out };
}

/* ── Exposición ──────────────────────────────────────────────── */
/** EV relativo de EXIF: más alto = más luz captada. null si falta algo. */
export function evFromExif(e){
  // Sin diafragma (objetivos manuales, algunos móviles) se da por fijo:
  // en un horquillado lo que cambia es el tiempo (o el ISO).
  if(!e || !(e.exposureTime > 0)) return null;
  const iso = e.iso > 0 ? e.iso : 100, f = e.fNumber > 0 ? e.fNumber : 1;
  return Math.log2(e.exposureTime * iso / 100 / (f * f));
}

/** EV relativo entre dos fotos alineadas: mediana de la razón de sus
    valores lineales donde ninguna está quemada ni en negro. */
export function evBetween(a, b){
  const n = Math.min(a.data.length, b.data.length), ratios = [];
  const step = Math.max(4, Math.floor(n / 4 / 60000) * 4);
  for(let i = 0; i < n; i += step){
    for(let c = 0; c < 3; c++){
      const va = a.data[i + c], vb = b.data[i + c];
      if(va > 12 && va < 235 && vb > 12 && vb < 235) ratios.push(TO_LIN[vb] / TO_LIN[va]);
    }
  }
  if(ratios.length < 50) return null;
  ratios.sort((x, y) => x - y);
  return Math.log2(ratios[ratios.length >> 1]);
}

const meanLum = img => { let s = 0, n = 0; const d = img.data; for(let i = 0; i < d.length; i += 16){ s += TO_LIN[d[i]] * .2126 + TO_LIN[d[i + 1]] * .7152 + TO_LIN[d[i + 2]] * .0722; n++; } return s / Math.max(1, n); };

/** EV estimado para cada foto (relativo a la primera), a partir de las
    imágenes (reducidas): se ordenan por brillo y se encadenan las
    razones entre vecinas, que es lo más fiable cuando los pasos del
    horquillado son grandes. */
export function estimateEvs(imgs){
  const order = imgs.map((img, i) => ({ i, m: meanLum(img) })).sort((a, b) => a.m - b.m).map(o => o.i);
  const ev = new Array(imgs.length).fill(0);
  for(let k = 1; k < order.length; k++){
    const a = imgs[order[k - 1]], b = imgs[order[k]];
    let d = evBetween(a, b);
    if(d === null || !Number.isFinite(d)) d = Math.log2(Math.max(1e-4, meanLum(b)) / Math.max(1e-4, meanLum(a)));
    ev[order[k]] = ev[order[k - 1]] + Math.max(0, d);
  }
  // Un horquillado casi siempre va a pasos iguales: si los saltos
  // estimados entre vecinas se parecen, se igualan (la curva de la
  // cámara hace que unos salgan algo más cortos que otros).
  if(order.length >= 3){
    const steps = order.slice(1).map((o, k) => ev[o] - ev[order[k]]);
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
    if(mean > 0.2 && steps.every(d => Math.abs(d - mean) <= Math.max(0.4, mean * 0.3))){
      const st = Math.round(mean * 3) / 3;
      order.forEach((o, k) => { ev[o] = ev[order[0]] + k * st; });
    }
  }
  const base = Math.min(...ev);
  return ev.map(v => Math.round((v - base) * 3) / 3);
}

/* Zona común a todas las fotos desplazadas (para recortar los bordes). */
export function commonRect(w, h, shifts){
  let x0 = 0, y0 = 0, x1 = w, y1 = h;
  for(const s of shifts){ x0 = Math.max(x0, -s.dx); y0 = Math.max(y0, -s.dy); x1 = Math.min(x1, w - s.dx); y1 = Math.min(y1, h - s.dy); }
  if(x1 - x0 < 8 || y1 - y0 < 8) return { x: 0, y: 0, w, h };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* ── Mapa de radiancia ───────────────────────────────────────── */
/** imgs: [{w,h,data}] del mismo tamaño; evs: EV relativo; shifts: [{dx,dy}]
    (en píxeles de ESTA escala); rect: zona de salida.
    deghost: 0 (no) … 3 (fuerte); ref: índice de la foto de referencia. */
export function mergeRadiance(imgs, evs, shifts, rect, { deghost = 0, ref = -1 } = {}){
  const n = imgs.length, { w } = imgs[0];
  const W = rect.w, H = rect.h, out = new Float32Array(W * H * 3);
  const minEv = Math.min(...evs);
  const expo = evs.map(e => Math.pow(2, e - minEv));   // la más oscura = 1
  const darkest = evs.indexOf(Math.min(...evs)), brightest = evs.indexOf(Math.max(...evs));
  if(ref < 0 || ref >= n){
    // Referencia: la de exposición intermedia
    const sorted = evs.map((e, i) => [e, i]).sort((a, b) => a[0] - b[0]);
    ref = sorted[(sorted.length - 1) >> 1][1];
  }
  const thr = [0, 1.6, 0.9, 0.45][deghost] || 0;
  const wgt = new Float32Array(n), lin = new Float32Array(n * 3), ok = new Uint8Array(n);
  for(let y = 0; y < H; y++){
    for(let x = 0; x < W; x++){
      let refL = -1;
      for(let i = 0; i < n; i++){
        const sx = rect.x + x + shifts[i].dx, sy = rect.y + y + shifts[i].dy;
        if(sx < 0 || sy < 0 || sx >= w || sy >= imgs[i].h){ ok[i] = 0; wgt[i] = 0; continue; }
        const d = imgs[i].data, p = (sy * w + sx) * 4;
        const r = d[p], g = d[p + 1], b = d[p + 2];
        const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
        // Sombrero: máximo en los medios tonos; casi nada si hay canal quemado o en negro.
        let wt = 1 - Math.pow(2 * (mx * .6 + mn * .4) - 1, 4);
        if(mx > .985) wt *= .001;
        if(mx < .015) wt *= .01;
        wgt[i] = Math.max(1e-6, wt); ok[i] = 1;
        const e = expo[i];
        lin[i * 3] = TO_LIN[r] / e; lin[i * 3 + 1] = TO_LIN[g] / e; lin[i * 3 + 2] = TO_LIN[b] / e;
        if(i === ref && mx < .985 && mx > .015) refL = lin[i * 3] * .2126 + lin[i * 3 + 1] * .7152 + lin[i * 3 + 2] * .0722;
      }
      if(thr && refL > 0){
        for(let i = 0; i < n; i++){
          if(!ok[i] || i === ref) continue;
          const L = lin[i * 3] * .2126 + lin[i * 3 + 1] * .7152 + lin[i * 3 + 2] * .0722;
          if(L > 0 && Math.abs(Math.log2(L / refL)) > thr) wgt[i] *= .002;
        }
      }
      let sr = 0, sg = 0, sb = 0, sw = 0;
      for(let i = 0; i < n; i++){ if(!ok[i]) continue; const k = wgt[i]; sr += lin[i * 3] * k; sg += lin[i * 3 + 1] * k; sb += lin[i * 3 + 2] * k; sw += k; }
      const o = (y * W + x) * 3;
      if(sw > 1e-4){ out[o] = sr / sw; out[o + 1] = sg / sw; out[o + 2] = sb / sw; }
      else {
        // Todo quemado (o todo negro): la más oscura (o la más clara).
        const pick = ok[darkest] && lin[darkest * 3 + 1] * expo[darkest] > .5 ? darkest : ok[brightest] ? brightest : ok.indexOf(1);
        if(pick >= 0){ out[o] = lin[pick * 3]; out[o + 1] = lin[pick * 3 + 1]; out[o + 2] = lin[pick * 3 + 2]; }
      }
    }
  }
  return { w: W, h: H, rad: out };
}

/* ── Filtros de apoyo ────────────────────────────────────────── */
/** Media en caja de radio r (dos pasadas, O(1) por píxel). */
function boxBlur(src, w, h, r){
  if(r < 1) return Float32Array.from(src);
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for(let y = 0; y < h; y++){
    const row = y * w; let acc = 0;
    for(let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for(let x = 0; x < w; x++){
      tmp[row + x] = acc / (2 * r + 1);
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for(let x = 0; x < w; x++){
    let acc = 0;
    for(let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for(let y = 0; y < h; y++){
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Filtro guiado (He et al.) con la propia imagen como guía: suaviza la
    iluminación sin cruzar los bordes fuertes → menos halos. */
function guided(I, w, h, r, eps){
  const n = w * h, II = new Float32Array(n);
  for(let i = 0; i < n; i++) II[i] = I[i] * I[i];
  const mI = boxBlur(I, w, h, r), mII = boxBlur(II, w, h, r);
  const a = new Float32Array(n), b = new Float32Array(n);
  for(let i = 0; i < n; i++){ const v = mII[i] - mI[i] * mI[i]; a[i] = v / (v + eps); b[i] = mI[i] - a[i] * mI[i]; }
  const ma = boxBlur(a, w, h, r), mb = boxBlur(b, w, h, r);
  const q = new Float32Array(n);
  for(let i = 0; i < n; i++) q[i] = ma[i] * I[i] + mb[i];
  return q;
}

function percentile(arr, p){
  const step = Math.max(1, Math.floor(arr.length / 50000)), s = [];
  for(let i = 0; i < arr.length; i += step) s.push(arr[i]);
  s.sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
}

/* ── Mapeo tonal ─────────────────────────────────────────────
   Todos devuelven Float32 RGB en espacio de pantalla (0-1, sRGB). */
function lumOf(rad, n, K = LUM709){ const Y = new Float32Array(n); for(let i = 0, j = 0; i < n; i++, j += 3) Y[i] = rad[j] * K[0] + rad[j + 1] * K[1] + rad[j + 2] * K[2] + 1e-7; return Y; }

const LUM709 = [.2126, .7152, .0722], LUM2020 = [.2627, .6780, .0593];

/* Salida de los tres métodos de radiancia. Modo de siempre: sRGB
   codificado, con la saturación como potencia por canal. Premium
   (R.space === "rec2020"): luz lineal de pantalla con las proporciones
   RGB intactas —el tono no se mueve—; la saturación y el paso a sRGB
   los hace premium.js › finishPremium en OKLab. */
function emit(R, Y, Ld, s){
  const { w, h, rad } = R, n = w * h, out = new Float32Array(n * 3);
  if(R.space === "rec2020"){
    for(let i = 0, j = 0; i < n; i++, j += 3){ const k = Ld(i) / Y[i]; out[j] = rad[j] * k; out[j + 1] = rad[j + 1] * k; out[j + 2] = rad[j + 2] * k; }
    return { w, h, lin: out, sat: s.sat / 100 };
  }
  const sat = s.sat / 100;
  for(let i = 0, j = 0; i < n; i++, j += 3){
    const Yd = Ld(i), y = Y[i];
    out[j] = enc(Yd * Math.pow(rad[j] / y, sat)); out[j + 1] = enc(Yd * Math.pow(rad[j + 1] / y, sat)); out[j + 2] = enc(Yd * Math.pow(rad[j + 2] / y, sat));
  }
  return { w, h, px: out };
}

const lumFor = R => R.space === "rec2020" ? LUM2020 : LUM709;

/** Detalles realzados (Photomatix «Details Enhancer»). */
export function tmDetails(R, s){
  const { w, h, rad } = R, n = w * h, Y = lumOf(rad, n, lumFor(R));
  const L = new Float32Array(n);
  for(let i = 0; i < n; i++) L[i] = Math.log2(Y[i]);
  // Suavizado de la iluminación: radio grande = natural, pequeño = pictórico/surrealista.
  const side = Math.min(w, h);
  const r = Math.max(2, Math.round(side * (0.006 + 0.07 * s.smooth / 100)));
  const eps = 0.05 + 1.2 * s.smooth / 100;
  const base = guided(L, w, h, r, eps);
  let detail = new Float32Array(n);
  for(let i = 0; i < n; i++) detail[i] = L[i] - base[i];
  // Microsuavizado: quita el grano del detalle ampliado.
  if(s.micro > 0){
    const bl = boxBlur(detail, w, h, Math.max(1, Math.round(side / 700)));
    const k = s.micro / 100;
    for(let i = 0; i < n; i++) detail[i] = detail[i] * (1 - k) + bl[i] * k;
  }
  const bHi = percentile(base, .995), bLo = percentile(base, .005);
  const range = Math.max(0.5, bHi - bLo);
  // Fuerza: cuánto se comprime el rango de la iluminación (en pasos).
  const target = range + (4.2 - range) * (s.strength / 100);
  const c = Math.min(1, target / range);
  const dBoost = 1 + (s.detail / 100) * 1.6;
  const lumShift = (s.luminosity / 100) * 1.6;
  const smoothHi = s.smoothHi / 100;
  return emit(R, Y, i => {
    let lo = (base[i] - bHi) * c + detail[i] * dBoost + lumShift - 0.15;
    // Suavizar luces: en las altas luces se atenúa el detalle ampliado.
    if(smoothHi > 0 && lo > -1.5){ const t = Math.min(1, (lo + 1.5) / 1.5) * smoothHi; lo = lo * (1 - t) + ((base[i] - bHi) * c + lumShift - 0.15) * t; }
    return Math.pow(2, lo);
  }, s);
}

/** Compresor de tonos (Reinhard global con punto blanco). */
export function tmCompressor(R, s){
  const { w, h, rad } = R, n = w * h, Y = lumOf(rad, n, lumFor(R));
  let lsum = 0; for(let i = 0; i < n; i++) lsum += Math.log(Y[i]);
  const Lavg = Math.exp(lsum / n);
  const a = 0.18 * Math.pow(2, s.brightness / 50);
  let Lmax = 0; const Ls = new Float32Array(n);
  for(let i = 0; i < n; i++){ Ls[i] = a / Lavg * Y[i]; if(Ls[i] > Lmax) Lmax = Ls[i]; }
  const Lw = Math.max(0.5, percentile(Ls, .999) * (0.35 + 1.3 * (s.whiteCmp / 100)));
  const Lw2 = Lw * Lw, gam = 1 + s.tcontrast / 100 * 0.8;
  return emit(R, Y, i => { const Ld = Ls[i] * (1 + Ls[i] / Lw2) / (1 + Ls[i]); return Math.pow(Math.min(1.5, Ld), gam); }, s);
}

/** Fotográfico (Drago, logarítmico adaptativo). */
export function tmDrago(R, s){
  const { w, h, rad } = R, n = w * h, Y = lumOf(rad, n, lumFor(R));
  let lsum = 0; for(let i = 0; i < n; i++) lsum += Math.log(Y[i]);
  const Lavg = Math.exp(lsum / n);
  const expo = Math.pow(2, s.brightness / 50) / Lavg * 0.18;
  const Lmax = percentile(Y, .999) * expo;
  const bias = 0.5 + 0.45 * (s.bias / 100);
  const lb = Math.log(bias) / Math.log(0.5), denom = Math.log10(Lmax + 1);
  return emit(R, Y, i => { const Lw = Y[i] * expo; return Math.log(Lw + 1) / Math.log(2 + 8 * Math.pow(Lw / Lmax, lb)) / denom; }, s);
}

/* Cuentagotas de punto blanco para finish(): temperatura y tinte que
   dejan neutro `rgb` (imagen mapeada, 0-1). Deshace exactamente
     r·(1+0,12a) = b·(1−0,12a)  →  a = (b−r) / (0,12·(r+b))
     g·(1−0,08k) = n = 2rb/(r+b) →  k = (1 − n/g) / 0,08
   El recorrido de estos mandos es corto (±12 %): `limited` avisa. */
export function wbNeutral(rgb){
  const r = Math.max(1e-4, rgb[0]), g = Math.max(1e-4, rgb[1]), b = Math.max(1e-4, rgb[2]);
  const a = (b - r) / (0.12 * (r + b)), n = 2 * r * b / (r + b), k = (1 - n / g) / 0.08;
  const c = v => Math.max(-100, Math.min(100, Math.round(v * 100)));
  return { temp: c(a), tint: c(k), limited: Math.abs(a) > 1.005 || Math.abs(k) > 1.005 };
}

/* ── Ajustes finales (espacio de pantalla) ───────────────────── */
export function finish(T, s){
  const { w, h, px } = T, n = w * h, out = new Uint8ClampedArray(n * 4);
  const bp = s.black / 100 * 0.25, wp = 1 - s.white / 100 * 0.25;
  const gam = Math.pow(2, -s.gamma / 100);          // gamma de medios tonos
  const con = s.contrast / 100, expo = Math.pow(2, s.exposure / 100);
  const sh = s.shadows / 100, hl = s.highlights / 100;
  const sat = 1 + s.saturation / 100, vib = s.vibrance / 100;
  const satHi = s.satHi / 100, satLo = s.satLo / 100;
  const tr = 1 + s.temp / 100 * 0.12, tb = 1 - s.temp / 100 * 0.12, tg = 1 - s.tint / 100 * 0.08;
  let src = px;
  // Nitidez final (máscara de enfoque sobre la luminancia)
  let sharpY = null;
  if(s.sharpen > 0){
    const Y = new Float32Array(n);
    for(let i = 0, j = 0; i < n; i++, j += 3) Y[i] = px[j] * .299 + px[j + 1] * .587 + px[j + 2] * .114;
    const b = boxBlur(Y, w, h, Math.max(1, Math.round(Math.min(w, h) / 1500)));
    sharpY = new Float32Array(n);
    const k = s.sharpen / 100 * 1.5;
    for(let i = 0; i < n; i++) sharpY[i] = (Y[i] - b[i]) * k;
  }
  for(let i = 0, j = 0, o = 0; i < n; i++, j += 3, o += 4){
    let r = src[j] * tr, g = src[j + 1] * tg, b = src[j + 2] * tb;
    if(expo !== 1){ r *= expo; g *= expo; b *= expo; }
    if(sharpY){ r += sharpY[i]; g += sharpY[i]; b += sharpY[i]; }
    // Puntos negro y blanco
    r = (r - bp) / (wp - bp); g = (g - bp) / (wp - bp); b = (b - bp) / (wp - bp);
    let y = r * .299 + g * .587 + b * .114;
    let ny = clamp01(y);
    if(gam !== 1) ny = Math.pow(ny, gam);
    if(sh) ny += sh * 0.35 * Math.pow(1 - ny, 3) * ny * 4;
    if(hl) ny -= hl * 0.35 * Math.pow(ny, 3) * (1 - ny) * 4;
    if(con) ny = clamp01(ny + con * (ny - .5) * (1 - Math.abs(2 * ny - 1)) * 1.2);
    const ratio = y > 1e-4 ? ny / y : 0;
    r = y > 1e-4 ? r * ratio : ny; g = y > 1e-4 ? g * ratio : ny; b = y > 1e-4 ? b * ratio : ny;
    // Saturación: global, vibración (más en lo poco saturado) y por zonas
    const m = r * .299 + g * .587 + b * .114;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), cs = mx > 1e-4 ? (mx - mn) / mx : 0;
    let k = sat * (1 + vib * (1 - cs)) * (1 + satHi * Math.max(0, m - .5) * 2 + satLo * Math.max(0, .5 - m) * 2);
    r = m + (r - m) * k; g = m + (g - m) * k; b = m + (b - m) * k;
    out[o] = clamp01(r) * 255 + .5; out[o + 1] = clamp01(g) * 255 + .5; out[o + 2] = clamp01(b) * 255 + .5; out[o + 3] = 255;
  }
  return { w, h, data: out };
}

/** Mapa de radiancia más pequeño (para miniaturas). */
export function downRadiance(R, maxSide){
  const k = Math.min(1, maxSide / Math.max(R.w, R.h));
  if(k >= 1) return R;
  const W = Math.max(1, Math.round(R.w * k)), H = Math.max(1, Math.round(R.h * k)), out = new Float32Array(W * H * 3);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const sx = Math.min(R.w - 1, Math.floor(x / k)), sy = Math.min(R.h - 1, Math.floor(y / k)), i = (sy * R.w + sx) * 3, o = (y * W + x) * 3;
    out[o] = R.rad[i]; out[o + 1] = R.rad[i + 1]; out[o + 2] = R.rad[i + 2];
  }
  return { w: W, h: H, rad: out, space: R.space };
}

/** Todo el proceso tras el mapa (o la fusión) según el método. */
export function toneMap(R, s){
  if(s.method === "compressor") return tmCompressor(R, s);
  if(s.method === "drago") return tmDrago(R, s);
  return tmDetails(R, s);
}
