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
  const { w, h, data } = img, raw = new Float32Array(w * h), v = new Uint8Array(w * h), k = Math.pow(2, -ev);
  for(let p = 0, i = 0; p < raw.length; p++, i += 4){
    const r = data[i], g = data[i + 1], b = data[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    raw[p] = Math.log2((TO_LIN[r] * .2126 + TO_LIN[g] * .7152 + TO_LIN[b] * .0722) * k + 1e-4);
    // Ni quemado ni casi negro: en las sombras profundas el logaritmo
    // convierte el ruido del sensor en gradientes enormes.
    v[p] = mx < ALIGN.hi && mn > ALIGN.lo ? 1 : 0;
  }
  // Suavizado 3×3: quita el ruido de píxel sin mover los bordes.
  if(!ALIGN.blur) return { w, h, l: raw, v };
  const l = new Float32Array(w * h);
  for(let y = 0; y < h; y++){
    const y0 = y > 0 ? y - 1 : y, y1 = y < h - 1 ? y + 1 : y;
    for(let x = 0; x < w; x++){
      const x0 = x > 0 ? x - 1 : x, x1 = x < w - 1 ? x + 1 : x;
      l[y * w + x] = (raw[y0 * w + x0] + raw[y0 * w + x] + raw[y0 * w + x1] + raw[y * w + x0] + raw[y * w + x] + raw[y * w + x1] +
                      raw[y1 * w + x0] + raw[y1 * w + x] + raw[y1 * w + x1]) / 9;
    }
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
/* Error de alineación entre dos fotos desplazadas (dx, dy): diferencia
   media de los gradientes del logaritmo de la luminancia —con la
   exposición ya igualada—, sólo donde las dos tienen información (ni
   quemado ni casi negro). `ALIGN` reúne los parámetros (medidos con
   horquillados de 3 a 11 fotos); `metric: "ncc"` usa la correlación
   normalizada en su lugar. */
export const ALIGN = { metric: "l1", blur: true, lo: 6, hi: 248, prior: 0.03 };
function gradErr(a, b, dx, dy){
  const { w, h } = a;
  const x0 = Math.max(0, -dx), x1 = Math.min(w - 1, w - 1 - dx), y0 = Math.max(0, -dy), y1 = Math.min(h - 1, h - 1 - dy);
  let s = 0, sab = 0, saa = 0, sbb = 0, n = 0;
  const ncc = ALIGN.metric === "ncc";
  for(let y = y0; y < y1; y++){
    for(let x = x0; x < x1; x++){
      const ia = y * w + x, ib = (y + dy) * w + x + dx;
      if(!(a.v[ia] & a.v[ia + 1] & a.v[ia + w] & b.v[ib] & b.v[ib + 1] & b.v[ib + w])) continue;
      const ga = a.l[ia + 1] - a.l[ia], gb = b.l[ib + 1] - b.l[ib];
      const ha = a.l[ia + w] - a.l[ia], hb = b.l[ib + w] - b.l[ib];
      if(ncc){ sab += ga * gb + ha * hb; saa += ga * ga + ha * ha; sbb += gb * gb + hb * hb; }
      else s += Math.abs(ga - gb) + Math.abs(ha - hb);
      n++;
    }
  }
  if(n <= 64) return Infinity;
  return ncc ? (saa > 0 && sbb > 0 ? 1 - sab / Math.sqrt(saa * sbb) : Infinity) : s / n;
}
/* Píxeles útiles para alinear en las dos fotos a la vez (sin desplazar). */
function sharedValid(a, b){
  let n = 0; for(let i = 0; i < a.v.length; i++) n += a.v[i] & b.v[i];
  return n;
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

/* ── Umbral a exposición igualada ────────────────────────────────
   Como el umbral mediano de Ward, pero el umbral se pone en radiancia
   (la exposición ya igualada) y dentro del tramo en el que LAS DOS fotos
   tienen información. Así el borde «más claro / más oscuro que θ» es el
   mismo en ambas aunque una esté casi quemada o casi negra: es lo que
   permite alinear los extremos de un horquillado de 9–11 fotos. */
function logRad(img, ev){
  const { w, h, data } = img, l = new Float32Array(w * h), k = Math.pow(2, -ev);
  for(let p = 0, i = 0; p < l.length; p++, i += 4)
    l[p] = Math.log2((TO_LIN[data[i]] * .2126 + TO_LIN[data[i + 1]] * .7152 + TO_LIN[data[i + 2]] * .0722) * k + 1e-6);
  return { w, h, l };
}
function halveR(m){
  const W = m.w >> 1, H = m.h >> 1, l = new Float32Array(W * H);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const i = 2 * y * m.w + 2 * x;
    l[y * W + x] = (m.l[i] + m.l[i + 1] + m.l[i + m.w] + m.l[i + m.w + 1]) / 4;
  }
  return { w: W, h: H, l };
}
function threshBits(m, t, band){
  const n = m.l.length, b = new Uint8Array(n), e = new Uint8Array(n);
  for(let i = 0; i < n; i++){ const v = m.l[i]; b[i] = v > t ? 1 : 0; e[i] = Math.abs(v - t) > band ? 1 : 0; }
  return { w: m.w, h: m.h, t: b, e };
}
function xorFrac(a, b, dx, dy, nMin = 64){
  const { w, h } = a;
  const x0 = Math.max(0, -dx), x1 = Math.min(w, w - dx), y0 = Math.max(0, -dy), y1 = Math.min(h, h - dy);
  let bad = 0, n = 0;
  for(let y = y0; y < y1; y++){
    let ia = y * w + x0, ib = (y + dy) * w + x0 + dx;
    for(let x = x0; x < x1; x++, ia++, ib++){ if(a.e[ia] & b.e[ib]){ n++; bad += a.t[ia] ^ b.t[ib]; } }
  }
  return n > nMin ? bad / n : Infinity;
}
/* Umbral θ (log2 de radiancia) y zona de exclusión para el par. */
function pairThreshold(ref, evRef, img, evImg, A){
  const lo = Math.max(Math.log2(TO_LIN[12] * Math.pow(2, -evRef)), Math.log2(TO_LIN[12] * Math.pow(2, -evImg)));
  const hi = Math.min(Math.log2(TO_LIN[243] * Math.pow(2, -evRef)), Math.log2(TO_LIN[243] * Math.pow(2, -evImg)));
  if(!(hi > lo)) return null;
  const vals = [];
  for(let i = 0; i < A.l.length; i += 7){ const v = A.l[i]; if(v > lo && v < hi) vals.push(v); }
  if(vals.length < 200) return { t: (lo + hi) / 2, band: Math.min(0.35, (hi - lo) / 6) };
  vals.sort((x, y) => x - y);
  return { t: vals[vals.length >> 1], band: Math.min(0.35, (hi - lo) / 6) };
}
/** Desplazamiento (dx, dy) que lleva `img` sobre `ref`, por umbral a exposición igualada. */
export function alignExposureThreshold(ref, img, evRef, evImg, maxShiftFrac = 0.06){
  const A0 = logRad(ref, evRef), B0 = logRad(img, evImg);
  const th = pairThreshold(ref, evRef, img, evImg, A0);
  if(!th) return { dx: 0, dy: 0, err: Infinity };
  const pa = [A0], pb = [B0];
  while(Math.min(pa[pa.length - 1].w, pa[pa.length - 1].h) > 48 && pa.length < 10){ pa.push(halveR(pa[pa.length - 1])); pb.push(halveR(pb[pb.length - 1])); }
  let dx = 0, dy = 0, best = Infinity;
  for(let l = pa.length - 1; l >= 0; l--){
    dx *= 2; dy *= 2;
    const a = threshBits(pa[l], th.t, th.band), b = threshBits(pb[l], th.t, th.band);
    const R = l === pa.length - 1 ? 3 : 1;
    let bx = dx, by = dy; best = Infinity;
    // Un desplazamiento que deja muchos menos píxeles comparables que el
    // de partida no cuenta: si no, «gana» el que menos compara.
    const n0 = (() => { let n = 0; for(let i = 0; i < a.e.length; i++) n += a.e[i] & b.e[i]; return n; })();
    for(let j = -R; j <= R; j++) for(let i = -R; i <= R; i++){
      const e = xorFrac(a, b, dx + i, dy + j, Math.max(64, n0 * 0.7));
      if(e < best){ best = e; bx = dx + i; by = dy + j; }
    }
    dx = bx; dy = by;
  }
  const lim = Math.round(Math.max(ref.w, ref.h) * maxShiftFrac);
  if(Math.abs(dx) > lim || Math.abs(dy) > lim) return { dx: 0, dy: 0, err: Infinity };
  return { dx, dy, err: best };
}

/** Desplazamiento de `img` sobre `ref` para un par del horquillado.
    Tres métodos proponen candidatos —gradientes (fino en los medios
    tonos), umbral mediano de Ward (robusto) y umbral a exposición igualada
    (el único que ve algo en las tomas casi quemadas o casi negras de un
    horquillado largo)— más «sin desplazamiento». Cada candidato se mide a
    resolución completa con dos criterios: la diferencia de gradientes y
    la discrepancia de los mapas «por encima / por debajo» de un nivel
    común a las dos. Gana el de mejor suma relativa, y se afina ±1 px. */
export function alignPair(ref, img, evRef, evImg){
  const a = logLum(ref, evRef), b = logLum(img, evImg);
  const A = logRad(ref, evRef), B = logRad(img, evImg);
  const th = pairThreshold(ref, evRef, img, evImg, A);
  const ta = th ? threshBits(A, th.t, th.band) : null, tb = th ? threshBits(B, th.t, th.band) : null;
  const n0 = ta ? (() => { let n = 0; for(let i = 0; i < ta.e.length; i++) n += ta.e[i] & tb.e[i]; return n; })() : 0;
  const shared = sharedValid(a, b), useGrad = shared > Math.max(400, a.v.length * 0.01);
  const cands = [alignGradient(ref, img, evRef, evImg), alignShift(ref, img), alignExposureThreshold(ref, img, evRef, evImg), { dx: 0, dy: 0 }];
  const uniq = [];
  for(const c of cands) if(!uniq.some(u => u.dx === c.dx && u.dy === c.dy)) uniq.push({ dx: c.dx, dy: c.dy });
  const measure = c => ({
    g: useGrad ? gradErr(a, b, c.dx, c.dy) : Infinity,
    x: ta && n0 > 400 ? xorFrac(ta, tb, c.dx, c.dy, n0 * 0.7) : Infinity
  });
  const pick = list => {
    const m = list.map(measure);
    const gMin = Math.min(...m.map(v => v.g)), xMin = Math.min(...m.map(v => v.x));
    let best = list[0], bs = Infinity;
    // Cada criterio pesa según los píxeles que de verdad puede comparar:
    // con una foto casi quemada, los gradientes apenas ven nada y el
    // mapa de umbral, en cambio, ve todo el borde de lo quemado.
    const N = a.v.length, wg = useGrad ? shared / N : 0, wx = n0 / N;
    list.forEach((c, i) => {
      let sc = 0, k = 0;
      // (+ margen: un encaje perfecto da error 0 y no debe anular el criterio)
      if(wg && Number.isFinite(gMin)){ sc += wg * (m[i].g + 1e-3) / (gMin + 1e-3); k += wg; }
      if(wx && Number.isFinite(xMin)){ sc += wx * (m[i].x + 1e-3) / (xMin + 1e-3); k += wx; }
      sc = k ? sc / k : (c.dx || c.dy ? Infinity : 0);
      // Preferencia suave por desplazamientos pequeños: si los criterios
      // apenas distinguen (cielos lisos, degradados), no se inventa un
      // desplazamiento —que además se sumaría en la cadena—.
      sc *= 1 + ALIGN.prior * (Math.abs(c.dx) + Math.abs(c.dy)) * 100 / Math.max(ref.w, ref.h);
      if(sc < bs - 1e-9){ bs = sc; best = c; }
    });
    return best;
  };
  let best = pick(uniq);
  // Afinado ±1 px alrededor del elegido, con el mismo criterio.
  const near = [];
  for(let j = -1; j <= 1; j++) for(let i = -1; i <= 1; i++) near.push({ dx: best.dx + i, dy: best.dy + j });
  best = pick(near);
  // Fracción de píxel (sólo la usa el modo Premium; el modo de siempre
  // sigue con el desplazamiento entero): Lucas–Kanade sobre el
  // logaritmo de la luminancia a exposición igualada, partiendo del
  // desplazamiento entero elegido.
  let fx = 0, fy = 0;
  if(useGrad){ const r = refineLK(a, b, best.dx, best.dy); if(r){ fx = r.dx - best.dx; fy = r.dy - best.dy; } }
  return { dx: best.dx, dy: best.dy, fx, fy };
}

/* Gauss–Newton de una traslación: minimiza Σ (b(x + d) − a(x))² donde
   las dos fotos tienen información. b se muestrea con interpolación
   bilineal; como la exposición ya está igualada en log, basta con restar
   la diferencia media (un sesgo de exposición no mueve el mínimo). */
function refineLK(a, b, dx0, dy0){
  const { w, h } = a;
  let dx = dx0, dy = dy0;
  const bil = (m, x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0, i = y0 * w + x0;
    return (m[i] * (1 - tx) + m[i + 1] * tx) * (1 - ty) + (m[i + w] * (1 - tx) + m[i + w + 1] * tx) * ty;
  };
  const step = Math.max(1, Math.round(Math.sqrt(w * h / 120000)));
  for(let it = 0; it < 8; it++){
    let h11 = 0, h12 = 0, h22 = 0, g1 = 0, g2 = 0, n = 0, mean = 0;
    const res = [];
    for(let y = 2; y < h - 3; y += step) for(let x = 2; x < w - 3; x += step){
      const bx = x + dx, by = y + dy;
      if(bx < 1 || by < 1 || bx >= w - 2 || by >= h - 2) continue;
      const ia = y * w + x, ib = Math.floor(by) * w + Math.floor(bx);
      if(!(a.v[ia] & b.v[ib] & b.v[ib + 1] & b.v[ib + w] & b.v[ib + w + 1])) continue;
      const gx = (bil(b.l, bx + 0.5, by) - bil(b.l, bx - 0.5, by)), gy = (bil(b.l, bx, by + 0.5) - bil(b.l, bx, by - 0.5));
      if(Math.abs(gx) + Math.abs(gy) < 1e-4) continue;
      const r = bil(b.l, bx, by) - a.l[ia];
      res.push(r, gx, gy); mean += r; n++;
    }
    if(n < 200) return null;
    mean /= n;
    for(let k = 0; k < res.length; k += 3){
      const r = res[k] - mean, gx = res[k + 1], gy = res[k + 2];
      // Pesos robustos (Huber): un borde que se mueve no arrastra la solución
      const wt = Math.abs(r) < 0.15 ? 1 : 0.15 / Math.abs(r);
      h11 += wt * gx * gx; h12 += wt * gx * gy; h22 += wt * gy * gy; g1 += wt * gx * r; g2 += wt * gy * r;
    }
    const det = h11 * h22 - h12 * h12;
    if(!(det > 1e-12)) return null;
    const ux = -(h22 * g1 - h12 * g2) / det, uy = -(-h12 * g1 + h11 * g2) / det;
    dx += Math.max(-0.5, Math.min(0.5, ux)); dy += Math.max(-0.5, Math.min(0.5, uy));
    if(Math.abs(ux) + Math.abs(uy) < 0.005) break;
  }
  // Si se aleja más de 1,5 px del entero, algo no cuadra: se descarta.
  if(Math.abs(dx - dx0) > 1.5 || Math.abs(dy - dy0) > 1.5) return null;
  return { dx, dy };
}

/** Desplazamiento de cada foto respecto a la de referencia (exposición
    intermedia), encadenando vecinas de exposición: cada una se alinea
    con la contigua hacia la referencia y se suman los desplazamientos. */
export function alignAll(imgs, evs, onStep = null){
  const order = evs.map((e, i) => [e, i]).sort((a, b) => a[0] - b[0]).map(o => o[1]);
  const mid = (order.length - 1) >> 1, shifts = new Array(imgs.length);
  shifts[order[mid]] = { dx: 0, dy: 0, fdx: 0, fdy: 0 };
  let step = 0;
  const tick = () => onStep?.(++step, order.length - 1);
  for(let k = mid + 1; k < order.length; k++){
    tick();
    const prev = order[k - 1], cur = order[k], s = alignPair(imgs[prev], imgs[cur], evs[prev], evs[cur]);
    shifts[cur] = { dx: shifts[prev].dx + s.dx, dy: shifts[prev].dy + s.dy, fdx: shifts[prev].fdx + s.dx + (s.fx || 0), fdy: shifts[prev].fdy + s.dy + (s.fy || 0) };
  }
  for(let k = mid - 1; k >= 0; k--){
    tick();
    const prev = order[k + 1], cur = order[k], s = alignPair(imgs[prev], imgs[cur], evs[prev], evs[cur]);
    shifts[cur] = { dx: shifts[prev].dx + s.dx, dy: shifts[prev].dy + s.dy, fdx: shifts[prev].fdx + s.dx + (s.fx || 0), fdy: shifts[prev].fdy + s.dy + (s.fy || 0) };
  }
  // Tope al acumulado de la cadena: una foto que acabara a más del 6 %
  // de la de referencia es un error sumado, no un pulso real; se queda
  // donde su vecina hacia la referencia.
  const lim = Math.round(Math.max(imgs[0].w, imgs[0].h) * 0.06);
  const clampFrom = (from, to, stepDir) => {
    for(let k = from; k !== to; k += stepDir){
      const cur = order[k], prev = order[k - stepDir];
      if(Math.abs(shifts[cur].dx) > lim || Math.abs(shifts[cur].dy) > lim) shifts[cur] = { ...shifts[prev] };
    }
  };
  clampFrom(mid + 1, order.length, 1); clampFrom(mid - 1, -1, -1);
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
