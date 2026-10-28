/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · AJUSTE DE HACES (giro puro)
   Refina a la vez la focal común y el giro de cada foto con TODAS las
   coincidencias, en vez de encadenar pareja a pareja (donde los errores
   se acumulan hasta el final de la panorámica).

   Modelo: un punto (x, y) de la foto A es el rayo R_A·K_A⁻¹·(x, y, 1);
   en la foto B cae en K_B·R_Bᵀ·rayo. El residuo es la distancia, en
   píxeles, al punto que se vio de verdad en B. Se minimiza la pérdida de
   Huber (las falsas coincidencias pesan poco) con Levenberg–Marquardt.
   Incógnitas: log(focal) y un giro pequeño por foto (menos la fija).
   Es matemática pura (sin OpenCV ni DOM): se prueba en Node.
   Las matrices son 3×3 en array de 9, por filas, como en rotation.js.
   ═══════════════════════════════════════════════════════════════ */

const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]];
const EPS = 1e-6;

/** Rotación de ángulo |w| alrededor del eje w (Rodrigues). */
export function expRot(w0, w1, w2){
  const t = Math.hypot(w0, w1, w2);
  if(t < 1e-12) return [1, -w2, w1, w2, 1, -w0, -w1, w0, 1];
  const x = w0 / t, y = w1 / t, z = w2 / t, c = Math.cos(t), s = Math.sin(t), k = 1 - c;
  return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
}
const AXIS = [expRot(EPS, 0, 0), expRot(0, EPS, 0), expRot(0, 0, EPS)];

/** Ángulo (grados) de la rotación Aᵀ·B. */
export function angleBetween(A, B){
  let tr = 0; for(let i = 0; i < 9; i++) tr += A[i] * B[i];
  return Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) * 180 / Math.PI;
}

/** Resuelve A·x = b (A simétrica definida positiva n×n, array plano) por eliminación; null si es singular. */
function solve(A, b, n){
  const M = A.slice(), x = b.slice();
  for(let c = 0; c < n; c++){
    let p = c; for(let r = c + 1; r < n; r++) if(Math.abs(M[r * n + c]) > Math.abs(M[p * n + c])) p = r;
    if(Math.abs(M[p * n + c]) < 1e-14) return null;
    if(p !== c){ for(let k = 0; k < n; k++){ const t = M[c * n + k]; M[c * n + k] = M[p * n + k]; M[p * n + k] = t; } const t = x[c]; x[c] = x[p]; x[p] = t; }
    for(let r = c + 1; r < n; r++){
      const m = M[r * n + c] / M[c * n + c]; if(!m) continue;
      for(let k = c; k < n; k++) M[r * n + k] -= m * M[c * n + k];
      x[r] -= m * x[c];
    }
  }
  for(let r = n - 1; r >= 0; r--){ let s = x[r]; for(let k = r + 1; k < n; k++) s -= M[r * n + k] * x[k]; x[r] = s / M[r * n + r]; }
  return x;
}

/** Punto sin distorsión de uno medido (coordenadas normalizadas por la focal): x·(1 + k1·r² + k2·r⁴). */
export const undistort = (x, y, K) => { const r2 = x * x + y * y, s = 1 + K[0] * r2 + K[1] * r2 * r2; return [x * s, y * s]; };

/**
 * @param R        giro de cada foto (array de 9, cámara→mundo) o null si no está colocada
 * @param f        focal inicial (px)
 * @param centers  [{cx, cy}] centro de cada foto (px)
 * @param obs      [{ a, b, pts, weight? }]: `pts` = [xa, ya, xb, yb, …] — punto en la foto `a` y su pareja en la foto `b`; `weight` (1 por defecto) lo que pesa la pareja
 * @param fixed    índice de la foto que no se mueve (referencia)
 * @param huber    umbral (px) a partir del cual una coincidencia pesa menos
 * @param loss     "huber" (por defecto) o "cauchy": pérdida que ignora casi del todo las coincidencias muy lejanas (necesaria al ajustar la lente: las falsas coincidencias tiran de la distorsión)
 * @param distortion  0: sin distorsión · 1: se ajusta k1 · 2: k1 y k2 (radial, común a todas las fotos, en coordenadas normalizadas por la focal)
 * @param k        distorsión inicial [k1, k2]
 * @returns { R, f, k, medBefore, medAfter, iters, count } (R, f y k iniciales si no mejora)
 */
