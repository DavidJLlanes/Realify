/* ═══════════════════════════════════════════════════════════════
   EFECTO ESTABILIZAR · MOTOR (puro, sin DOM)
   Estabilización ligera por traslación: estima cuánto se ha movido la imagen entre dos fotogramas correlando sus perfiles de brillo por columnas y por filas (barato, en una
   miniatura de gris), acumula la trayectoria de la cámara y la suaviza con una media exponencial; la corrección es la diferencia entre la trayectoria suave y la real.
   Entradas: miniaturas de gris (Float32Array, w×h). Salidas: { dx, dy } en píxeles de miniatura. Límites: sólo traslación (no rota ni corrige el efecto «rolling shutter»);
   con poco contraste no se fía (devuelve 0). Sustituye a OpenCV.js (9 MB) porque para traslaciones esto basta y no pesa.
   ═══════════════════════════════════════════════════════════════ */

/** Perfiles de gradiente de una miniatura: suma por columnas y por filas de |derivada|. */
export function perfiles(g, w, h){
  const px = new Float32Array(w), py = new Float32Array(h);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const i = y * w + x, v = g[i];
    px[x] += Math.abs(v - (x ? g[i - 1] : v)) ; py[y] += Math.abs(v - (y ? g[i - w] : v));
  }
  return { px, py };
}

/** Desplazamiento d (−max..max) que mejor alinea `b` con `a`: b[i] ≈ a[i−d]. Subpíxel por parábola; 0 si el perfil es plano o la correlación es ambigua. */
export function desplazamiento1D(a, b, max){
  const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let va = 0, vb = 0;
  for(let i = 0; i < n; i++){ va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  if(va < 1e-6 || vb < 1e-6) return 0;
  const err = new Float64Array(2 * max + 1);
  for(let d = -max; d <= max; d++){ let s = 0, c = 0; for(let i = Math.max(0, d); i < Math.min(n, n + d); i++){ const e = (b[i] - mb) - (a[i - d] - ma); s += e * e; c++; } err[d + max] = c > n / 2 ? s / c : Infinity; }
  let k = 0; for(let i = 1; i < err.length; i++) if(err[i] < err[k]) k = i;
  if(!isFinite(err[k])) return 0;
  let sub = 0; if(k > 0 && k < err.length - 1 && isFinite(err[k - 1]) && isFinite(err[k + 1])){ const den = err[k - 1] - 2 * err[k] + err[k + 1]; if(den > 1e-12) sub = 0.5 * (err[k - 1] - err[k + 1]) / den; }
  return k - max + Math.max(-0.5, Math.min(0.5, sub));
}

export function estimar(prev, act, w, h, max = Math.max(2, Math.round(Math.max(w, h) / 12))){
  const a = perfiles(prev, w, h), b = perfiles(act, w, h);
  return { dx: desplazamiento1D(a.px, b.px, Math.min(max, w >> 2)), dy: desplazamiento1D(a.py, b.py, Math.min(max, h >> 2)) };
}

/** Estabilizador con estado. `suavizado` 0..0.98 (más alto = cámara más fija y más recorte). paso(miniatura) → { dx, dy } de corrección (a restar al movimiento). reiniciar() olvida el pasado. */
export function crearEstabilizador({ suavizado = 0.9, limite = Infinity } = {}){
  let prev = null, cum = { x: 0, y: 0 }, suav = { x: 0, y: 0 };
  return {
    reiniciar(){ prev = null; cum = { x: 0, y: 0 }; suav = { x: 0, y: 0 }; },
    paso(g, w, h){
      if(prev && prev.length === g.length){ const m = estimar(prev, g, w, h); cum = { x: cum.x + m.dx, y: cum.y + m.dy }; }
      prev = g; suav = { x: suav.x * suavizado + cum.x * (1 - suavizado), y: suav.y * suavizado + cum.y * (1 - suavizado) };
      const c = v => Math.max(-limite, Math.min(limite, v)); return { dx: c(suav.x - cum.x), dy: c(suav.y - cum.y) };
    }
  };
}
