/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · CAMPO
   Campo de desplazamiento en una rejilla gruesa (cada `paso` píxeles). Es un mapa «hacia atrás»: el píxel de salida (x, y) toma su
   color de la posición (x + dx, y + dy) de la foto original. Así cualquier píxel de salida tiene color y no quedan huecos.
   Entradas: tamaño de la imagen y paso. Salidas: objeto { W, H, paso, gw, gh, dx, dy } (Float32Array por nodo).
   Límites: sin DOM; la rejilla se interpola de forma bilineal (el paso por defecto, 8 px, es suficiente para campos suaves).
   ═══════════════════════════════════════════════════════════════ */

export function crearCampo(W, H, paso = 8){
  const gw = Math.max(2, Math.ceil((W - 1) / paso) + 1), gh = Math.max(2, Math.ceil((H - 1) / paso) + 1);
  return { W, H, paso, gw, gh, dx: new Float32Array(gw * gh), dy: new Float32Array(gw * gh) };
}

/* Desplazamiento (bilineal) en el punto (x, y) en píxeles de la imagen. */
export function muestrear(c, x, y, out = [0, 0]){
  const fx = Math.min(Math.max(x / c.paso, 0), c.gw - 1), fy = Math.min(Math.max(y / c.paso, 0), c.gh - 1);
  const i = Math.min(Math.floor(fx), c.gw - 2), j = Math.min(Math.floor(fy), c.gh - 2), u = fx - i, v = fy - j;
  const a = j * c.gw + i, b = a + 1, d = a + c.gw, e = d + 1;
  const w0 = (1 - u) * (1 - v), w1 = u * (1 - v), w2 = (1 - u) * v, w3 = u * v;
  out[0] = c.dx[a] * w0 + c.dx[b] * w1 + c.dx[d] * w2 + c.dx[e] * w3;
  out[1] = c.dy[a] * w0 + c.dy[b] * w1 + c.dy[d] * w2 + c.dy[e] * w3;
  return out;
}

export function copiarCampo(c){ return { ...c, dx: c.dx.slice(), dy: c.dy.slice() }; }

export function escalarCampo(c, t){
  const r = copiarCampo(c);
  for(let i = 0; i < r.dx.length; i++){ r.dx[i] *= t; r.dy[i] *= t; }
  return r;
}

/* Punto de la foto original (sx, sy) → dónde acaba en la salida. Resuelve x + d(x) = s por iteraciones de punto fijo. */
export function adelante(c, sx, sy, iter = 60){
  let x = sx, y = sy; const d = [0, 0];
  for(let k = 0; k < iter; k++){ muestrear(c, x, y, d); x = sx - d[0]; y = sy - d[1]; }
  muestrear(c, x, y, d);
  return { x, y, residuo: Math.hypot(x + d[0] - sx, y + d[1] - sy) };
}

/* Desplazamiento máximo (px) del campo. */
export function maximo(c){
  let m = 0; for(let i = 0; i < c.dx.length; i++) m = Math.max(m, Math.hypot(c.dx[i], c.dy[i]));
  return m;
}
