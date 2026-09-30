/* ═══════════════════════════════════════════════════════════════
   DIAGNÓSTICO AUTOMÁTICO DE LA FOTO
   Lo comparten los ajustes automáticos (Mejora automática, Tono / Color,
   Contraste y Niveles automáticos, normales y Premium 👑). En vez de
   estirar a ciegas el histograma, primero se averigua QUÉ le pasa a la
   foto, como haría un retocador:

     · Dominante de color. Dos estimaciones del color de la luz en luz
       lineal: «gray-edge» (los bordes, que casi siempre son neutros, y
       no se dejan engañar por una pared naranja enorme) y los píxeles
       casi grises, buscados de forma iterativa (tras cada corrección
       aparecen grises nuevos). Se mezclan según cuántos grises fiables
       hay (confianza). Se corrige en OKLab: verde/magenta casi del todo
       (siempre es un error: fluorescentes, móviles), azul frío casi del
       todo y un tono cálido sólo en parte (la luz del atardecer o de
       interior forma parte de la foto). Si la foto está dominada por
       un color intenso de la misma dirección (atardecer, bosque, un
       escenario), se corrige mucho menos.
     · Luces y sombras. Punto negro y blanco por percentiles de la
       luminancia, pero: si las luces ya están quemadas no se estira
       más (sólo quemaría más); los brillos puntuales aislados (sol,
       reflejos) no cuentan como «blanco»; la ganancia se limita para
       no amplificar el ruido de las sombras.
     · Exposición. La mediana se lleva hacia el gris medio (L* 50) con
       topes, y menos si la escena es de clave baja con luces propias
       (noche, contraluz): ahí no hay que aclarar todo, sino abrir las
       sombras (lo hace la Mejora automática Premium).
     · Colores extremos. El color más oscuro y el más claro de verdad
       («buscar colores oscuros y claros»): si son casi neutros, sirven
       para neutralizar sombras y luces por separado; si son colores
       intensos (una lámpara amarilla, un mar azul profundo), no.
   ═══════════════════════════════════════════════════════════════ */

