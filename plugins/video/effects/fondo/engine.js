/* ═══════════════════════════════════════════════════════════════
   EFECTO FONDO · MOTOR DE PÍXELES (puro, sin DOM)
   Tres piezas: suavizado temporal del alfa (para que el borde no tiemble entre fotogramas), escalado bilinear del alfa del modelo (n×n) al tamaño del fotograma y composición
   sujeto/fondo. Entradas: Float32Array de alfa 0..1 y RGBA de 8 bits. Salidas: arrays nuevos o modificados in situ (se indica). Sin modelo ni DOM: se prueba en Node.
   Límites: el suavizado asume fotogramas consecutivos; si la escena cambia de golpe (corte) se reinicia solo.
   ═══════════════════════════════════════════════════════════════ */

/** Mezcla exponencial del alfa anterior con el actual. `k` 0..0.95 = peso del pasado. Si el alfa cambia en media más de `corte`, es un corte de escena: se toma el actual. */
export function suavizarTemporal(previo, actual, k, corte = 0.18){
  if(!previo || previo.length !== actual.length || k <= 0) return actual;
  let d = 0; for(let i = 0; i < actual.length; i += 7) d += Math.abs(actual[i] - previo[i]); if(d / Math.ceil(actual.length / 7) > corte) return actual;
  const o = new Float32Array(actual.length); for(let i = 0; i < o.length; i++) o[i] = previo[i] * k + actual[i] * (1 - k); return o;
}

export function escalarAlfa(a, n, W, H){
  const o = new Float32Array(W * H), sx = (n - 1) / Math.max(1, W - 1), sy = (n - 1) / Math.max(1, H - 1);
  for(let y = 0; y < H; y++){
    const fy = y * sy, y0 = Math.floor(fy), y1 = Math.min(n - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < W; x++){
      const fx = x * sx, x0 = Math.floor(fx), x1 = Math.min(n - 1, x0 + 1), tx = fx - x0;
      o[y * W + x] = (a[y0 * n + x0] * (1 - tx) + a[y0 * n + x1] * tx) * (1 - ty) + (a[y1 * n + x0] * (1 - tx) + a[y1 * n + x1] * tx) * ty;
    }
  }
  return o;
}

/** Curva que endurece el alfa (los modelos dan medios tonos blandos): `dureza` 0..1; 0 = tal cual. */
export const endurecer = (a, dureza) => { if(dureza <= 0) return a; const lo = 0.5 * dureza * 0.6, hi = 1 - lo, o = new Float32Array(a.length); for(let i = 0; i < o.length; i++){ const t = (a[i] - lo) / (hi - lo); o[i] = t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); } return o; };

/** Pone `fondo` (RGBA) donde el alfa es bajo: res = sujeto·α + fondo·(1−α). Modifica `rgba` y lo devuelve. */
export function componer(rgba, fondo, alfa){
  for(let p = 0, i = 0; p < alfa.length; p++, i += 4){ const a = alfa[p], b = 1 - a; rgba[i] = rgba[i] * a + fondo[i] * b; rgba[i + 1] = rgba[i + 1] * a + fondo[i + 1] * b; rgba[i + 2] = rgba[i + 2] * a + fondo[i + 2] * b; }
  return rgba;
}
