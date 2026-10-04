/* ═══════════════════════════════════════════════════════════════
   AJUSTES EN COMA FLOTANTE SOBRE ORIGEN DE ALTA PROFUNDIDAD (fase 11)

   Los ajustes de color (`runAdjust`) calculan sobre el lienzo de 8 bits.
   Si la capa trae además un origen de 16 bits (`layer.hiSrc`: RAW
   revelado, PNG/TIFF de 16 bits, AVIF de 10/12), un cálculo de 8 bits
   tira esos bits: una escala estrecha de grises estirada con Niveles sale
   a escalones. Esta interfaz convive con la de siempre:

     runAdjust({ …, compute, float: true })

   `float: true` dice que `compute` es un ajuste de COLOR puro (cada
   píxel sale sólo de su propio color, sin analizar la foto ni mirar a los
   vecinos). Entonces, al aplicar sobre una capa con origen de 16 bits, el
   resultado se calcula en coma flotante a partir de esos 16 bits y la
   capa de filtro nueva conserva los suyos (`hiSrc`), que la exportación de
   alta precisión (core/precision-stack.js) usa tal cual. El lienzo de 8
   bits es el redondeo —con el mismo tramado que el origen— de esos 16
   bits, como exige hisrc.js. Si algo no cuadra (otro tamaño, falta de
   memoria, la función no es numérica) se usa el camino de 8 bits de
   siempre: nada se pierde.

   `float` también admite una función `() => fn` con fn(r, g, b, out) en
   0-255 sin recortar, para los ajustes que ya la tengan.
   ═══════════════════════════════════════════════════════════════ */

import { hiToCanvas8 } from "../core/hisrc.js";

const GRID = 86, STEP = 255 / (GRID - 1), G1 = GRID - 1, S1 = GRID, S2 = GRID * GRID;
const C255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

/** ¿Se puede calcular en coma flotante sobre esta capa? (origen de 16 bits que cubre todo el lienzo) */
export function hiFullCover(layer){
  const hs = layer?.hiSrc;
  if(!hs || !hs.data) return false;
  const W = layer.canvas.width, H = layer.canvas.height;
  return (hs.canvasW || hs.w) === W && (hs.canvasH || hs.h) === H && hs.w === W && hs.h === H && !(hs.x || 0) && !(hs.y || 0) && W * H <= 24e6;
}

/** Rejilla RGB de 86³ nodos (paso 3, enteros exactos) como RGBA de 8 bits, lista para pasarla por cualquier
    cálculo de color de 8 bits. */
export function gridInput(){
  const n = GRID * GRID * GRID, d = new Uint8ClampedArray(n * 4);
  for(let bi = 0, i = 0; bi < GRID; bi++) for(let gi = 0; gi < GRID; gi++) for(let ri = 0; ri < GRID; ri++, i += 4){
    d[i] = Math.round(ri * STEP); d[i + 1] = Math.round(gi * STEP); d[i + 2] = Math.round(bi * STEP); d[i + 3] = 255;
  }
  return { d, n };
}

/** Función de color (r, g, b, out) en 0-255 sin recortar, interpolando de forma trilineal la rejilla `d`
    (la de `gridInput` tras pasar por el cálculo de color de 8 bits). */
export function colorFnFromTable(d){
  const n = GRID * GRID * GRID, T = new Float32Array(n * 3);
  for(let i = 0, j = 0; i < n; i++, j += 4){ T[i * 3] = d[j]; T[i * 3 + 1] = d[j + 1]; T[i * 3 + 2] = d[j + 2]; }
  return (r, g, b, o) => {
    const fr = C255(r) / STEP, fg = C255(g) / STEP, fb = C255(b) / STEP;
    let r0 = fr | 0, g0 = fg | 0, b0 = fb | 0;
    if(r0 >= G1) r0 = G1 - 1; if(g0 >= G1) g0 = G1 - 1; if(b0 >= G1) b0 = G1 - 1;
    const tr = fr - r0, tg = fg - g0, tb = fb - b0;
    const i000 = (b0 * S2 + g0 * S1 + r0) * 3, i100 = i000 + 3, i010 = i000 + S1 * 3, i110 = i010 + 3;
    const i001 = i000 + S2 * 3, i101 = i001 + 3, i011 = i001 + S1 * 3, i111 = i011 + 3;
    for(let c = 0; c < 3; c++){
      const c00 = T[i000 + c] + (T[i100 + c] - T[i000 + c]) * tr, c10 = T[i010 + c] + (T[i110 + c] - T[i010 + c]) * tr;
      const c01 = T[i001 + c] + (T[i101 + c] - T[i001 + c]) * tr, c11 = T[i011 + c] + (T[i111 + c] - T[i011 + c]) * tr;
      const c0 = c00 + (c10 - c00) * tg, c1 = c01 + (c11 - c01) * tg;
      o[c] = c0 + (c1 - c0) * tb;
    }
  };
}

