/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · RENDER DE PLANOS EN COMA FLOTANTE
   Aplica el campo a planos Float32 (p. ej. R, G, B en luz lineal del editor de cara) con remuestreo bicúbico Catmull-Rom, sin pasar por 8 bits.
   Entradas: lista de planos Float32Array W×H, ancho, alto y campo. Salida: lista de planos nuevos. Sin DOM.
   ═══════════════════════════════════════════════════════════════ */
const pesos = (t, w) => { const t2 = t * t, t3 = t2 * t; w[0] = -0.5 * t3 + t2 - 0.5 * t; w[1] = 1.5 * t3 - 2.5 * t2 + 1; w[2] = -1.5 * t3 + 2 * t2 + 0.5 * t; w[3] = 0.5 * t3 - 0.5 * t2; };

export function deformarPlanos(planos, W, H, c){
  const out = planos.map(() => new Float32Array(W * H)), wx = new Float32Array(4), wy = new Float32Array(4), p = c.paso, gw = c.gw, gh = c.gh;
  for(let y = 0; y < H; y++){
    const fy = Math.min(y / p, gh - 1), j = Math.min(Math.floor(fy), gh - 2), v = fy - j;
    for(let x = 0; x < W; x++){
      const fx = Math.min(x / p, gw - 1), i = Math.min(Math.floor(fx), gw - 2), u = fx - i, a = j * gw + i, b = a + 1, d = a + gw, e = d + 1;
      const sx = x + c.dx[a] * (1 - u) * (1 - v) + c.dx[b] * u * (1 - v) + c.dx[d] * (1 - u) * v + c.dx[e] * u * v;
      const sy = y + c.dy[a] * (1 - u) * (1 - v) + c.dy[b] * u * (1 - v) + c.dy[d] * (1 - u) * v + c.dy[e] * u * v;
      const ix = Math.floor(sx), iy = Math.floor(sy); pesos(sx - ix, wx); pesos(sy - iy, wy);
      for(let k = 0; k < planos.length; k++){
        const P = planos[k]; let s = 0;
        for(let m = 0; m < 4; m++){ const yy = Math.min(H - 1, Math.max(0, iy - 1 + m)) * W; for(let n = 0; n < 4; n++) s += P[yy + Math.min(W - 1, Math.max(0, ix - 1 + n))] * wx[n] * wy[m]; }
        out[k][y * W + x] = s < 0 ? 0 : s;
      }
    }
  }
  return out;
}
