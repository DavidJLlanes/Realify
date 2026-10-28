/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · MODELO DE CÁMARA (GIRO PURO)
   Una panorámica hecha girando sobre uno mismo no se explica con
   homografías planas encadenadas: con un campo ancho los extremos se
   disparan. Aquí se modela la cámara como lo hace un cosedor de verdad:

     1. Puntos ORB + RANSAC entre fotos CONSECUTIVAS (js/cv/align.js ›
        createPairMatcher): una homografía por pareja.
     2. Focal: se estima de esas homografías (fórmulas de Brown y Lowe)
        y se toma la mediana de todas las parejas.
     3. Giros: de cada homografía sale la rotación entre las dos tomas
        (K⁻¹·H·K, la rotación más cercana por descomposición polar). Se
        encadenan y se centran en la foto de en medio, que queda sin
        deformar.
     4. Proyección: cada foto se lleva a un cilindro o a una esfera con
        un solo remuestreo (cv.remap). Salen fotos RGBA con alfa 0 fuera
        de la toma y su posición en el mosaico: lo que espera engine.js ›
        placed / compose para igualar la exposición y mezclar.

   Sólo se alinean fotos consecutivas en el orden dado (o el que salga de
   `orderByOverlap`): un grafo de atajos convertía las falsas coincidencias
   de fachadas repetidas en edificios duplicados (v270).
   Las matrices son 3×3 (array de 9, por filas), como en js/cv/align.js.
   5. Ajuste de haces (bundle.js, v289): focal y giros se refinan a la vez
      con todas las coincidencias; además de las parejas consecutivas entran
      como atajos, con menos peso, las no consecutivas que se solapan, sólo si
      encajan con los giros encadenados (así no vuelven las falsas
      coincidencias de fachadas repetidas).
   6. Lente (v290): si baja el residuo de forma clara, se ajusta también la
      distorsión radial (k1, k2) común a todas las fotos; la proyección final
      la deshace al remuestrear.
   Límites: con paralaje fuerte (objetos
   cercanos y lejanos a la vez) quedan dobles en los solapes.
   ═══════════════════════════════════════════════════════════════ */

import { createPairMatcher, mmul, minv } from "../../js/cv/align.js";
import { refineCamera, medianResidual, undistort } from "./bundle.js";

/** Más fotos que esto: se respeta el orden dado (comparar todas las parejas costaría demasiado). */
const MAX_AUTO_ORDER = 10;
/** Lado (px) y mínimo de coincidencias con que se compara cada pareja para ORDENAR las fotos (más baratos que para alinearlas). */
const ORDER_FEATURES = 1500, ORDER_SIDE = 640, ORDER_MIN_INLIERS = 10;
/** Ajuste de haces: coincidencias que se usan como máximo por pareja, y fracción del campo horizontal por debajo de la cual dos fotos no consecutivas se esperan solapadas. */
const BA_MAX_POINTS = 400, BA_SHORTCUT_FRACTION = 0.8;
/** Una pareja no consecutiva sólo cuenta si, con los giros encadenados, sus puntos caen cerca (px, a 1100 de alto): descarta las falsas coincidencias (fachadas repetidas, v270). */
const BA_SHORTCUT_MAX_RESIDUAL = 30;
/** Los atajos vienen de la ordenación (640 px, menos puntos): pesan menos que las parejas consecutivas, medidas a la resolución completa. */
const BA_SHORTCUT_WEIGHT = 0.3;
/** Lente: sólo se acepta la distorsión si baja el residuo al menos un 20 % (con una lente corregida no hay nada que ajustar y se evita ajustar ruido), si el residuo previo era apreciable (px a 1100 de alto) y si k1 y k2 son plausibles. */
const LENS_MIN_GAIN = 0.8, LENS_MIN_RESIDUAL = 1.2, LENS_MAX_K1 = 0.4, LENS_MAX_K2 = 0.6, LENS_MIN_POINTS = 300;
/** Distancia máxima (norma de Frobenius) entre K⁻¹·H·K y su rotación más cercana; más allá la pareja no es un giro. */
const MAX_NOT_ROTATION = 0.6;

const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const tr3 = m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const det3 = m => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
const shift = (x, y) => [1, 0, x, 0, 1, y, 0, 0, 1];
const kMat = (f, cx, cy) => [f, 0, cx, 0, f, cy, 0, 0, 1];
const kInv = (f, cx, cy) => [1 / f, 0, -cx / f, 0, 1 / f, -cy / f, 0, 0, 1];
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

