/* ═══════════════════════════════════════════════════════════════
   REMUESTREO · WORKER
   Cambio de tamaño separable (primero horizontal, luego vertical) con
   núcleos clásicos —los mismos que ofrece la librería Aire que usa
   ImageToolbox: Lanczos3, Mitchell, Catmull-Rom y bilineal—, en coma
   flotante y con alfa premultiplicado para que los bordes de una capa
   con transparencia no se oscurezcan.

   Al REDUCIR, el núcleo se ensancha en proporción a la escala: cada
   píxel de destino promedia todos los de origen que le tocan, sin el
   aliasing de un muestreo puntual. Al AMPLIAR, el núcleo mantiene su
   tamaño natural.

   La pasada horizontal se calcula fila a fila sólo cuando la vertical
   la necesita y se descarta en cuanto deja de hacerle falta: la
   memoria extra es una ventana de pocas filas, no una copia Float32
   entera de la imagen (que a 24 MP serían cientos de megas).
   ═══════════════════════════════════════════════════════════════ */

const sinc = x => {
  if(x === 0) return 1;
  const px = Math.PI * x;
  return Math.sin(px) / px;
};
/* Filtro cúbico de Mitchell-Netravali con parámetros (B, C). */
const cubic = (B, C) => x => {
  x = Math.abs(x);
  if(x < 1) return ((12 - 9 * B - 6 * C) * x * x * x + (-18 + 12 * B + 6 * C) * x * x + (6 - 2 * B)) / 6;
  if(x < 2) return ((-B - 6 * C) * x * x * x + (6 * B + 30 * C) * x * x + (-12 * B - 48 * C) * x + (8 * B + 24 * C)) / 6;
  return 0;
};

const FILTERS = {
  lanczos3:   { support: 3, fn: x => Math.abs(x) < 3 ? sinc(x) * sinc(x / 3) : 0 },
  mitchell:   { support: 2, fn: cubic(1 / 3, 1 / 3) },
  catmullrom: { support: 2, fn: cubic(0, 0.5) },
  bilinear:   { support: 1, fn: x => Math.max(0, 1 - Math.abs(x)) }
};

/* Para cada píxel de destino: primer píxel de origen y sus pesos,
   ya normalizados (suman 1). */
function contributions(srcLen, dstLen, filter){
  const scale = dstLen / srcLen;
  const stretch = scale < 1 ? 1 / scale : 1;
  const support = filter.support * stretch;
  const first = new Int32Array(dstLen), count = new Int32Array(dstLen);
  const lists = [];
  let maxN = 0;
  for(let i = 0; i < dstLen; i++){
    const center = (i + 0.5) / scale - 0.5;
    const lo = Math.max(0, Math.ceil(center - support));
    const hi = Math.min(srcLen - 1, Math.floor(center + support));
    const w = [];
    let sum = 0;
    for(let j = lo; j <= hi; j++){
      const v = filter.fn((j - center) / stretch);
      w.push(v); sum += v;
    }
    if(!w.length){ // imagen de 1 px: se copia sin más
      first[i] = Math.min(srcLen - 1, Math.max(0, Math.round(center)));
      lists.push([1]);
    } else {
      first[i] = lo;
      lists.push(sum ? w.map(v => v / sum) : w);
    }
    count[i] = lists[i].length;
    maxN = Math.max(maxN, count[i]);
  }
  const weights = new Float32Array(dstLen * maxN);
  lists.forEach((l, i) => weights.set(l, i * maxN));
  return { first, count, weights, stride: maxN };
}

function resample(src, sw, sh, dw, dh, method){
  const filter = FILTERS[method] || FILTERS.lanczos3;
  const H = contributions(sw, dw, filter), V = contributions(sh, dh, filter);

  // Origen premultiplicado en Float32, una sola vez.
  const pre = new Float32Array(sw * sh * 4);
  for(let i = 0; i < pre.length; i += 4){
    const a = src[i + 3] / 255;
    pre[i] = src[i] * a; pre[i + 1] = src[i + 1] * a; pre[i + 2] = src[i + 2] * a; pre[i + 3] = src[i + 3];
  }

  const rows = new Map();   // fila de origen → fila filtrada en horizontal (dw × 4)
  const hRow = y => {
    let r = rows.get(y);
    if(r) return r;
    r = new Float32Array(dw * 4);
    const base = y * sw * 4;
    for(let x = 0; x < dw; x++){
      const f = H.first[x], n = H.count[x], wo = x * H.stride;
      let R = 0, G = 0, B = 0, A = 0;
      for(let k = 0; k < n; k++){
        const w = H.weights[wo + k], si = base + (f + k) * 4;
        R += pre[si] * w; G += pre[si + 1] * w; B += pre[si + 2] * w; A += pre[si + 3] * w;
      }
      const o = x * 4;
      r[o] = R; r[o + 1] = G; r[o + 2] = B; r[o + 3] = A;
    }
    rows.set(y, r);
    return r;
  };

  const out = new Uint8ClampedArray(dw * dh * 4);
  for(let y = 0; y < dh; y++){
    const f = V.first[y], n = V.count[y], wo = y * V.stride;
    // Fuera de la ventana ya no hacen falta: la vertical avanza en orden.
    for(const k of rows.keys()) if(k < f) rows.delete(k);
    const src = [];
    for(let k = 0; k < n; k++) src.push(hRow(f + k));
    for(let x = 0; x < dw; x++){
      const o = x * 4;
      let R = 0, G = 0, B = 0, A = 0;
      for(let k = 0; k < n; k++){
        const w = V.weights[wo + k], r = src[k];
        R += r[o] * w; G += r[o + 1] * w; B += r[o + 2] * w; A += r[o + 3] * w;
      }
      const di = (y * dw + x) * 4;
      if(A <= 0.5){ out[di] = out[di + 1] = out[di + 2] = out[di + 3] = 0; continue; }
      // Lanczos y Catmull-Rom sobrepasan un poco en los bordes duros:
      // el alfa se limita a 255 y el color a su propio alfa.
      const a = Math.min(255, A), inv = 1 / (a / 255);
      out[di]     = Math.min(a, Math.max(0, R)) * inv;
      out[di + 1] = Math.min(a, Math.max(0, G)) * inv;
      out[di + 2] = Math.min(a, Math.max(0, B)) * inv;
      out[di + 3] = a;
    }
    if((y & 63) === 0) self.postMessage({ type: "progress", id: currentId, frac: y / dh });
  }
  return out;
}

let currentId = 0;
self.onmessage = e => {
  const { id, data, sw, sh, dw, dh, method } = e.data || {};
  currentId = id;
  try{
    const out = resample(data, sw, sh, dw, dh, method);
    self.postMessage({ type: "result", id, data: out }, [out.buffer]);
  }catch(err){
    self.postMessage({ type: "error", id, message: String(err?.message || err) });
  }
};