export function refineCamera({ R, f, centers, obs, fixed, huber = 2, maxIter = 40, distortion = 0, k = [0, 0], loss = "huber" }){
  const n = R.length, ia = [], ib = [], P = [], wt = [], nk = distortion;
  for(const o of obs){
    if(!R[o.a] || !R[o.b] || o.a === o.b) continue;
    for(let q = 0; q + 3 < o.pts.length; q += 4){ ia.push(o.a); ib.push(o.b); P.push(o.pts[q], o.pts[q + 1], o.pts[q + 2], o.pts[q + 3]); wt.push(o.weight ?? 1); }
  }
  const N = ia.length, free = [], col = Array(n).fill(-1);
  for(let i = 0; i < n; i++) if(R[i] && i !== fixed){ col[i] = 1 + nk + 3 * free.length; free.push(i); }
  const dim = 1 + nk + 3 * free.length;
  if(N < 6 || !free.length) return { R, f, k, medBefore: null, medAfter: null, iters: 0, count: N, rejected: true };

  let Rc = R.map(r => r && r.slice()), fc = f, Kc = [k[0], k[1]];
  // Residuo (px) de la observación q con los giros Ra, Rb, la focal ff y la distorsión K; null si el rayo cae detrás de la cámara.
  // Se compara en el plano SIN distorsión de la foto B: así no hace falta invertir el polinomio.
  const resid = (q, Ra, Rb, ff, K) => {
    const a = ia[q], b = ib[q], [x, y] = undistort((P[4 * q] - centers[a].cx) / ff, (P[4 * q + 1] - centers[a].cy) / ff, K);
    const dx = Ra[0] * x + Ra[1] * y + Ra[2], dy = Ra[3] * x + Ra[4] * y + Ra[5], dz = Ra[6] * x + Ra[7] * y + Ra[8];
    const u = Rb[0] * dx + Rb[3] * dy + Rb[6] * dz, v = Rb[1] * dx + Rb[4] * dy + Rb[7] * dz, w = Rb[2] * dx + Rb[5] * dy + Rb[8] * dz;
    if(w < 1e-6) return null;
    const [tx, ty] = undistort((P[4 * q + 2] - centers[b].cx) / ff, (P[4 * q + 3] - centers[b].cy) / ff, K);
    return [ff * (u / w - tx), ff * (v / w - ty)];
  };
  const cc = 2 * huber, cauchy = loss === "cauchy";
  const rho = r => cauchy ? 0.5 * cc * cc * Math.log(1 + (r / cc) ** 2) : r <= huber ? 0.5 * r * r : huber * (r - 0.5 * huber);
  const weight = r => cauchy ? 1 / (1 + (r / cc) ** 2) : r <= huber ? 1 : huber / r;
  const cost = (Rs, ff, K) => { let c = 0; for(let q = 0; q < N; q++){ const r = resid(q, Rs[ia[q]], Rs[ib[q]], ff, K); c += r ? rho(Math.hypot(r[0], r[1])) : 0.5 * 1e6; } return c; };
  const median = (Rs, ff, K) => { const d = []; for(let q = 0; q < N; q++){ const r = resid(q, Rs[ia[q]], Rs[ib[q]], ff, K); d.push(r ? Math.hypot(r[0], r[1]) : 1e6); } d.sort((p, q) => p - q); return d[d.length >> 1]; };

  const medBefore = median(Rc, fc, Kc);
  let lambda = 1e-3, c0 = cost(Rc, fc, Kc), iters = 0, done = false;
  for(; iters < maxIter && !done; iters++){
    const H = new Float64Array(dim * dim), g = new Float64Array(dim);
    // Giros de prueba (una vez por foto y eje) para las derivadas numéricas
    const pert = Rc.map((r, i) => r && col[i] >= 0 ? AXIS.map(A => mul(A, r)) : null), fe = fc * Math.exp(EPS);
    for(let q = 0; q < N; q++){
      const a = ia[q], b = ib[q], Ra = Rc[a], Rb = Rc[b], r0 = resid(q, Ra, Rb, fc, Kc);
      if(!r0) continue;
      const nr = Math.hypot(r0[0], r0[1]), w = weight(nr) * wt[q];
      const rf = resid(q, Ra, Rb, fe, Kc) || r0, idx = [0], jx = [rf[0] - r0[0]], jy = [rf[1] - r0[1]];
      for(let t = 0; t < nk; t++){
        const K2 = Kc.slice(); K2[t] += EPS; const rk = resid(q, Ra, Rb, fc, K2) || r0;
        idx.push(1 + t); jx.push(rk[0] - r0[0]); jy.push(rk[1] - r0[1]);
      }
      for(const [img, isA] of [[a, true], [b, false]]) if(col[img] >= 0) for(let t = 0; t < 3; t++){
        const r1 = isA ? resid(q, pert[img][t], Rb, fc, Kc) : resid(q, Ra, pert[img][t], fc, Kc); if(!r1) continue;
        idx.push(col[img] + t); jx.push(r1[0] - r0[0]); jy.push(r1[1] - r0[1]);
      }
      for(let p = 0; p < idx.length; p++){
        const gx = jx[p] / EPS, gy = jy[p] / EPS;
        g[idx[p]] += w * (gx * r0[0] + gy * r0[1]);
        for(let m = 0; m < idx.length; m++) H[idx[p] * dim + idx[m]] += w * (gx * jx[m] / EPS + gy * jy[m] / EPS);
      }
    }
    let accepted = false;
    for(let tries = 0; tries < 8 && !accepted; tries++){
      const A = Array.from(H); for(let i = 0; i < dim; i++) A[i * dim + i] += lambda * (H[i * dim + i] + 1e-9);
      const d = solve(A, Array.from(g, v => -v), dim);
      if(!d || !d.every(Number.isFinite)){ lambda *= 10; continue; }
      const Rn = Rc.map((r, i) => r && col[i] >= 0 ? mul(expRot(d[col[i]], d[col[i] + 1], d[col[i] + 2]), r) : r), fn = fc * Math.exp(d[0]), Kn = Kc.map((v, t) => t < nk ? v + d[1 + t] : v), cn = cost(Rn, fn, Kn);
      if(Number.isFinite(cn) && cn < c0){
        const step = Math.hypot(...d), rel = (c0 - cn) / (c0 + 1e-12);
        Rc = Rn; fc = fn; Kc = Kn; c0 = cn; lambda = Math.max(lambda / 3, 1e-9); accepted = true;
        if(step < 1e-9 || rel < 1e-9) done = true;
      } else lambda *= 4;
    }
    if(!accepted) break;
  }
  const medAfter = median(Rc, fc, Kc);
  if(!(medAfter <= medBefore) || !Number.isFinite(fc) || !Kc.every(Number.isFinite) || !Rc.every(r => !r || r.every(Number.isFinite))) return { R, f, k, medBefore, medAfter, iters, count: N, rejected: true };
  return { R: Rc, f: fc, k: Kc, medBefore, medAfter, iters, count: N };
}

/** Mediana (px) del residuo de una pareja con los giros y la focal dados; Infinity si no hay ninguna coincidencia válida. */
export function medianResidual({ R, f, centers, ob }){
  const Ra = R[ob.a], Rb = R[ob.b], d = [];
  for(let k = 0; k + 3 < ob.pts.length; k += 4){
    const x = (ob.pts[k] - centers[ob.a].cx) / f, y = (ob.pts[k + 1] - centers[ob.a].cy) / f;
    const dx = Ra[0] * x + Ra[1] * y + Ra[2], dy = Ra[3] * x + Ra[4] * y + Ra[5], dz = Ra[6] * x + Ra[7] * y + Ra[8];
    const u = Rb[0] * dx + Rb[3] * dy + Rb[6] * dz, v = Rb[1] * dx + Rb[4] * dy + Rb[7] * dz, w = Rb[2] * dx + Rb[5] * dy + Rb[8] * dz;
    d.push(w < 1e-6 ? Infinity : Math.hypot(f * u / w + centers[ob.b].cx - ob.pts[k + 2], f * v / w + centers[ob.b].cy - ob.pts[k + 3]));
  }
  d.sort((p, q) => p - q);
  return d.length ? d[d.length >> 1] : Infinity;
}