/** Rotación más cercana a M (previamente escalada a determinante 1) y distancia entre ambas; null si M no es válida. */
export function nearestRotation(M){
  const d = det3(M);
  if(!(d > 1e-12)) return null;
  const k = 1 / Math.cbrt(d), S = M.map(v => v * k);
  let R = S;
  for(let it = 0; it < 40; it++){
    const inv = minv(R);
    if(!inv) return null;
    const invT = tr3(inv), next = R.map((v, i) => 0.5 * (v + invT[i]));
    let diff = 0;
    for(let i = 0; i < 9; i++) diff = Math.max(diff, Math.abs(next[i] - R[i]));
    R = next;
    if(diff < 1e-12) break;
  }
  let err = 0;
  for(let i = 0; i < 9; i++) err += (S[i] - R[i]) ** 2;
  return { R, err: Math.sqrt(err) };
}

/** Focales (0, 1 o 2 valores) que implica una homografía entre dos tomas con la misma cámara, en coordenadas centradas en la foto. */
export function focalsFromHomography(h){
  const out = [];
  let d1 = h[6] * h[7], d2 = (h[7] - h[6]) * (h[7] + h[6]);
  let v1 = -(h[0] * h[1] + h[3] * h[4]) / d1, v2 = (h[0] * h[0] + h[3] * h[3] - h[1] * h[1] - h[4] * h[4]) / d2;
  if(v1 < v2) [v1, v2] = [v2, v1];
  if(v1 > 0 && v2 > 0) out.push(Math.sqrt(Math.abs(d1) > Math.abs(d2) ? v1 : v2));
  else if(v1 > 0) out.push(Math.sqrt(v1));
  d1 = h[0] * h[3] + h[1] * h[4]; d2 = h[0] * h[0] + h[1] * h[1] - h[3] * h[3] - h[4] * h[4];
  v1 = -h[2] * h[5] / d1; v2 = (h[5] * h[5] - h[2] * h[2]) / d2;
  if(v1 < v2) [v1, v2] = [v2, v1];
  if(v1 > 0 && v2 > 0) out.push(Math.sqrt(Math.abs(d1) > Math.abs(d2) ? v1 : v2));
  else if(v1 > 0) out.push(Math.sqrt(v1));
  return out.filter(Number.isFinite);
}

