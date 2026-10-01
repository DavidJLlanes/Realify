/* ═══════════════════════════════════════════════════════════════
   IA · MOTOR COMÚN DE BLOQUES (fase 3 de PENDIENTE.md)
   Los modelos trabajan a un tamaño fijo (518, 513, 512…). Para que el
   resultado tenga la resolución de la foto y no la del modelo, la foto
   se parte en bloques que se solapan, cada bloque pasa por el modelo y
   los resultados se funden con pesos que bajan suavemente hacia los
   bordes del bloque (nunca en el borde de la foto): sin costuras.

   Para los modelos de resultado «relativo» (profundidad, máscaras) cada
   bloque sólo ve su trozo, así que además hay una pasada GLOBAL de la
   foto entera que da la coherencia (qué está más cerca, dónde está el
   cielo) y los bloques aportan el detalle; ver depth.js y segment.js.

   Sin DOM: lo usan el worker de IA y el hilo principal.
   ═══════════════════════════════════════════════════════════════ */

/** Inicios de bloque a lo largo de un eje: paso fijo y el último pegado
    al borde, para que todos midan `tile` (un bloque estrecho rellenado
    deja franjas que el modelo no limpia). */
export function starts(len, tile, overlap){
  if(len <= tile) return [0];
  const out = [], step = Math.max(1, tile - overlap);
  for(let x = 0; x + tile < len; x += step) out.push(x);
  out.push(len - tile);
  return out;
}

/** Bloques de `tile`×`tile` (o menos, si la imagen es menor) que cubren
    w×h con al menos `overlap` píxeles de solape. */
export function tilePlan(w, h, tile, overlap){
  const tw = Math.min(tile, w), th = Math.min(tile, h);
  const xs = starts(w, tw, overlap), ys = starts(h, th, overlap), out = [];
  for(const y of ys) for(const x of xs) out.push({ x, y, w: tw, h: th });
  return out;
}

/** Peso de fundido de un bloque: 1 en el centro, rampa suave
    (smoothstep) de `ramp` píxeles hacia cada borde del bloque que NO sea
    borde de la imagen. Devuelve un Float32Array tw×th. */
export function tileWeights(t, W, H, ramp){
  const out = new Float32Array(t.w * t.h);
  const ax = new Float32Array(t.w), ay = new Float32Array(t.h);
  const edge = (i, len, atStart, atEnd) => {
    let a = 1;
    if(!atStart){ const k = Math.min(1, (i + 0.5) / ramp); a = Math.min(a, k * k * (3 - 2 * k)); }
    if(!atEnd){ const k = Math.min(1, (len - i - 0.5) / ramp); a = Math.min(a, k * k * (3 - 2 * k)); }
    return Math.max(1e-4, a);
  };
  for(let x = 0; x < t.w; x++) ax[x] = edge(x, t.w, t.x === 0, t.x + t.w >= W);
  for(let y = 0; y < t.h; y++) ay[y] = edge(y, t.h, t.y === 0, t.y + t.h >= H);
  for(let y = 0; y < t.h; y++) for(let x = 0; x < t.w; x++) out[y * t.w + x] = ax[x] * ay[y];
  return out;
}

/** Acumulador de bloques con pesos: add() cada bloque, result() la media. */
export function blender(W, H){
  const acc = new Float32Array(W * H), wsum = new Float32Array(W * H);
  return {
    add(t, values, weights){
      for(let y = 0; y < t.h; y++){
        const o = (t.y + y) * W + t.x, r = y * t.w;
        for(let x = 0; x < t.w; x++){ const k = weights[r + x]; acc[o + x] += values[r + x] * k; wsum[o + x] += k; }
      }
    },
    result(){ for(let i = 0; i < acc.length; i++) acc[i] = wsum[i] > 0 ? acc[i] / wsum[i] : 0; return acc; }
  };
}

/** Mínimos cuadrados: a, b tales que a·src + b ≈ ref (con pesos). */
export function fitAffine(src, ref, weights){
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for(let i = 0; i < src.length; i++){
    const k = weights ? weights[i] : 1, x = src[i], y = ref[i];
    sw += k; sx += k * x; sy += k * y; sxx += k * x * x; sxy += k * x * y;
  }
  const den = sw * sxx - sx * sx;
  if(sw <= 0 || Math.abs(den) < 1e-9) return { a: 1, b: sw > 0 ? (sy - sx) / sw : 0 };
  const a = (sw * sxy - sx * sy) / den;
  return { a, b: (sy - a * sx) / sw };
}

/** Remuestreo bilineal de un mapa w×h a W×H (centros de píxel). */
export function resizeBilinear(src, w, h, W, H){
  const out = new Float32Array(W * H);
  for(let y = 0; y < H; y++){
    const fy = Math.min(h - 1, Math.max(0, (y + 0.5) * h / H - 0.5)), y0 = fy | 0, y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < W; x++){
      const fx = Math.min(w - 1, Math.max(0, (x + 0.5) * w / W - 0.5)), x0 = fx | 0, x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      const a = src[y0 * w + x0] + (src[y0 * w + x1] - src[y0 * w + x0]) * tx;
      const b = src[y1 * w + x0] + (src[y1 * w + x1] - src[y1 * w + x0]) * tx;
      out[y * W + x] = a + (b - a) * ty;
    }
  }
  return out;
}

/** Desenfoque de caja separable con borde repetido (tres pasadas ≈
    gaussiana de σ ≈ r). */
export function smooth(src, w, h, r){
  r = Math.max(1, Math.round(r));
  let a = Float32Array.from(src);
  const tmp = new Float32Array(src.length), n = 2 * r + 1;
  for(let pass = 0; pass < 3; pass++){
    for(let y = 0; y < h; y++){
      const o = y * w; let s = 0;
      for(let t = -r; t <= r; t++) s += a[o + Math.min(w - 1, Math.max(0, t))];
      for(let x = 0; x < w; x++){ tmp[o + x] = s / n; s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; }
    }
    const col = new Float64Array(w);
    for(let t = -r; t <= r; t++){ const q = Math.min(h - 1, Math.max(0, t)) * w; for(let x = 0; x < w; x++) col[x] += tmp[q + x]; }
    for(let y = 0; y < h; y++){
      const o = y * w;
      for(let x = 0; x < w; x++) a[o + x] = col[x] / n;
      const add = Math.min(h - 1, y + r + 1) * w, sub = Math.max(0, y - r) * w;
      for(let x = 0; x < w; x++) col[x] += tmp[add + x] - tmp[sub + x];
    }
  }
  return a;
}

/** Lado largo de trabajo para que `k` bloques de `tile` con solape
    `overlap` cubran el lado largo exactamente (sin un bloque de más
    casi entero solapado). Nunca más que la propia foto. */
export function workSide(tile, overlap, k, photoLong){
  return Math.min(photoLong, k * tile - (k - 1) * overlap);
}
