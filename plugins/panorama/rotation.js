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
   Límites: no hay ajuste global de bloques; con paralaje fuerte (objetos
   cercanos y lejanos a la vez) quedan dobles en los solapes.
   ═══════════════════════════════════════════════════════════════ */

import { createPairMatcher, mmul, minv } from "../../js/cv/align.js";

/** Más fotos que esto: se respeta el orden dado (comparar todas las parejas costaría demasiado). */
const MAX_AUTO_ORDER = 10;
/** Lado (px) y mínimo de coincidencias con que se compara cada pareja para ORDENAR las fotos (más baratos que para alinearlas). */
const ORDER_FEATURES = 1500, ORDER_SIDE = 640, ORDER_MIN_INLIERS = 10;
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
 * Devuelve { R (por foto, null si no se pudo colocar), f (px de `set`), order, found, info, fEstimated }.
 */
export async function solveCamera(cv, set, { minInliers = 18, maxSide = 1600, autoOrder = true, onProgress = null } = {}){
  const n = set.length;
  // Orden: coincidencias entre todas las parejas a baja resolución (barato) y camino que más puntos reúne
  let order = set.map((_, i) => i);
  if(autoOrder && n > 2 && n <= MAX_AUTO_ORDER){
    const rough = createPairMatcher(cv, set, { maxSide: ORDER_SIDE, features: ORDER_FEATURES }), score = Array.from({ length: n }, () => Array(n).fill(0));
    try{
      let done = 0;
      const total = n * (n - 1) / 2;
      for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){
        onProgress?.(`Ordenando las fotos (${++done} de ${total})…`);
        await tick();
        score[i][j] = score[j][i] = rough.match(i, j, { minInliers: ORDER_MIN_INLIERS })?.inliers || 0;
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
      links.push({ ref, img, pr: pairs.match(ref, img, { minInliers }) });   // H lleva `img` a `ref`
    }
    // Focal: mediana de lo que dice cada pareja (en coordenadas centradas en cada foto)
    const focals = [];
    for(const { ref, img, pr } of links){
      if(!pr) continue;
      const H = mmul(mmul(shift(-set[ref].width / 2, -set[ref].height / 2), pr.H), shift(set[img].width / 2, set[img].height / 2));
      for(const f of focalsFromHomography(H)) if(f > 0.25 * side && f < 6 * side) focals.push(f);
    }
    const estimated = median(focals), f = estimated ?? 0.8 * side;
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
    // Se centra en la foto de en medio (la que queda sin deformar)
    const placedOrder = order.filter(i => R[i]);
    if(placedOrder.length){
      const mid = placedOrder[(placedOrder.length - 1) >> 1], back = tr3(R[mid]);
      for(const i of placedOrder) R[i] = mmul(R[i], back);
    }
    return { R, f, order, found: R.map(Boolean), info, fEstimated: estimated != null };
  } finally { pairs.dispose(); }
}

/**
 * Lleva las fotos colocadas a un cilindro ("cyl") o a una esfera ("sph"). `set` y `cam.f` deben estar a la misma escala
 * (si se calculó la cámara con fotos pequeñas, multiplicar `f` por el cociente de alturas antes de llamar).
 * Devuelve { images:[{ w, h, data (RGBA, alfa 0 fuera de la foto), x, y, i }], W, H } o { error, tooBig? } (`tooBig`: no cabe en `maxArea`).
 */
export async function warpPanorama(cv, set, cam, { projection = "cyl", interp = "linear", maxArea = 16e6, onStep = null } = {}){
  const { R, f } = cam, sph = projection === "sph";
  const idx = set.map((_, i) => i).filter(i => R[i]);
  if(idx.length < 2) return { error: "No se encontró solape suficiente entre las fotos. Revisa que se solapen al menos un tercio." };
  const project = r => {   // rayo del mundo → coordenadas del cilindro / esfera (px)
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
        const d = [(px - c.width / 2) / f, (py - c.height / 2) / f, 1];
        const q = project([Rt[0] * d[0] + Rt[1] * d[1] + Rt[2] * d[2], Rt[3] * d[0] + Rt[4] * d[1] + Rt[5] * d[2], Rt[6] * d[0] + Rt[7] * d[1] + Rt[8] * d[2]]);
        if(!q || !Number.isFinite(q[0]) || !Number.isFinite(q[1]) || Math.abs(q[1]) > 1e6) return { error: "Las fotos abarcan un campo demasiado ancho para esta proyección. Prueba con la esférica o con menos fotos." };
        x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
      }
    }
    const b = { x0: Math.floor(x0) - 1, y0: Math.floor(y0) - 1, x1: Math.ceil(x1) + 1, y1: Math.ceil(y1) + 1 };
    boxes.set(i, b);
    minX = Math.min(minX, b.x0); minY = Math.min(minY, b.y0); maxX = Math.max(maxX, b.x1); maxY = Math.max(maxY, b.y1);
  }
  const W = maxX - minX, H = maxY - minY;
  if(!Number.isFinite(W * H) || W < 8 || H < 8 || W > 2 * Math.PI * f * 0.98) return { error: "Las fotos abarcan un campo demasiado ancho para esta proyección. Prueba con la esférica o con menos fotos." };
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
    for(let x = 0; x < bw; x++){ const th = (b.x0 + x) / f; sinT[x] = Math.sin(th); cosT[x] = Math.cos(th); }
    // Por bandas de filas, para no gastar memoria con el mapa de remuestreo
    const band = Math.max(16, Math.floor(2e6 / bw));
    try{
      for(let y0 = 0; y0 < bh; y0 += band){
        const rows = Math.min(band, bh - y0), map = new Float32Array(bw * rows * 2);
        for(let y = 0; y < rows; y++){
          const v = (b.y0 + y0 + y) / f, A = sph ? Math.cos(v) : 1, B = sph ? Math.sin(v) : v;
          for(let x = 0; x < bw; x++){
            const rx = sinT[x] * A, rz = cosT[x] * A, o = (y * bw + x) * 2;
            const z = r[6] * rx + r[7] * B + r[8] * rz;
            if(z <= 1e-6){ map[o] = -1; map[o + 1] = -1; continue; }
            map[o] = f * (r[0] * rx + r[1] * B + r[2] * rz) / z + cx;
            map[o + 1] = f * (r[3] * rx + r[4] * B + r[5] * rz) / z + cy;
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
  return { images, W, H };
}
