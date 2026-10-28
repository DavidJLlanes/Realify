/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · PROYECCIONES Y ORIENTACIÓN DEL MUNDO
   Matemática pura (sin OpenCV ni DOM). Ejes: x a la derecha, y hacia
   abajo, z hacia delante (la foto central mira a +z). Cada proyección
   lleva un rayo del mundo a un punto del mosaico (px, con la focal `f`)
   y a la inversa.
     cyl     cilíndrica        x = f·λ, y = f·tan φ
     sph     esférica          x = f·λ, y = f·φ
     merc    Mercator          x = f·λ, y = f·ln tan(π/4 + φ/2)
     rect    plana             x = f·X/Z, y = f·Y/Z (sólo hasta ~±80°)
     stereo  estereográfica    ρ = 2f·tan(θ/2), θ = ángulo con el eje
     fish    ojo de pez        ρ = f·θ (equidistante)
   ═══════════════════════════════════════════════════════════════ */

export const PROJECTION_IDS = ["cyl", "sph", "merc", "rect", "stereo", "fish"];
/** Proyecciones sin límite de 360° de ancho (las demás se cierran en 2π·f). */
export const UNBOUNDED_WIDTH = new Set(["rect", "stereo", "fish"]);
const MAX_LAT = 85 * Math.PI / 180;

/** Rayo del mundo → [x, y] del mosaico, o null si no se puede proyectar. */
export function project(kind, f, r){
  const n = Math.hypot(r[0], r[1], r[2]);
  if(kind === "rect") return r[2] > 0.05 * n ? [f * r[0] / r[2], f * r[1] / r[2]] : null;
  if(kind === "stereo" || kind === "fish"){
    const c = r[2] / n, h = Math.hypot(r[0], r[1]);
    if(kind === "stereo" && c < -0.95) return null;
    if(h < 1e-12) return c > 0 ? [0, 0] : null;
    const th = Math.acos(Math.max(-1, Math.min(1, c))), rho = kind === "stereo" ? 2 * f * Math.tan(th / 2) : f * th;
    return [rho * r[0] / h, rho * r[1] / h];
  }
  const rho = Math.hypot(r[0], r[2]);
  if(rho < 1e-9) return null;
  const lon = Math.atan2(r[0], r[2]);
  if(kind === "merc"){
    const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, Math.atan2(r[1], rho)));
    return [f * lon, f * Math.log(Math.tan(Math.PI / 4 + lat / 2))];
  }
  return [f * lon, kind === "sph" ? f * Math.atan2(r[1], rho) : f * r[1] / rho];
}

/** Punto (X, Y) del mosaico → rayo del mundo [x, y, z] (no unitario salvo en las proyecciones angulares), o null. */
export function unproject(kind, f, X, Y){
  if(kind === "rect") return [X / f, Y / f, 1];
  if(kind === "stereo" || kind === "fish"){
    const h = Math.hypot(X, Y);
    if(h < 1e-9) return [0, 0, 1];
    const th = kind === "stereo" ? 2 * Math.atan(h / (2 * f)) : h / f;
    if(th >= Math.PI) return null;
    const s = Math.sin(th) / h;
    return [X * s, Y * s, Math.cos(th)];
  }
  const lon = X / f;
  if(kind === "merc"){
    const lat = 2 * Math.atan(Math.exp(Y / f)) - Math.PI / 2;
    return [Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat)];
  }
  const v = Y / f;
  if(kind === "sph") return [Math.sin(lon) * Math.cos(v), Math.sin(v), Math.cos(lon) * Math.cos(v)];
  return [Math.sin(lon), v, Math.cos(lon)];   // cyl
}

/* ── Orientación del mundo (horizonte y vertical) ── */
const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]];
const tr = m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const rad = d => d * Math.PI / 180;

/** Giro del mundo: rumbo (alrededor de la vertical), inclinación (horizonte arriba/abajo) y giro (horizonte torcido), en grados. */
export function worldRotation(yaw = 0, pitch = 0, roll = 0){ return mul(rotZ(rad(roll)), mul(rotX(rad(pitch)), rotY(rad(yaw)))); }

/**
 * Giro Q que deja «arriba» de la escena vertical: lleva la media de los «arriba» de las cámaras (en el mundo) a (0, −1, 0).
 * `R` es mundo→cámara (una por foto, null si no se colocó). Devuelve la identidad si no hay datos o el resultado sería dudoso.
 */
export function levelRotation(R){
  let m = [0, 0, 0], k = 0;
  for(const r of R){ if(!r) continue; const t = tr(r); m[0] -= t[1]; m[1] -= t[4]; m[2] -= t[7]; k++; }   // t·(0,−1,0)
  const len = Math.hypot(m[0], m[1], m[2]);
  if(!k || len < 0.3 * k) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  m = m.map(v => v / len);
  const to = [0, -1, 0], ax = [m[1] * to[2] - m[2] * to[1], m[2] * to[0] - m[0] * to[2], m[0] * to[1] - m[1] * to[0]];
  const s = Math.hypot(ax[0], ax[1], ax[2]), c = m[0] * to[0] + m[1] * to[1] + m[2] * to[2];
  if(s < 1e-9) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const u = ax.map(v => v / s), K = [0, -u[2], u[1], u[2], 0, -u[0], -u[1], u[0], 0], K2 = mul(K, K);
  return [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (i % 4 === 0 ? 1 : 0) + s * K[i] + (1 - c) * K2[i]);   // Rodrigues
}

/** Nuevas poses al girar el mundo con Q: R'ᵢ = Rᵢ·Qᵀ (un rayo r del mundo pasa a Q·r). */
export function rotateWorld(R, Q){ const Qt = tr(Q); return R.map(r => r && mul(r, Qt)); }