/** Orden de las fotos que maximiza las coincidencias entre consecutivas (camino voraz desde cada extremo posible). */
export function orderByOverlap(score, n){
  let best = null;
  for(let s = 0; s < n; s++){
    const path = [s], used = new Set(path);
    let sum = 0;
    while(path.length < n){
      const t = path[path.length - 1];
      let bj = -1, bv = -1;
      for(let j = 0; j < n; j++) if(!used.has(j) && score(t, j) > bv){ bv = score(t, j); bj = j; }
      path.push(bj); used.add(bj); sum += bv;
    }
    if(!best || sum > best.sum) best = { path, sum };
  }
  return best.path;
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Estima focal y giro de cada foto. `set`: lienzos de la misma altura. Cede el hilo entre pareja y pareja para que la
 * interfaz siga viva; `onProgress(texto)` informa de lo que se está haciendo.
 * `autoOrder:false` respeta el orden dado; `lens:false` no corrige la distorsión de la lente.
 * Devuelve { R (por foto, null si no se pudo colocar), f (px de `set`), order, found, info, fEstimated }.
 */
export async function solveCamera(cv, set, { minInliers = 18, maxSide = 1600, autoOrder = true, lens = true, onProgress = null } = {}){
  const n = set.length;
  // Orden: coincidencias entre todas las parejas a baja resolución (barato) y camino que más puntos reúne
  let order = set.map((_, i) => i);
  const roughMatches = new Map();   // "i:j" → coincidencias de la ordenación (baratas), que luego sirven de atajos en el ajuste
  if(autoOrder && n > 2 && n <= MAX_AUTO_ORDER){
    const rough = createPairMatcher(cv, set, { maxSide: ORDER_SIDE, features: ORDER_FEATURES }), score = Array.from({ length: n }, () => Array(n).fill(0));
    try{
      let done = 0;
      const total = n * (n - 1) / 2;
      for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){
        onProgress?.(`Ordenando las fotos (${++done} de ${total})…`);
        await tick();
        const m = rough.match(i, j, { minInliers: ORDER_MIN_INLIERS, withPoints: true });
        score[i][j] = score[j][i] = m?.inliers || 0;
        if(m?.pts) roughMatches.set(`${i}:${j}`, m);
      }
    } finally { rough.dispose(); }
    order = orderByOverlap((a, b) => score[a][b], n);
  }
  onProgress?.("Analizando las fotos…");
  await tick();
  const pairs = createPairMatcher(cv, set, { maxSide });
  try{
    const side = Math.max(...set.map(c => Math.max(c.width, c.height)));
    const links = [];
    for(let k = 1; k < n; k++){
      onProgress?.(`Buscando coincidencias (${k} de ${n - 1})…`);
      await tick();
      const ref = order[k - 1], img = order[k];
      links.push({ ref, img, pr: pairs.match(ref, img, { minInliers, withPoints: true }) });   // H lleva `img` a `ref`
    }
    // Focal: mediana de lo que dice cada pareja (en coordenadas centradas en cada foto)
    const focals = [];
    for(const { ref, img, pr } of links){
      if(!pr) continue;
      const H = mmul(mmul(shift(-set[ref].width / 2, -set[ref].height / 2), pr.H), shift(set[img].width / 2, set[img].height / 2));
      for(const f of focalsFromHomography(H)) if(f > 0.25 * side && f < 6 * side) focals.push(f);
    }
    const estimated = median(focals); let f = estimated ?? 0.8 * side;
    // Giros encadenados desde la primera foto del orden
    const R = Array(n).fill(null), info = Array(n).fill(null);
    R[order[0]] = I3; info[order[0]] = { inliers: Infinity, via: null };
    for(const { ref, img, pr } of links){
      if(!R[ref] || !pr) continue;
      const M = mmul(mmul(kInv(f, set[ref].width / 2, set[ref].height / 2), pr.H), kMat(f, set[img].width / 2, set[img].height / 2));
      const q = nearestRotation(M);
      if(!q || q.err > MAX_NOT_ROTATION) continue;
      const pose = mmul(tr3(q.R), R[ref]);
      if(!pose.every(Number.isFinite)) continue;
      R[img] = pose; info[img] = { inliers: pr.inliers, via: ref, notRotation: q.err };
    }
    // Ajuste de haces: focal y giros con todas las coincidencias (consecutivas y atajos verificados)
    const ba = { used: false };
    let k = [0, 0];
    try{
      const centers = set.map(c => ({ cx: c.width / 2, cy: c.height / 2 })), scale = Math.min(...set.map(c => c.height)) / 1100;
      const thin = pts => { const m = pts.length / 4; if(m <= BA_MAX_POINTS) return pts; const out = [], step = m / BA_MAX_POINTS; for(let k = 0; k < BA_MAX_POINTS; k++){ const q = Math.floor(k * step) * 4; out.push(pts[q], pts[q + 1], pts[q + 2], pts[q + 3]); } return out; };
      const obs = [];
      for(const { ref, img, pr } of links) if(pr?.pts && R[ref] && R[img]) obs.push({ a: img, b: ref, pts: thin(pr.pts) });
      const nConsecutive = obs.length, pos = new Map(order.map((idx, k) => [idx, k]));
      for(const [key, m] of roughMatches){
        const [ref, img] = key.split(":").map(Number);   // match(ref = i, img = j)
        if(Math.abs(pos.get(ref) - pos.get(img)) < 2 || !R[ref] || !R[img]) continue;
        const hfov = 2 * Math.atan(Math.max(set[ref].width, set[img].width) / (2 * f)), sep = Math.acos(Math.max(-1, Math.min(1, (R[ref].reduce((s, v, k) => s + v * R[img][k], 0) - 1) / 2)));
        if(sep > BA_SHORTCUT_FRACTION * hfov) continue;
        const ob = { a: img, b: ref, pts: thin(m.pts), weight: BA_SHORTCUT_WEIGHT };
        if(medianResidual({ R: R.map(r => r && tr3(r)), f, centers, ob }) < BA_SHORTCUT_MAX_RESIDUAL * scale) obs.push(ob);
      }
      // bundle.js usa R = cámara→mundo; aquí R lleva del mundo a la cámara (pose = M·R_ref con M = K⁻¹·H·K), de ahí las traspuestas
      const out = refineCamera({ R: R.map(r => r && tr3(r)), f, centers, obs, fixed: order[0], huber: 2 * scale });
      Object.assign(ba, { pairs: obs.length, shortcuts: obs.length - nConsecutive, points: out.count, medBefore: out.medBefore, medAfter: out.medAfter, iters: out.iters, rejected: !!out.rejected });
      let best = out;
      if(!out.rejected){
        ba.used = true;
        // Distorsión de lente (k1, k2) común a todas las fotos, con una pérdida que ignora las coincidencias lejanas
        if(lens && out.count >= LENS_MIN_POINTS && out.medAfter > LENS_MIN_RESIDUAL * scale){
          const fit = refineCamera({ R: out.R, f: out.f, centers, obs, fixed: order[0], huber: 2 * scale, distortion: 2, loss: "cauchy" });
          ba.lens = { medAfter: fit.medAfter, k: fit.k, f: fit.f, rejected: !!fit.rejected, accepted: false };
          if(!fit.rejected && fit.medAfter < LENS_MIN_GAIN * out.medAfter && Math.abs(fit.k[0]) < LENS_MAX_K1 && Math.abs(fit.k[1]) < LENS_MAX_K2){ best = fit; ba.lens.accepted = true; }
        }
        for(let i = 0; i < n; i++) R[i] = best.R[i] && tr3(best.R[i]);
        f = best.f; k = best.k ? [best.k[0], best.k[1]] : [0, 0];
      }
    }catch(e){ ba.error = e?.message || String(e); }
    // Se centra en la foto de en medio (la que queda sin deformar)
    const placedOrder = order.filter(i => R[i]);
    if(placedOrder.length){
      const mid = placedOrder[(placedOrder.length - 1) >> 1], back = tr3(R[mid]);
      for(const i of placedOrder) R[i] = mmul(R[i], back);
    }
    return { R, f, k, order, found: R.map(Boolean), info, fEstimated: estimated != null, ba };
  } finally { pairs.dispose(); }
}

