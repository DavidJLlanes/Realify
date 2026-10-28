/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · MOTOR DE MEZCLA
   Funciones puras (sin DOM) que usa worker.js. Reciben las fotos YA
   colocadas (RGBA con alfa 0 fuera de la toma, y su posición en el
   mosaico: lo que devuelve rotation.js › warpPanorama) y:

     1. `placed`: compensación de exposición global, una ganancia por foto
        a partir del brillo de TODAS las parejas que se solapan.
     2. `compose`: mezcla en luz lineal y recorte al mayor rectángulo sin
        huecos. Modos de mezcla:
          · "multiband" (multiband.js) la costura va por donde menos se
                      diferencian las dos fotos (rodea a lo que se mueve) y
                      se mezcla por bandas de frecuencia;
          · "seam"    la costura cae donde la distancia al borde de cada
                      foto se iguala y sólo se suaviza a su alrededor: sin
                      dobles dentro de los solapes anchos (por defecto);
          · "feather" transición suave de `blend` px junto al borde de cada
                      foto; en el interior del solape promedia las dos;
          · "average" promedio simple; "cut" la última foto cubre a la anterior.
   ═══════════════════════════════════════════════════════════════ */

import { TO_LIN, enc } from "./color.js";
import { edgeDistance, seamOwners, blendMultiband } from "./multiband.js";

/** Con un mosaico mayor (px) la mezcla multibanda no se hace (gasta ~21 bytes por píxel más las fotos) y se usa "seam". */
const MULTIBAND_MAX_AREA = 12e6;

/** Ganancia de exposición de b respecto a a en su solape (lineal). */
function overlapGain(a, b, dx, dy){
  const x0 = Math.max(0, dx), x1 = Math.min(a.w, dx + b.w), y0 = Math.max(0, dy), y1 = Math.min(a.h, dy + b.h);
  let sa = 0, sb = 0, n = 0;
  const step = Math.max(1, Math.round(Math.sqrt((x1 - x0) * (y1 - y0) / 40000)));
  for(let y = y0; y < y1; y += step) for(let x = x0; x < x1; x += step){
    const ia = (y * a.w + x) * 4, ib = ((y - dy) * b.w + (x - dx)) * 4;
    if(a.data[ia + 3] < 200 || b.data[ib + 3] < 200) continue;
    const la = TO_LIN[a.data[ia]] * .2126 + TO_LIN[a.data[ia + 1]] * .7152 + TO_LIN[a.data[ia + 2]] * .0722;
    const lb = TO_LIN[b.data[ib]] * .2126 + TO_LIN[b.data[ib + 1]] * .7152 + TO_LIN[b.data[ib + 2]] * .0722;
    if(la > .003 && la < .9 && lb > .003 && lb < .9){ sa += la; sb += lb; n++; }
  }
  return n > 30 && sb > 0 ? sa / sb : 1;
}

/** Compensa exposición de forma global con todas las parejas que se solapan. */
export function placed(imgs, pos){
  const n = imgs.length, edges = [], neighbors = Array.from({length:n},()=>[]);
  for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){
    const dx = Math.round(pos[j].x - pos[i].x), dy = Math.round(pos[j].y - pos[i].y);
    const ow = Math.min(imgs[i].w, dx + imgs[j].w) - Math.max(0, dx), oh = Math.min(imgs[i].h, dy + imgs[j].h) - Math.max(0, dy);
    if(ow < 8 || oh < 8) continue;
    const ratio = overlapGain(imgs[i], imgs[j], dx, dy);
    if(!Number.isFinite(ratio) || ratio < 0.25 || ratio > 4) continue;
    const edge = { i, j, delta: Math.log(ratio), weight: Math.sqrt(ow * oh) };
    edges.push(edge); neighbors[i].push(edge); neighbors[j].push(edge);
  }
  let logs = new Float64Array(n);
  for(let iter = 0; iter < 24 && edges.length; iter++){
    const next = new Float64Array(n);
    for(let k = 0; k < n; k++){
      let sum = 0, weight = 0;
      for(const e of neighbors[k]){
        const prediction = k === e.i ? logs[e.j] - e.delta : logs[e.i] + e.delta;
        const residual = Math.abs((logs[e.j] - logs[e.i]) - e.delta), w = e.weight / (1 + residual * 3);
        sum += prediction * w; weight += w;
      }
      next[k] = weight ? sum / weight : logs[k];
    }
    const mean = next.reduce((a,b)=>a+b,0) / Math.max(1,n);
    for(let k = 0; k < n; k++) logs[k] = next[k] - mean;
  }
  return { pos, gains: Array.from(logs,v=>Math.max(0.5,Math.min(2,Math.exp(v)))), dir:"h", found:imgs.map(()=>true) };
}

/** Mezcla. `blend` (px) = ancho de la transición de "feather"; `sharpness` = lo brusca que es la transición de "seam"
    (mayor = costura más estrecha); `useGain` iguala la exposición; `crop` recorta al mayor rectángulo cubierto. */
