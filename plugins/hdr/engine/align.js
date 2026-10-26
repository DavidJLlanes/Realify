/* ═══════════════════════════════════════════════════════════════
   engine · align
   Parte de plugins/hdr/engine.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { TO_LIN } from "./common.js";

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