/**
 * Lleva las fotos colocadas a un cilindro ("cyl") o a una esfera ("sph"). `set` y `cam.f` deben estar a la misma escala
 * (si se calculó la cámara con fotos pequeñas, multiplicar `f` por el cociente de alturas antes de llamar).
 * Devuelve { images:[{ w, h, data (RGBA, alfa 0 fuera de la foto), x, y, i }], W, H } o { error, tooBig? } (`tooBig`: no cabe en `maxArea`).
 */
export async function warpPanorama(cv, set, cam, { projection = "cyl", interp = "linear", maxArea = 16e6, onStep = null } = {}){
  const { R, f } = cam, sph = projection === "sph", rect = projection === "rect", stereo = projection === "stereo", K = cam.k || [0, 0], lens = K[0] !== 0 || K[1] !== 0;
  const TOO_WIDE = "Las fotos abarcan un campo demasiado ancho para esta proyección. Prueba con la esférica o con menos fotos.";
  const idx = set.map((_, i) => i).filter(i => R[i]);
  if(idx.length < 2) return { error: "No se encontró solape suficiente entre las fotos. Revisa que se solapen al menos un tercio." };
  const project = r => {   // rayo del mundo → coordenadas del mosaico (px)
    if(rect) return r[2] > 0.05 * Math.hypot(r[0], r[1], r[2]) ? [f * r[0] / r[2], f * r[1] / r[2]] : null;
    if(stereo){   // estereográfica: ρ = 2f·tan(θ/2), θ = ángulo con el eje de la foto central
      const n = Math.hypot(r[0], r[1], r[2]), c = r[2] / n; if(c < -0.95) return null;
      const rho2 = 2 * f * Math.tan(Math.acos(Math.max(-1, Math.min(1, c))) / 2), h = Math.hypot(r[0], r[1]);
      return h < 1e-12 ? [0, 0] : [rho2 * r[0] / h, rho2 * r[1] / h];
    }
    const rho = Math.hypot(r[0], r[2]);
    if(rho < 1e-9) return null;
    return [f * Math.atan2(r[0], r[2]), sph ? f * Math.atan2(r[1], rho) : f * r[1] / rho];
  };
  // Huella de cada foto: se proyecta su borde
  const boxes = new Map();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for(const i of idx){
    const c = set[i], Rt = tr3(R[i]), N = 24;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for(let k = 0; k <= N; k++){
      const t = k / N;
      for(const [px, py] of [[t * c.width, 0], [t * c.width, c.height], [0, t * c.height], [c.width, t * c.height]]){
        const [ux, uy] = lens ? undistort((px - c.width / 2) / f, (py - c.height / 2) / f, K) : [(px - c.width / 2) / f, (py - c.height / 2) / f];
        const d = [ux, uy, 1];
        const q = project([Rt[0] * d[0] + Rt[1] * d[1] + Rt[2] * d[2], Rt[3] * d[0] + Rt[4] * d[1] + Rt[5] * d[2], Rt[6] * d[0] + Rt[7] * d[1] + Rt[8] * d[2]]);
        if(!q || !Number.isFinite(q[0]) || !Number.isFinite(q[1]) || Math.abs(q[1]) > 1e6) return { error: TOO_WIDE };
        x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
      }
    }
    const b = { x0: Math.floor(x0) - 1, y0: Math.floor(y0) - 1, x1: Math.ceil(x1) + 1, y1: Math.ceil(y1) + 1 };
    boxes.set(i, b);
    minX = Math.min(minX, b.x0); minY = Math.min(minY, b.y0); maxX = Math.max(maxX, b.x1); maxY = Math.max(maxY, b.y1);
  }
  const W = maxX - minX, H = maxY - minY;
  if(!Number.isFinite(W * H) || W < 8 || H < 8 || (!rect && !stereo && W > 2 * Math.PI * f * 0.98)) return { error: TOO_WIDE };
  if(W * H > maxArea) return { error: "El resultado sería demasiado grande para este dispositivo. Prueba con menos fotos o con menos resolución.", tooBig: true };

  const cvInterp = interp === "lanczos" ? cv.INTER_LANCZOS4 : cv.INTER_LINEAR;
  const images = [];
  let done = 0;
  for(const i of idx){
    onStep?.(done++, idx.length);
    const c = set[i], b = boxes.get(i), bw = b.x1 - b.x0, bh = b.y1 - b.y0, r = R[i];
    const cx = c.width / 2, cy = c.height / 2;
    const srcM = cv.matFromImageData(c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height));
    const data = new Uint8ClampedArray(bw * bh * 4);
    // Senos y cosenos del ángulo de cada columna (no dependen de la fila)
    const sinT = new Float32Array(bw), cosT = new Float32Array(bw);
    if(!rect && !stereo) for(let x = 0; x < bw; x++){ const th = (b.x0 + x) / f; sinT[x] = Math.sin(th); cosT[x] = Math.cos(th); }
    // Por bandas de filas, para no gastar memoria con el mapa de remuestreo
    const band = Math.max(16, Math.floor(2e6 / bw));
    try{
      for(let y0 = 0; y0 < bh; y0 += band){
        const rows = Math.min(band, bh - y0), map = new Float32Array(bw * rows * 2);
        for(let y = 0; y < rows; y++){
          const Yo = b.y0 + y0 + y, v = Yo / f, A = sph ? Math.cos(v) : 1, B = sph ? Math.sin(v) : v;
          for(let x = 0; x < bw; x++){
            let rx, rz, By = B;   // rayo del mundo que cae en este píxel del mosaico
            if(rect){ rx = (b.x0 + x) / f; rz = 1; By = v; }
            else if(stereo){
              const X = b.x0 + x, hh = Math.hypot(X, Yo);
              if(hh < 1e-9){ rx = 0; By = 0; rz = 1; } else { const th = 2 * Math.atan(hh / (2 * f)), k2 = Math.sin(th) / hh; rx = X * k2; By = Yo * k2; rz = Math.cos(th); }
            } else { rx = sinT[x] * A; rz = cosT[x] * A; }
            const o = (y * bw + x) * 2;
            const z = r[6] * rx + r[7] * By + r[8] * rz;
            if(z <= 1e-6){ map[o] = -1; map[o + 1] = -1; continue; }
            let u = (r[0] * rx + r[1] * By + r[2] * rz) / z, w = (r[3] * rx + r[4] * By + r[5] * rz) / z;
            if(lens){   // del plano sin distorsión al medido: se invierte x·(1 + k1·r² + k2·r⁴) por punto fijo
              let xd = u, yd = w;
              for(let it = 0; it < 8; it++){ const r2 = xd * xd + yd * yd, s = 1 + K[0] * r2 + K[1] * r2 * r2; xd = u / s; yd = w / s; }
              u = xd; w = yd;
            }
            map[o] = f * u + cx;
            map[o + 1] = f * w + cy;
          }
        }
        const mm = new cv.Mat(rows, bw, cv.CV_32FC2), dst = new cv.Mat(), none = new cv.Mat();
        try{
          mm.data32F.set(map);
          cv.remap(srcM, dst, mm, none, cvInterp, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
          data.set(dst.data, y0 * bw * 4);
        } finally { mm.delete(); dst.delete(); none.delete(); }
        await new Promise(res => setTimeout(res, 0));
      }
    } finally { srcM.delete(); }
    images.push({ w: bw, h: bh, data, x: b.x0 - minX, y: b.y0 - minY, i });
  }
  onStep?.(idx.length, idx.length);
  return { images, W, H, origin: { x: minX, y: minY } };
}
