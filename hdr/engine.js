/* ═══════════════════════════════════════════════════════════════
   HDR · MOTOR
   Funciones puras sobre píxeles (sin DOM): se usan desde el worker
   (hdr/worker.js) para la vista previa, las miniaturas y el resultado
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

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const TO_LIN = new Float32Array(256);
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

/* ── Alineación (umbral mediano, Ward 2003) ─────────────────── */
function grayOf(img){
  const { w, h, data } = img, g = new Uint8Array(w * h);
  for(let p = 0, i = 0; p < g.length; p++, i += 4) g[p] = (54 * data[i] + 183 * data[i + 1] + 19 * data[i + 2]) >> 8;
  return { w, h, g };
}
function halve(m){
  const W = m.w >> 1, H = m.h >> 1, g = new Uint8Array(W * H);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const i = 2 * y * m.w + 2 * x;
    g[y * W + x] = (m.g[i] + m.g[i + 1] + m.g[i + m.w] + m.g[i + m.w + 1]) >> 2;
  }
  return { w: W, h: H, g };
}
function bitmaps(m){
  const hist = new Uint32Array(256); for(const v of m.g) hist[v]++;
  let acc = 0, med = 128; const half = m.g.length / 2;
  for(let v = 0; v < 256; v++){ acc += hist[v]; if(acc >= half){ med = v; break; } }
  const t = new Uint8Array(m.g.length), e = new Uint8Array(m.g.length);
  for(let i = 0; i < m.g.length; i++){ const v = m.g[i]; t[i] = v > med ? 1 : 0; e[i] = Math.abs(v - med) > 4 ? 1 : 0; }
  return { w: m.w, h: m.h, t, e };
}
function xorCount(a, b, dx, dy){
  let n = 0;
  const { w, h } = a;
  const x0 = Math.max(0, -dx), x1 = Math.min(w, w - dx), y0 = Math.max(0, -dy), y1 = Math.min(h, h - dy);
  for(let y = y0; y < y1; y++){
    let ia = y * w + x0, ib = (y + dy) * w + x0 + dx;
    for(let x = x0; x < x1; x++, ia++, ib++) if((a.t[ia] ^ b.t[ib]) & a.e[ia] & b.e[ib]) n++;
  }
  return n;
}
/* Gradientes del logaritmo de la luminancia, con la exposición igualada:
   la diferencia de exposición (y la curva tonal de la cámara, casi) se
   anula, y lo quemado o en negro no cuenta. */
function logLum(img, ev){
  const { w, h, data } = img, l = new Float32Array(w * h), v = new Uint8Array(w * h), k = Math.pow(2, -ev);
  for(let p = 0, i = 0; p < l.length; p++, i += 4){
    const r = data[i], g = data[i + 1], b = data[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    l[p] = Math.log2((TO_LIN[r] * .2126 + TO_LIN[g] * .7152 + TO_LIN[b] * .0722) * k + 1e-4);
    v[p] = mx < 248 && mn > 6 ? 1 : 0;
  }
  return { w, h, l, v };
}
function halveL(m){
  const W = m.w >> 1, H = m.h >> 1, l = new Float32Array(W * H), v = new Uint8Array(W * H);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const i = 2 * y * m.w + 2 * x, o = y * W + x;
    l[o] = (m.l[i] + m.l[i + 1] + m.l[i + m.w] + m.l[i + m.w + 1]) / 4;
    v[o] = m.v[i] & m.v[i + 1] & m.v[i + m.w] & m.v[i + m.w + 1];
  }
  return { w: W, h: H, l, v };
}
function gradErr(a, b, dx, dy){
  const { w, h } = a;
  const x0 = Math.max(0, -dx), x1 = Math.min(w - 1, w - 1 - dx), y0 = Math.max(0, -dy), y1 = Math.min(h - 1, h - 1 - dy);
  let s = 0, n = 0;
  for(let y = y0; y < y1; y++){
    for(let x = x0; x < x1; x++){
      const ia = y * w + x, ib = (y + dy) * w + x + dx;
      if(!(a.v[ia] & a.v[ia + 1] & a.v[ia + w] & b.v[ib] & b.v[ib + 1] & b.v[ib + w])) continue;
      const ga = a.l[ia + 1] - a.l[ia], gb = b.l[ib + 1] - b.l[ib];
      const ha = a.l[ia + w] - a.l[ia], hb = b.l[ib + w] - b.l[ib];
      s += Math.abs(ga - gb) + Math.abs(ha - hb); n++;
    }
  }
  return n > 64 ? s / n : Infinity;
}
/** Desplazamiento (dx, dy) que lleva `img` sobre `ref`, con sus EV
    relativos (para igualar la exposición antes de comparar). */