export function compose(imgs, L, { blend = 60, useGain = true, crop = true, fusion = "seam", sharpness = 8, maxArea = MULTIBAND_MAX_AREA } = {}){
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  imgs.forEach((im, i) => { const p = L.pos[i]; minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + im.w); maxY = Math.max(maxY, p.y + im.h); });
  const W = Math.round(maxX - minX), H = Math.round(maxY - minY), N = W * H;
  let acc, wsum;
  if(fusion === "multiband" && N <= maxArea){
    const offs = imgs.map((_, i) => ({ x: Math.round(L.pos[i].x - minX), y: Math.round(L.pos[i].y - minY) })), gains = imgs.map((_, i) => useGain ? L.gains[i] : 1);
    const { lin, cover } = blendMultiband(imgs, offs, gains, seamOwners(imgs, offs, gains, W, H), W, H);
    acc = lin; wsum = Float32Array.from(cover);   // ya normalizado: el divisor es 1 donde hay imagen
  } else {
  if(fusion === "multiband") fusion = "seam";   // mosaico demasiado grande
  acc = new Float32Array(N * 3); wsum = new Float32Array(N);
  const F = Math.max(1, blend);
  imgs.forEach((im, i) => {
    const ox = Math.round(L.pos[i].x - minX), oy = Math.round(L.pos[i].y - minY), g = useGain ? L.gains[i] : 1;
    const { w, h, data } = im, dist = edgeDistance(im);   // distancia al borde de la zona válida (alfa)
    let dmax = 1;
    if(fusion === "seam") for(let k = 0; k < dist.length; k++) if(dist[k] > dmax) dmax = dist[k];
    for(let y = 0; y < h; y++){
      const Y = y + oy; if(Y < 0 || Y >= H) continue;
      for(let x = 0; x < w; x++){
        const X = x + ox; if(X < 0 || X >= W) continue;
        const s = (y * w + x) * 4; if(data[s + 3] < 128) continue;
        const o = Y * W + X;
        if(fusion === "cut"){
          // Corte directo: la foto posterior en el orden elegido cubre la anterior.
          acc[o * 3] = TO_LIN[data[s]] * g; acc[o * 3 + 1] = TO_LIN[data[s + 1]] * g; acc[o * 3 + 2] = TO_LIN[data[s + 2]] * g; wsum[o] = 1;
        } else {
          const d = dist[y * w + x];
          const wt = fusion === "average" ? 1 : fusion === "seam" ? (d / dmax) ** sharpness + 1e-6 : Math.min(1, d / F) ** 2 + 1e-4;
          acc[o * 3] += TO_LIN[data[s]] * g * wt; acc[o * 3 + 1] += TO_LIN[data[s + 1]] * g * wt; acc[o * 3 + 2] += TO_LIN[data[s + 2]] * g * wt;
          wsum[o] += wt;
        }
      }
    }
  });
  }
  let rect = { x: 0, y: 0, w: W, h: H };
  if(crop) rect = coveredRect(wsum, W, H);
  const out = new Uint8ClampedArray(rect.w * rect.h * 4);
  for(let y = 0; y < rect.h; y++) for(let x = 0; x < rect.w; x++){
    const o = (y + rect.y) * W + x + rect.x, q = (y * rect.w + x) * 4, s = wsum[o];
    if(s <= 0) continue;
    out[q] = enc(acc[o * 3] / s); out[q + 1] = enc(acc[o * 3 + 1] / s); out[q + 2] = enc(acc[o * 3 + 2] / s); out[q + 3] = 255;
  }
  return { w: rect.w, h: rect.h, data: out };
}

/* Mayor rectángulo (aprox.) sin huecos: se recorta columnas y filas de
   los extremos probando qué da más área. */
function coveredRect(wsum, W, H){
  const top = new Int32Array(W).fill(H), bot = new Int32Array(W).fill(-1);
  for(let x = 0; x < W; x++){
    for(let y = 0; y < H; y++) if(wsum[y * W + x] > 0){ top[x] = y; break; }
    for(let y = H - 1; y >= 0; y--) if(wsum[y * W + x] > 0){ bot[x] = y; break; }
  }
  const leftRow = new Int32Array(H).fill(W), rightRow = new Int32Array(H).fill(-1);
  for(let y = 0; y < H; y++){
    for(let x = 0; x < W; x++) if(wsum[y * W + x] > 0){ leftRow[y] = x; break; }
    for(let x = W - 1; x >= 0; x--) if(wsum[y * W + x] > 0){ rightRow[y] = x; break; }
  }
  let best = { x: 0, y: 0, w: W, h: H, a: -1 };
  const stepX = Math.max(1, Math.round(W / 120));
  let first = 0; while(first < W && bot[first] < 0) first++;
  let last = W - 1; while(last > first && bot[last] < 0) last--;
  const span = last - first;
  for(let a = 0; a <= span * 0.25; a += stepX){
    for(let b = 0; b <= span * 0.25; b += stepX){
      const x0 = first + a, x1 = last - b;
      if(x1 - x0 < 8) continue;
      let t = 0, bt = H - 1;
      for(let x = x0; x <= x1; x++){ if(top[x] > t) t = top[x]; if(bot[x] < bt) bt = bot[x]; }
      if(bt - t < 8) continue;
      // Que cada fila del rango cubra de x0 a x1
      let ok = true;
      for(let y = t; y <= bt; y += Math.max(1, (bt - t) >> 6)) if(leftRow[y] > x0 || rightRow[y] < x1){ ok = false; break; }
      if(!ok) continue;
      const area = (x1 - x0 + 1) * (bt - t + 1);
      if(area > best.a) best = { x: x0, y: t, w: x1 - x0 + 1, h: bt - t + 1, a: area };
    }
  }
  return best.a > 0 ? best : { x: 0, y: 0, w: W, h: H };
}