import { toLab, toRgb } from "./premiumcolor.js";

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const LUMA = [0.2126, 0.7152, 0.0722];
export const encF = v => { v = clamp(v, 0, 1); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
export const decF = e => { e = clamp(e, 0, 1); return e <= 0.04045 ? e / 12.92 : Math.pow((e + 0.055) / 1.055, 2.4); };
export const lstar = Y => Y <= 216 / 24389 ? Y * (24389 / 27) / 100 : 1.16 * Math.cbrt(Y) - 0.16;
const DEC = new Float32Array(256);
for(let i = 0; i < 256; i++) DEC[i] = decF(i / 255);

/* Muestra en rejilla (≤ `max` píxeles), en luz lineal */
export function sampleImage(data, w, h, max = 250000){
  const step = Math.max(1, Math.ceil(Math.sqrt(w * h / max)));
  const gw = Math.ceil(w / step), gh = Math.ceil(h / step), n = gw * gh;
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n);
  const ok = new Uint8Array(n), hi = new Uint8Array(n), wh = new Uint8Array(n), lo = new Uint8Array(n);
  let valid = 0;
  for(let gy = 0, j = 0; gy < gh; gy++) for(let gx = 0; gx < gw; gx++, j++){
    const i = ((gy * step) * w + gx * step) * 4;
    if(data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    R[j] = DEC[r]; G[j] = DEC[g]; B[j] = DEC[b]; ok[j] = 1; valid++;
    if(r >= 253 || g >= 253 || b >= 253) hi[j] = 1;           // algún canal quemado
    if(r >= 253 && g >= 253 && b >= 253) wh[j] = 1;           // blanco puro
    if(r <= 2 && g <= 2 && b <= 2) lo[j] = 1;
  }
  return { gw, gh, n, R, G, B, ok, hi, wh, lo, valid: Math.max(1, valid) };
}

/* ── Dominante de color ─────────────────────────────────────────
   Devuelve { gains: [r,g,b] (luz lineal, conservan la luminancia),
   neutral: color medio de los grises (lineal, absoluto), conf, cast }. */
export function estimateCast(S){
  const { gw, gh, R, G, B, ok, hi } = S;
  const lab = [0, 0, 0];
  // 1) Gray-edge (p = 6) sobre la rejilla
  let er = 0, eg = 0, eb = 0, en = 0;
  for(let y = 0; y < gh - 1; y++) for(let x = 0; x < gw - 1; x++){
    const i = y * gw + x, j = i + 1, k = i + gw;
    if(!ok[i] || !ok[j] || !ok[k] || hi[i] || hi[j] || hi[k]) continue;
    const dr = Math.hypot(R[j] - R[i], R[k] - R[i]), dg = Math.hypot(G[j] - G[i], G[k] - G[i]), db = Math.hypot(B[j] - B[i], B[k] - B[i]);
    if(dr + dg + db < 1e-4) continue;
    er += dr ** 6; eg += dg ** 6; eb += db ** 6; en++;
  }
  const edge = en > 50 ? [er, eg, eb].map(v => Math.pow(v / en, 1 / 6)) : null;
  const norm = e => { const Y = LUMA[0] * e[0] + LUMA[1] * e[1] + LUMA[2] * e[2] || 1; return e.map(v => v / Y); };

  // 2) Grises, de forma iterativa (arranca desde gray-edge)
  let est = edge ? norm(edge) : [1, 1, 1], neutral = null, frac = 0;
  for(let it = 0; it < 4; it++){
    const g = est.map(v => 1 / Math.max(v, 1e-4));
    let sr = 0, sg = 0, sb = 0, sw = 0, cnt = 0;
    for(let i = 0; i < S.n; i++){
      if(!ok[i] || hi[i]) continue;
      const Y = LUMA[0] * R[i] + LUMA[1] * G[i] + LUMA[2] * B[i], L = lstar(Y);
      if(L < 0.15 || L > 0.97) continue;
      cnt++;
      const r = R[i] * g[0], gg = G[i] * g[1], b = B[i] * g[2], Yc = LUMA[0] * r + LUMA[1] * gg + LUMA[2] * b || 1, s = Y / Yc;
      toLab(r * s, gg * s, b * s, lab);
      const C = Math.hypot(lab[1], lab[2]), wgt = Math.exp(-((C / 0.022) ** 2));
      if(wgt < 0.02) continue;
      sr += wgt * R[i]; sg += wgt * G[i]; sb += wgt * B[i]; sw += wgt;
    }
    if(sw < 20) break;
    neutral = [sr / sw, sg / sw, sb / sw]; frac = sw / Math.max(1, cnt);
    est = norm(neutral);
  }
  // 3) Mezcla: los grises valen más cuantos más hay
  const wN = neutral ? clamp(frac / 0.06, 0, 1) : 0;
  let ill = edge ? norm(edge) : [1, 1, 1];
  if(neutral){ const nn = norm(neutral); ill = ill.map((v, c) => Math.exp(Math.log(v) * (1 - wN) + Math.log(nn[c]) * wN)); }
  toLab(ill[0], ill[1], ill[2], lab);
  const [Li, ai, bi] = lab, Ci = Math.hypot(ai, bi);
  let conf = 0.6 + 0.4 * wN;
  if(edge && neutral){        // las dos estimaciones de acuerdo → más confianza
    const e = norm(edge), m = norm(neutral); const le = [0, 0, 0], lm = [0, 0, 0];
    toLab(e[0], e[1], e[2], le); toLab(m[0], m[1], m[2], lm);
    const d = Math.hypot(le[1] - lm[1], le[2] - lm[2]);
    conf *= clamp(1.25 - d / 0.04, 0.55, 1.1);
  }
  conf = clamp(conf, 0, 1);
  // Escena dominada por un color intenso en la misma dirección que la dominante
  let dom = 0, tot = 0;
  if(Ci > 1e-3){
    const ux = ai / Ci, uy = bi / Ci;
    for(let i = 0; i < S.n; i += 2){
      if(!ok[i]) continue; tot++;
      toLab(R[i], G[i], B[i], lab);
      const C = Math.hypot(lab[1], lab[2]);
      if(C > 0.07 && (lab[1] * ux + lab[2] * uy) / C > 0.82) dom++;
    }
  }
  const domFrac = tot ? dom / tot : 0;
  const domK = clamp(1 - (domFrac - 0.3) / 0.4, 0.35, 1);
  // Cuánto se corrige de cada eje: verde/magenta (a) y azul/ámbar (b)
  const ka = 0.92 * conf * domK, kb = (bi > 0 ? 0.72 : 0.9) * conf * domK;
  let gains = [1, 1, 1];
  if(Ci > 0.006){
    const t = [0, 0, 0];
    toRgb(Li, ai * (1 - ka), bi * (1 - kb), t);
    gains = t.map((v, c) => clamp(Math.max(v, 1e-4) / ill[c], 0.7, 1.45));
    const k = LUMA[0] * gains[0] * ill[0] + LUMA[1] * gains[1] * ill[1] + LUMA[2] * gains[2] * ill[2];
    const k0 = LUMA[0] * ill[0] + LUMA[1] * ill[1] + LUMA[2] * ill[2];
    gains = gains.map(v => +(v * k0 / k).toFixed(4));
  }
  return { gains, neutral, conf, cast: Ci, castAB: [ai, bi], domFrac, neutralFrac: frac };
}

/* ── Estadística de tonos (tras unas ganancias opcionales) ─────── */
export function toneStats(S, gains = [1, 1, 1]){
  const { R, G, B, ok, hi, wh, lo } = S, NB = 2048;
  const hist = new Uint32Array(NB), E = new Float32Array(S.n);
  let n = 0, clipHi = 0, clipWh = 0, clipLo = 0, sL = 0, sL2 = 0;
  for(let i = 0; i < S.n; i++){
    if(!ok[i]){ E[i] = -1; continue; }
    const Y = Math.min(1, LUMA[0] * R[i] * gains[0] + LUMA[1] * G[i] * gains[1] + LUMA[2] * B[i] * gains[2]);
    const e = encF(Y); E[i] = e; hist[Math.min(NB - 1, (e * NB) | 0)]++; n++;
    if(hi[i]) clipHi++; if(wh[i]) clipWh++; if(lo[i]) clipLo++;
    const L = lstar(Y); sL += L; sL2 += L * L;
  }
  n = Math.max(1, n);
  const cum = new Float64Array(NB); let acc = 0;
  for(let k = 0; k < NB; k++){ acc += hist[k]; cum[k] = acc / n; }
  const pE = f => { f = clamp(f, 0, 1); let k = 0; while(k < NB - 1 && cum[k] < f) k++; return (k + 0.5) / NB; };
  const frac = (a, b) => { const ka = clamp((a * NB) | 0, 0, NB - 1), kb = clamp((b * NB) | 0, 0, NB - 1); return (kb >= 0 ? cum[kb] : 0) - (ka > 0 ? cum[ka - 1] : 0); };
  // Colores extremos de verdad: el 0,5 % más oscuro y más claro (sin
  // contar los negros puros ni los canales quemados)
  const eD = pE(0.005), eL = pE(0.995), dark = [0, 0, 0], light = [0, 0, 0];
  let nd = 0, nl = 0;
  for(let i = 0; i < S.n; i++){
    if(E[i] < 0) continue;
    if(E[i] <= eD && !lo[i]){ dark[0] += R[i] * gains[0]; dark[1] += G[i] * gains[1]; dark[2] += B[i] * gains[2]; nd++; }
    else if(E[i] >= eL && !wh[i]){ light[0] += R[i] * gains[0]; light[1] += G[i] * gains[1]; light[2] += B[i] * gains[2]; nl++; }
  }
  const mL = sL / n;
  return {
    n, pE, frac, clipHi: clipHi / n, clipWhite: clipWh / n, clipLo: clipLo / n,
    med: pE(0.5), meanL: mL, stdL: Math.sqrt(Math.max(0, sL2 / n - mL * mL)),
    dark: nd ? dark.map(v => v / nd) : null, light: nl ? light.map(v => v / nl) : null
  };
}

/* ── Plan de tono: punto negro, blanco y medios (codificado 0..1) ──
   `clip` en %, `maxGain` tope del estiramiento, `mid` fuerza de la
   corrección de medios (0..1). */
export function tonePlan(T, { clip = 0.1, maxGain = 2.2, mid = 0.7 } = {}){
  const c = clamp(clip, 0, 10) / 100;
  let black = T.pE(c), white = T.pE(1 - c);
  // Brillos puntuales aislados (sol, reflejos): cola clara muy dispersa
  if(c <= 0.002 && white - T.pE(1 - 4 * c) > 0.12) white = T.pE(1 - 4 * c);
  // Ya quemado / ya en negro puro: no estirar más ese extremo
  if(T.clipWhite > 0.003 || T.clipHi > 0.02) white = 1;
  if(T.clipLo > 0.003) black = 0;
  black = clamp(black, 0, 0.4); white = clamp(white, Math.max(0.55, black + 0.15), 1);
  if(1 / (white - black) > maxGain){
    // Rango muy estrecho: se estira sólo hasta el tope, repartido
    const width = 1 / maxGain, room = width - (white - black);
    const lowRoom = black, highRoom = 1 - white;
    const takeLow = room * (lowRoom / Math.max(1e-6, lowRoom + highRoom));
    black = clamp(black - takeLow, 0, 1); white = clamp(black + width, 0, 1); black = white - width;
  }
  // Medios: sólo si la exposición está claramente mal. Una foto bien
  // expuesta no tiene por qué tener la mediana en el gris medio (una
  // escena clara o sombría lo es a propósito): dentro de una franja
  // correcta (L* ≈ 38-62) no se toca; fuera, se acerca al borde.
  const x = clamp((T.med - black) / Math.max(1e-3, white - black), 0.03, 0.97);
  const lo = 0.36, hi = 0.62;                      // L* ≈ 38 y 62, codificado
  let gamma = 1;
  if(x < lo || x > hi){
    let k = mid;
    // Clave baja con luces propias (noche, contraluz): aclarar menos
    if(x < lo && T.frac(0.8, 1) > 0.05) k *= 0.5;
    // Clave alta con muchas luces casi quemadas: oscurecer menos
    if(x > hi && T.clipHi > 0.01) k *= 0.5;
    const target = x < lo ? lo + 0.06 : hi - 0.04;
    const g0 = clamp(Math.log(x) / Math.log(target), 0.62, 1.7);
    gamma = 1 + (g0 - 1) * k;
  }
  return { black, white, gamma };
}

/* ── Negro y blanco de cada canal a partir de los colores extremos ──
   Si el color más oscuro o el más claro son casi neutros, su tinte es
   una dominante (se corrige); si son colores intensos, se respetan. */
export function channelPlan(T, P, { k = 0.85, gains = [1, 1, 1] } = {}){
  const out = [0, 1, 2].map(() => ({ lo: P.black, hi: P.white }));
  const lab = [0, 0, 0];
  const trust = (col, c0, c1) => {
    if(!col) return 0;
    // La confianza se mide DESPUÉS de quitar la dominante general: si
    // sin ella el extremo es casi neutro, su tinte es sólo esa dominante
    const c = col.map((v, i) => v * gains[i]);
    const Y = LUMA[0] * c[0] + LUMA[1] * c[1] + LUMA[2] * c[2];
    if(Y <= 0) return 0;
    toLab(c[0] / Y * Math.min(Y, 1), c[1] / Y * Math.min(Y, 1), c[2] / Y * Math.min(Y, 1), lab);
    return clamp(1 - (Math.hypot(lab[1], lab[2]) - c0) / (c1 - c0), 0, 1);
  };
  const tD = trust(T.dark, 0.03, 0.12) * k, tL = trust(T.light, 0.02, 0.1) * k;
  const Ye = col => encF(LUMA[0] * col[0] + LUMA[1] * col[1] + LUMA[2] * col[2]);
  for(let c = 0; c < 3; c++){
    let lo = P.black, hi = P.white;
    if(tD > 0) lo = P.black + (encF(T.dark[c]) - Ye(T.dark)) * tD;
    // Con blanco puro quemado ya hay referencia: se deja. Si sólo se ha
    // saturado algún canal (un fondo blanco teñido), los demás siguen
    // diciendo cuál es la dominante.
    if(tL > 0 && T.clipWhite <= 0.003) hi = P.white + (encF(T.light[c]) - Ye(T.light)) * tL;
    lo = clamp(lo, 0, 0.45); hi = clamp(hi, Math.max(0.55, lo + 0.2), 1);
    out[c] = { lo, hi };
  }
  return out;
}

/* ── Medios neutros por canal («ajustar medios tonos neutros») ──
   Gamma de cada canal para que el gris medio de la foto (tras el
   estiramiento de cada canal) quede neutro. */
export function neutralGammas(cast, chan, P, strength = 1){
  if(!cast.neutral) return [1, 1, 1];
  const n = cast.neutral, Yn = LUMA[0] * n[0] + LUMA[1] * n[1] + LUMA[2] * n[2];
  if(Yn <= 0) return [1, 1, 1];
  const eY = encF(Yn), k = clamp(cast.conf, 0, 1) * strength * clamp(1 - (cast.domFrac - 0.3) / 0.4, 0.35, 1);
  // Luminancia del gris tras el estiramiento común (referencia)
  const t = clamp((eY - P.black) / Math.max(1e-3, P.white - P.black), 0.05, 0.95);
  return [0, 1, 2].map(c => {
    const m = clamp((encF(n[c]) - chan[c].lo) / Math.max(1e-3, chan[c].hi - chan[c].lo), 0.05, 0.95);
    const g = clamp(Math.log(m) / Math.log(t), 0.75, 1.33);
    return +(1 + (g - 1) * k).toFixed(3);
  });
}