export function alignGradient(ref, img, evRef = 0, evImg = 0, maxShiftFrac = 0.06){
  const pa = [logLum(ref, evRef)], pb = [logLum(img, evImg)];
  while(Math.min(pa[pa.length - 1].w, pa[pa.length - 1].h) > 48 && pa.length < 10){ pa.push(halveL(pa[pa.length - 1])); pb.push(halveL(pb[pb.length - 1])); }
  let dx = 0, dy = 0;
  for(let l = pa.length - 1; l >= 0; l--){
    dx *= 2; dy *= 2;
    const R = l === pa.length - 1 ? 3 : 1;
    let best = Infinity, bx = dx, by = dy;
    for(let j = -R; j <= R; j++) for(let i = -R; i <= R; i++){
      const e = gradErr(pa[l], pb[l], dx + i, dy + j);
      if(e < best){ best = e; bx = dx + i; by = dy + j; }
    }
    dx = bx; dy = by;
  }
  const lim = Math.round(Math.max(ref.w, ref.h) * maxShiftFrac);
  if(Math.abs(dx) > lim || Math.abs(dy) > lim) return { dx: 0, dy: 0 };
  return { dx, dy };
}

/** Desplazamiento (dx, dy) que lleva `img` sobre `ref` (umbral mediano). */
export function alignShift(ref, img, maxShiftFrac = 0.06){
  let A = grayOf(ref), B = grayOf(img);
  const pa = [A], pb = [B];
  while(Math.min(pa[pa.length - 1].w, pa[pa.length - 1].h) > 64 && pa.length < 10){ pa.push(halve(pa[pa.length - 1])); pb.push(halve(pb[pb.length - 1])); }
  let dx = 0, dy = 0;
  for(let l = pa.length - 1; l >= 0; l--){
    dx *= 2; dy *= 2;
    const a = bitmaps(pa[l]), b = bitmaps(pb[l]);
    let best = Infinity, bx = dx, by = dy;
    for(let j = -1; j <= 1; j++) for(let i = -1; i <= 1; i++){
      const n = xorCount(a, b, dx + i, dy + j);
      if(n < best){ best = n; bx = dx + i; by = dy + j; }
    }
    dx = bx; dy = by;
  }
  const lim = Math.round(Math.max(ref.w, ref.h) * maxShiftFrac);
  if(Math.abs(dx) > lim || Math.abs(dy) > lim) return { dx: 0, dy: 0 };
  return { dx, dy };
}

/** Mejor de los dos métodos para un par: se prueban ambos candidatos y
    se queda el de menor error de gradientes a resolución completa. */
export function alignPair(ref, img, evRef, evImg){
  const a = logLum(ref, evRef), b = logLum(img, evImg);
  const cands = [alignGradient(ref, img, evRef, evImg), alignShift(ref, img), { dx: 0, dy: 0 }];
  let best = cands[0], be = Infinity;
  for(const c of cands){ const e = gradErr(a, b, c.dx, c.dy); if(e < be - 1e-6){ be = e; best = c; } }
  // Retoque fino alrededor del elegido (±1 px)
  let { dx, dy } = best;
  for(let j = -1; j <= 1; j++) for(let i = -1; i <= 1; i++){ const e = gradErr(a, b, best.dx + i, best.dy + j); if(e < be - 1e-6){ be = e; dx = best.dx + i; dy = best.dy + j; } }
  return { dx, dy };
}

/** Desplazamiento de cada foto respecto a la de referencia (exposición
    intermedia), encadenando vecinas de exposición: cada una se alinea
    con la contigua hacia la referencia y se suman los desplazamientos. */
