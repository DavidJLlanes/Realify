/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · RENDER EN CPU
   Aplica el campo (field.js) a una imagen RGBA de 8 bits con remuestreo bicúbico (Catmull-Rom) en coma flotante y, por defecto, en
   luz lineal y con alfa premultiplicado (los recortes no se manchan en el borde). Se procesa fila a fila: no se crea ninguna copia
   en coma flotante de la imagen. Es el respaldo del render por GPU y lo que usa el worker.
   Entradas: Uint8ClampedArray RGBA, ancho, alto, campo y { lineal }. Salida: Uint8ClampedArray nueva. Sin DOM.
   ═══════════════════════════════════════════════════════════════ */

const DEC = new Float32Array(256), ENC_N = 4096, ENC = new Uint8Array(ENC_N + 1);
for(let i = 0; i < 256; i++){ const s = i / 255; DEC[i] = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }
for(let i = 0; i <= ENC_N; i++){ const l = i / ENC_N; ENC[i] = Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055)); }
const LIN = new Float32Array(256); for(let i = 0; i < 256; i++) LIN[i] = i / 255;

/* Pesos de Catmull-Rom para la fracción t. */
function pesos(t, w){
  const t2 = t * t, t3 = t2 * t;
  w[0] = -0.5 * t3 + t2 - 0.5 * t; w[1] = 1.5 * t3 - 2.5 * t2 + 1; w[2] = -1.5 * t3 + 2 * t2 + 0.5 * t; w[3] = 0.5 * t3 - 0.5 * t2;
}

export function deformarCPU(src, W, H, c, { lineal = true, fila0 = 0, fila1 = H } = {}){
  const out = new Uint8ClampedArray(W * H * 4), dec = lineal ? DEC : LIN;
  const wx = new Float32Array(4), wy = new Float32Array(4), p = c.paso, gw = c.gw, gh = c.gh;
  for(let y = fila0; y < fila1; y++){
    const fy = Math.min(y / p, gh - 1), j = Math.min(Math.floor(fy), gh - 2), v = fy - j;
    for(let x = 0; x < W; x++){
      const fx = Math.min(x / p, gw - 1), i = Math.min(Math.floor(fx), gw - 2), u = fx - i;
      const a = j * gw + i, b = a + 1, d = a + gw, e = d + 1;
      const w0 = (1 - u) * (1 - v), w1 = u * (1 - v), w2 = (1 - u) * v, w3 = u * v;
      const sx = x + c.dx[a] * w0 + c.dx[b] * w1 + c.dx[d] * w2 + c.dx[e] * w3;
      const sy = y + c.dy[a] * w0 + c.dy[b] * w1 + c.dy[d] * w2 + c.dy[e] * w3;
      const ix = Math.floor(sx), iy = Math.floor(sy);
      pesos(sx - ix, wx); pesos(sy - iy, wy);
      let R = 0, G = 0, B = 0, A = 0;
      for(let m = 0; m < 4; m++){
        const yy = Math.min(H - 1, Math.max(0, iy - 1 + m)) * W;
        for(let n = 0; n < 4; n++){
          const o = (yy + Math.min(W - 1, Math.max(0, ix - 1 + n))) * 4, k = wx[n] * wy[m], al = src[o + 3] / 255 * k;
          R += dec[src[o]] * al; G += dec[src[o + 1]] * al; B += dec[src[o + 2]] * al; A += al;
        }
      }
      const q = (y * W + x) * 4;
      A = A < 0 ? 0 : A > 1 ? 1 : A;
      if(A < 1e-4){ continue; }
      const inv = 1 / (A < 1 ? A : 1);
      let r = R * inv, g = G * inv, bl = B * inv;
      r = r < 0 ? 0 : r > 1 ? 1 : r; g = g < 0 ? 0 : g > 1 ? 1 : g; bl = bl < 0 ? 0 : bl > 1 ? 1 : bl;
      if(lineal){ out[q] = ENC[(r * ENC_N + 0.5) | 0]; out[q + 1] = ENC[(g * ENC_N + 0.5) | 0]; out[q + 2] = ENC[(bl * ENC_N + 0.5) | 0]; }
      else { out[q] = r * 255 + 0.5; out[q + 1] = g * 255 + 0.5; out[q + 2] = bl * 255 + 0.5; }
      out[q + 3] = A * 255 + 0.5;
    }
  }
  return out;
}