/**
 * Función de color en coma flotante a partir de un `compute(data, w, h)` de 8 bits que sólo mira el color
 * de cada píxel: se evalúa en una rejilla RGB de 86³ nodos (paso 3, valores enteros exactos) y se
 * interpola de forma trilineal.
 */
export function colorFnFromCompute(compute){
  const { d, n } = gridInput();
  compute(d, n, 1);
  return colorFnFromTable(d);
}

/**
 * Aplica `fn` a la capa `base` (con origen de 16 bits que cubre el lienzo) desde `source` (su lienzo de 8 bits
 * tal como está) y devuelve { canvas, hi } con el resultado: lienzo de 8 bits (redondeo tramado de `hi`) y los
 * 16 bits nuevos (Uint16Array RGB). `selection`: mezcla por la selección, igual que blendBySelection.
 * Devuelve null si `fn` da algo que no es un número.
 */
export async function applyFloatFromBase(base, source, fn, selection = null){
  const hs = base.hiSrc, W = source.width, H = source.height, out = new Uint16Array(W * H * 3);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const cx = cv.getContext("2d", { willReadFrequently: true }), sx = source.getContext("2d", { willReadFrequently: true });
  const rows = Math.max(16, Math.floor(1.5e6 / W)), o = [0, 0, 0];
  const mask = selection?.mask, mw = selection?.w, mh = selection?.h;
  for(let y0 = 0; y0 < H; y0 += rows){
    const bh = Math.min(rows, H - y0), img = sx.getImageData(0, y0, W, bh), d = img.data;
    for(let p = 0, i = 0; p < W * bh; p++, i += 4){
      const x = p % W, y = y0 + (p / W | 0), j = (y * W + x) * 3, a = d[i + 3];
      const R = hs.data[j], G = hs.data[j + 1], B = hs.data[j + 2];
      if(a === 0){ out[j] = R; out[j + 1] = G; out[j + 2] = B; continue; }
      // Los 16 bits mandan donde el lienzo sigue siendo su redondeo; si se pintó encima, manda el lienzo
      let r, g, b;
      if(hiToCanvas8(R, x, y, 0, hs.dither) === d[i] && hiToCanvas8(G, x, y, 1, hs.dither) === d[i + 1] && hiToCanvas8(B, x, y, 2, hs.dither) === d[i + 2]){ r = R / 257; g = G / 257; b = B / 257; }
      else { r = d[i]; g = d[i + 1]; b = d[i + 2]; }
      fn(r, g, b, o);
      if(!(o[0] === o[0] && o[1] === o[1] && o[2] === o[2])) return null;       // NaN
      let r2 = C255(o[0]), g2 = C255(o[1]), b2 = C255(o[2]);
      if(mask){
        const mx = mw === W ? x : Math.min(mw - 1, (x * mw / W) | 0), my = mh === H ? y : Math.min(mh - 1, (y * mh / H) | 0), t = mask[my * mw + mx] / 255;
        if(t < 1){ r2 = r + (r2 - r) * t; g2 = g + (g2 - g) * t; b2 = b + (b2 - b) * t; }
      }
      const nr = Math.round(r2 * 257), ng = Math.round(g2 * 257), nb = Math.round(b2 * 257);
      out[j] = nr; out[j + 1] = ng; out[j + 2] = nb;
      d[i] = hiToCanvas8(nr, x, y, 0, hs.dither); d[i + 1] = hiToCanvas8(ng, x, y, 1, hs.dither); d[i + 2] = hiToCanvas8(nb, x, y, 2, hs.dither);
    }
    cx.putImageData(img, 0, y0);
    await new Promise(r => setTimeout(r, 0));
  }
  return { canvas: cv, hi: out };
}