export function alignAll(imgs, evs){
  const order = evs.map((e, i) => [e, i]).sort((a, b) => a[0] - b[0]).map(o => o[1]);
  const mid = (order.length - 1) >> 1, shifts = new Array(imgs.length);
  shifts[order[mid]] = { dx: 0, dy: 0 };
  for(let k = mid + 1; k < order.length; k++){
    const prev = order[k - 1], cur = order[k], s = alignPair(imgs[prev], imgs[cur], evs[prev], evs[cur]);
    shifts[cur] = { dx: shifts[prev].dx + s.dx, dy: shifts[prev].dy + s.dy };
  }
  for(let k = mid - 1; k >= 0; k--){
    const prev = order[k + 1], cur = order[k], s = alignPair(imgs[prev], imgs[cur], evs[prev], evs[cur]);
    shifts[cur] = { dx: shifts[prev].dx + s.dx, dy: shifts[prev].dy + s.dy };
  }
  return shifts;
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
function lumOf(rad, n){ const Y = new Float32Array(n); for(let i = 0, j = 0; i < n; i++, j += 3) Y[i] = rad[j] * .2126 + rad[j + 1] * .7152 + rad[j + 2] * .0722 + 1e-7; return Y; }

/** Detalles realzados (Photomatix «Details Enhancer»). */
export function tmDetails(R, s){
  const { w, h, rad } = R, n = w * h, Y = lumOf(rad, n);
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
  const out = new Float32Array(n * 3), sat = s.sat / 100;
  const smoothHi = s.smoothHi / 100;
  for(let i = 0, j = 0; i < n; i++, j += 3){
    let lo = (base[i] - bHi) * c + detail[i] * dBoost + lumShift - 0.15;
    // Suavizar luces: en las altas luces se atenúa el detalle ampliado.
    if(smoothHi > 0 && lo > -1.5){ const t = Math.min(1, (lo + 1.5) / 1.5) * smoothHi; lo = lo * (1 - t) + ((base[i] - bHi) * c + lumShift - 0.15) * t; }
    const Yd = Math.pow(2, lo), y = Y[i];
    out[j]     = enc(Yd * Math.pow(rad[j] / y, sat));
    out[j + 1] = enc(Yd * Math.pow(rad[j + 1] / y, sat));
    out[j + 2] = enc(Yd * Math.pow(rad[j + 2] / y, sat));
  }
  return { w, h, px: out };
}

/** Compresor de tonos (Reinhard global con punto blanco). */
export function tmCompressor(R, s){
  const { w, h, rad } = R, n = w * h, Y = lumOf(rad, n);
  let lsum = 0; for(let i = 0; i < n; i++) lsum += Math.log(Y[i]);
  const Lavg = Math.exp(lsum / n);
  const a = 0.18 * Math.pow(2, s.brightness / 50);
  let Lmax = 0; const Ls = new Float32Array(n);
  for(let i = 0; i < n; i++){ Ls[i] = a / Lavg * Y[i]; if(Ls[i] > Lmax) Lmax = Ls[i]; }
  const Lw = Math.max(0.5, percentile(Ls, .999) * (0.35 + 1.3 * (s.whiteCmp / 100)));
  const Lw2 = Lw * Lw, gam = 1 + s.tcontrast / 100 * 0.8, sat = s.sat / 100;
  const out = new Float32Array(n * 3);
  for(let i = 0, j = 0; i < n; i++, j += 3){
    let Ld = Ls[i] * (1 + Ls[i] / Lw2) / (1 + Ls[i]);
    Ld = Math.pow(Math.min(1.5, Ld), gam);
    const y = Y[i];
    out[j] = enc(Ld * Math.pow(rad[j] / y, sat)); out[j + 1] = enc(Ld * Math.pow(rad[j + 1] / y, sat)); out[j + 2] = enc(Ld * Math.pow(rad[j + 2] / y, sat));
  }
  return { w, h, px: out };
}

/** Fotográfico (Drago, logarítmico adaptativo). */
export function tmDrago(R, s){
  const { w, h, rad } = R, n = w * h, Y = lumOf(rad, n);
  let lsum = 0; for(let i = 0; i < n; i++) lsum += Math.log(Y[i]);
  const Lavg = Math.exp(lsum / n);
  const expo = Math.pow(2, s.brightness / 50) / Lavg * 0.18;
  const Lmax = percentile(Y, .999) * expo;
  const bias = 0.5 + 0.45 * (s.bias / 100);
  const lb = Math.log(bias) / Math.log(0.5), denom = Math.log10(Lmax + 1);
  const sat = s.sat / 100, out = new Float32Array(n * 3);
  for(let i = 0, j = 0; i < n; i++, j += 3){
    const Lw = Y[i] * expo;
    const Ld = Math.log(Lw + 1) / Math.log(2 + 8 * Math.pow(Lw / Lmax, lb)) / denom;
    const y = Y[i];
    out[j] = enc(Ld * Math.pow(rad[j] / y, sat)); out[j + 1] = enc(Ld * Math.pow(rad[j + 1] / y, sat)); out[j + 2] = enc(Ld * Math.pow(rad[j + 2] / y, sat));
  }
  return { w, h, px: out };
}

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
  return { w: W, h: H, rad: out };
}

/** Todo el proceso tras el mapa (o la fusión) según el método. */
export function toneMap(R, s){
  if(s.method === "compressor") return tmCompressor(R, s);
  if(s.method === "drago") return tmDrago(R, s);
  return tmDetails(R, s);
}
