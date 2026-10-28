/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · COSTURAS Y MEZCLA MULTIBANDA
   Funciones puras (sin DOM) que usa engine.js › compose (fusión
   "multiband"). Reciben las fotos YA colocadas (RGBA con alfa 0 fuera de
   la toma) y sus posiciones en el mosaico, y hacen dos cosas:

     1. `seamOwners`: decide qué foto «manda» en cada píxel. Parte de la
        distancia al borde de cada foto (la costura cae a mitad del solape)
        y, para cada pareja que se solapa, la mueve por el camino de menor
        diferencia entre las dos fotos (programación dinámica, como
        «seam finding» de OpenCV): la costura rodea a los objetos que se
        mueven en vez de cruzarlos, así que cada uno sale entero y una sola
        vez, sin dobles.
     2. `blendMultiband`: mezcla con pirámides de Laplace (Burt y Adelson):
        cada banda de frecuencia se une con una transición tan ancha como
        la propia banda. Las diferencias suaves de exposición y de color se
        reparten en transiciones largas; el detalle fino, en una costura
        estrecha. Se mezcla en una escala perceptual (raíz de la luz
        lineal) para que no aparezcan halos junto a los contrastes fuertes.

   Cada foto se procesa en su propia caja alineada a 2^niveles, así que la
   memoria es la del mosaico más una foto, no la de todas a la vez.
   ═══════════════════════════════════════════════════════════════ */

import { TO_LIN } from "./color.js";

/** Distancia (px) de cada píxel al borde de la zona válida (alfa) de la foto, por filas y columnas. */
export function edgeDistance({ w, h, data }){
  const dist = new Float32Array(w * h);
  for(let y = 0; y < h; y++){
    let run = 0;
    for(let x = 0; x < w; x++){ run = data[(y * w + x) * 4 + 3] > 127 ? run + 1 : 0; dist[y * w + x] = run; }
    run = 0;
    for(let x = w - 1; x >= 0; x--){ run = data[(y * w + x) * 4 + 3] > 127 ? run + 1 : 0; dist[y * w + x] = Math.min(dist[y * w + x], run); }
  }
  for(let x = 0; x < w; x++){
    let run = 0;
    for(let y = 0; y < h; y++){ run = data[(y * w + x) * 4 + 3] > 127 ? run + 1 : 0; dist[y * w + x] = Math.min(dist[y * w + x], run); }
    run = 0;
    for(let y = h - 1; y >= 0; y--){ run = data[(y * w + x) * 4 + 3] > 127 ? run + 1 : 0; dist[y * w + x] = Math.min(dist[y * w + x], run); }
  }
  return dist;
}

/* ── 1 · Costuras ─────────────────────────────────────────────── */

/** Margen (px) que la costura deja con lo que difiere mucho entre las dos fotos. */
const SEAM_MARGIN = 10;

/** Suaviza el coste con una media 5×5 (dos pasadas de 5) sólo entre píxeles de la región: el camino no se cuela por el ruido. */
function smoothMasked(cost, reg, bw, bh){
  const tmp = new Float32Array(cost.length);
  for(let y = 0; y < bh; y++) for(let x = 0; x < bw; x++){
    const o = y * bw + x; if(!reg[o]) continue;
    let s = 0, n = 0;
    for(let k = -2; k <= 2; k++){ const xx = x + k; if(xx < 0 || xx >= bw) continue; const p = y * bw + xx; if(reg[p]){ s += cost[p]; n++; } }
    tmp[o] = s / n;
  }
  for(let y = 0; y < bh; y++) for(let x = 0; x < bw; x++){
    const o = y * bw + x; if(!reg[o]) continue;
    let s = 0, n = 0;
    for(let k = -2; k <= 2; k++){ const yy = y + k; if(yy < 0 || yy >= bh) continue; const p = yy * bw + x; if(reg[p]){ s += tmp[p]; n++; } }
    cost[o] = s / n;
  }
}

/** Dilata el coste (máximo en un cuadrado de lado 2r+1, sólo entre píxeles de la región): la costura se mantiene a unos píxeles de lo que difiere mucho, no pegada a su borde. */
function dilateMasked(cost, reg, bw, bh, r){
  const tmp = new Float32Array(cost.length);
  for(let y = 0; y < bh; y++) for(let x = 0; x < bw; x++){
    const o = y * bw + x; if(!reg[o]) continue;
    let m = 0; for(let k = Math.max(0, x - r); k <= Math.min(bw - 1, x + r); k++){ const p = y * bw + k; if(reg[p] && cost[p] > m) m = cost[p]; }
    tmp[o] = m;
  }
  for(let y = 0; y < bh; y++) for(let x = 0; x < bw; x++){
    const o = y * bw + x; if(!reg[o]) continue;
    let m = 0; for(let k = Math.max(0, y - r); k <= Math.min(bh - 1, y + r); k++){ const p = k * bw + x; if(reg[p] && tmp[p] > m) m = tmp[p]; }
    cost[o] = m;
  }
}

/**
 * Camino de coste mínimo de arriba abajo por la región (un píxel por fila, saltos de ±1 entre filas).
 * Devuelve la columna de la costura en cada fila (-1 donde no hay región o el tramo no se pudo resolver).
 */
function dpSeam(cost, reg, bw, bh){
  const cum = new Float32Array(bw * bh).fill(Infinity), back = new Int8Array(bw * bh), seam = new Int32Array(bh).fill(-1);
  const lo = new Int32Array(bh).fill(bw), hi = new Int32Array(bh).fill(-1);
  for(let y = 0; y < bh; y++) for(let x = 0; x < bw; x++) if(reg[y * bw + x]){ if(x < lo[y]) lo[y] = x; if(x > hi[y]) hi[y] = x; }
  const LAMBDA = 0.08;   // preferencia por la mitad del solape (los bordes de la foto están más deformados) cuando todo lo demás empata
  const prior = (x, y) => LAMBDA * Math.abs(x - (lo[y] + hi[y]) / 2) / Math.max(1, (hi[y] - lo[y]) / 2);
  let y = 0;
  while(y < bh){
    if(hi[y] < 0){ y++; continue; }
    // tramo de filas consecutivas con región cuyos intervalos se solapan
    const y0 = y; let y1 = y;
    while(y1 + 1 < bh && hi[y1 + 1] >= 0 && lo[y1 + 1] <= hi[y1] + 1 && hi[y1 + 1] >= lo[y1] - 1) y1++;
    for(let x = lo[y0]; x <= hi[y0]; x++) if(reg[y0 * bw + x]) cum[y0 * bw + x] = cost[y0 * bw + x] + prior(x, y0);
    for(let r = y0 + 1; r <= y1; r++) for(let x = lo[r]; x <= hi[r]; x++){
      const o = r * bw + x; if(!reg[o]) continue;
      let best = Infinity, bd = 0;
      for(let d = -1; d <= 1; d++){ const xx = x + d; if(xx < 0 || xx >= bw) continue; const v = cum[(r - 1) * bw + xx]; if(v < best){ best = v; bd = d; } }
      if(best < Infinity){ cum[o] = best + cost[o] + prior(x, r); back[o] = bd; }
    }
    let bx = -1, bv = Infinity;
    for(let x = lo[y1]; x <= hi[y1]; x++){ const v = cum[y1 * bw + x]; if(v < bv){ bv = v; bx = x; } }
    if(bx >= 0) for(let r = y1; r >= y0; r--){ seam[r] = bx; bx += back[r * bw + bx]; }
    y = y1 + 1;
  }
  return seam;
}

/**
 * Mapa de «dueños»: para cada píxel del mosaico (W×H), el índice de la foto que lo aporta (-1 si ninguna).
 * @param imgs  [{ w, h, data }]   @param offs [{ x, y }] posición de cada foto en el mosaico (enteros)   @param gains ganancia de exposición de cada una
 * @param opts.seams  false: sólo la partición por distancia al borde (sin buscar costuras)
 */
export function seamOwners(imgs, offs, gains, W, H, { seams = true } = {}){
  const owner = new Int16Array(W * H).fill(-1), best = new Float32Array(W * H).fill(-1);
  imgs.forEach((im, i) => {
    const dist = edgeDistance(im), { w, h } = im;
    for(let y = 0; y < h; y++){
      const Y = y + offs[i].y; if(Y < 0 || Y >= H) continue;
      for(let x = 0; x < w; x++){
        const X = x + offs[i].x; if(X < 0 || X >= W) continue;
        const d = dist[y * w + x]; if(d <= 0) continue;
        const o = Y * W + X; if(d > best[o]){ best[o] = d; owner[o] = i; }
      }
    }
  });
  if(!seams) return owner;

  // Parejas con solape, de mayor a menor
  const pairs = [];
  for(let i = 0; i < imgs.length; i++) for(let j = i + 1; j < imgs.length; j++){
    const x0 = Math.max(offs[i].x, offs[j].x, 0), x1 = Math.min(offs[i].x + imgs[i].w, offs[j].x + imgs[j].w, W);
    const y0 = Math.max(offs[i].y, offs[j].y, 0), y1 = Math.min(offs[i].y + imgs[i].h, offs[j].y + imgs[j].h, H);
    if(x1 - x0 < 8 || y1 - y0 < 8) continue;
    pairs.push({ i, j, area: (x1 - x0) * (y1 - y0) });
  }
  pairs.sort((a, b) => b.area - a.area);
  for(const { i, j } of pairs){
    const A = imgs[i], B = imgs[j], oa = offs[i], ob = offs[j];
    const x0 = Math.max(oa.x, ob.x, 0), x1 = Math.min(oa.x + A.w, ob.x + B.w, W), y0 = Math.max(oa.y, ob.y, 0), y1 = Math.min(oa.y + A.h, ob.y + B.h, H);
    // Región: píxeles válidos en las dos fotos y que aún son de una de ellas
    let rx0 = Infinity, ry0 = Infinity, rx1 = -1, ry1 = -1, count = 0;
    for(let Y = y0; Y < y1; Y++) for(let X = x0; X < x1; X++){
      const o = owner[Y * W + X]; if(o !== i && o !== j) continue;
      const ax0 = X - oa.x, ay0 = Y - oa.y, bx0 = X - ob.x, by0 = Y - ob.y;
      if(A.data[(ay0 * A.w + ax0) * 4 + 3] <= 127 || B.data[(by0 * B.w + bx0) * 4 + 3] <= 127) continue;
      if(X < rx0) rx0 = X; if(X > rx1) rx1 = X; if(Y < ry0) ry0 = Y; if(Y > ry1) ry1 = Y; count++;
    }
    if(count < 1500) continue;
    const bw = rx1 - rx0 + 1, bh = ry1 - ry0 + 1, vertical = bh >= bw;   // solape alto → costura vertical; ancho → horizontal
    // La costura se busca en una rejilla gruesa (q px por celda, ~250 000 celdas como mucho): la posición exacta no importa porque la mezcla suaviza,
    // y así el coste no crece con el tamaño de las fotos.
    const q = Math.max(1, Math.ceil(Math.sqrt(count / 250000))), lw = Math.ceil(bw / q), lh = Math.ceil(bh / q), ga = gains[i], gb = gains[j];
    const reg = new Uint8Array(lw * lh), cost = new Float32Array(lw * lh);
    for(let y = 0; y < lh; y++) for(let x = 0; x < lw; x++){
      const px = Math.min(bw - 1, x * q + (q >> 1)), py = Math.min(bh - 1, y * q + (q >> 1)), X = rx0 + px, Y = ry0 + py, o = owner[Y * W + X];
      if(o !== i && o !== j) continue;
      const ax = X - oa.x, ay = Y - oa.y, bx = X - ob.x, by = Y - ob.y;
      if(ax < 0 || ay < 0 || ax >= A.w || ay >= A.h || bx < 0 || by < 0 || bx >= B.w || by >= B.h) continue;
      const pa = (ay * A.w + ax) * 4, pb = (by * B.w + bx) * 4;
      if(A.data[pa + 3] <= 127 || B.data[pb + 3] <= 127) continue;
      let d = 0;
      for(let c = 0; c < 3; c++) d += Math.abs(Math.min(255, A.data[pa + c] * ga) - Math.min(255, B.data[pb + c] * gb));
      cost[y * lw + x] = d / 765; reg[y * lw + x] = 1;
    }
    smoothMasked(cost, reg, lw, lh);
    dilateMasked(cost, reg, lw, lh, Math.max(1, Math.ceil(SEAM_MARGIN / q)));
    // Con la costura horizontal se trabaja sobre la traspuesta
    let tw = lw, th = lh, treg = reg, tcost = cost;
    if(!vertical){
      tw = lh; th = lw; treg = new Uint8Array(lw * lh); tcost = new Float32Array(lw * lh);
      for(let y = 0; y < lh; y++) for(let x = 0; x < lw; x++){ treg[x * lh + y] = reg[y * lw + x]; tcost[x * lh + y] = cost[y * lw + x]; }
    }
    const seam = dpSeam(tcost, treg, tw, th);
    // Posición (px del solape) de la costura en la fila (o columna) `t` de la región, interpolando entre celdas; -1 si no se resolvió
    const seamAt = t => {
      const f = (t - (q >> 1)) / q, a = Math.max(0, Math.min(seam.length - 1, Math.floor(f))), b = Math.min(seam.length - 1, a + 1);
      const sa = seam[a], sb = seam[b], u = Math.max(0, Math.min(1, f - a));
      if(sa < 0 && sb < 0) return -1;
      if(sa < 0) return sb * q + (q >> 1);
      if(sb < 0) return sa * q + (q >> 1);
      return (sa + (sb - sa) * u) * q + (q >> 1);
    };
    // Qué foto queda a cada lado: la de centro menor (en el eje que cruza la costura)
    const ca = vertical ? oa.x + A.w / 2 : oa.y + A.h / 2, cb = vertical ? ob.x + B.w / 2 : ob.y + B.h / 2, low = ca <= cb ? i : j, high = ca <= cb ? j : i;
    const cut = new Float32Array(vertical ? bh : bw);
    for(let t = 0; t < cut.length; t++) cut[t] = seamAt(t);
    for(let y = 0; y < bh; y++) for(let x = 0; x < bw; x++){
      const o = (ry0 + y) * W + rx0 + x, own = owner[o]; if(own !== i && own !== j) continue;
      const X = rx0 + x, Y = ry0 + y, ax = X - oa.x, ay = Y - oa.y, bx = X - ob.x, by = Y - ob.y;
      if(ax < 0 || ay < 0 || ax >= A.w || ay >= A.h || bx < 0 || by < 0 || bx >= B.w || by >= B.h) continue;
      if(A.data[(ay * A.w + ax) * 4 + 3] <= 127 || B.data[(by * B.w + bx) * 4 + 3] <= 127) continue;
      const c = vertical ? cut[y] : cut[x]; if(c < 0) continue;
      owner[o] = (vertical ? x : y) >= c ? high : low;
    }
  }
  return owner;
}

/* ── 2 · Pirámides ─────────────────────────────────────────────── */

const K5 = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];

/** Gaussiana 5×5 y reducción a la mitad (fuera de la imagen cuenta como 0). */
function blurDown(src, w, h){
  const w2 = w >> 1, h2 = h >> 1, tmp = new Float32Array(w2 * h), out = new Float32Array(w2 * h2);
  for(let y = 0; y < h; y++){
    const row = y * w;
    for(let x = 0; x < w2; x++){
      let s = 0; const c = 2 * x;
      for(let a = 0; a < 5; a++){ const xx = c + a - 2; if(xx >= 0 && xx < w) s += K5[a] * src[row + xx]; }
      tmp[y * w2 + x] = s;
    }
  }
  for(let y = 0; y < h2; y++) for(let x = 0; x < w2; x++){
    let s = 0; const c = 2 * y;
    for(let a = 0; a < 5; a++){ const yy = c + a - 2; if(yy >= 0 && yy < h) s += K5[a] * tmp[yy * w2 + x]; }
    out[y * w2 + x] = s;
  }
  return out;
}

/** Duplica el tamaño (w×h → 2w×2h) por interpolación bilineal. */
function up(src, w, h){
  const W = w * 2, H = h * 2, out = new Float32Array(W * H), xa = new Int32Array(W), xb = new Int32Array(W), xt = new Float32Array(W);
  for(let x = 0; x < W; x++){ const fx = Math.max(0, Math.min(w - 1, (x + 0.5) / 2 - 0.5)), x0 = Math.floor(fx); xa[x] = x0; xb[x] = Math.min(w - 1, x0 + 1); xt[x] = fx - x0; }
  for(let y = 0; y < H; y++){
    const fy = Math.max(0, Math.min(h - 1, (y + 0.5) / 2 - 0.5)), y0 = Math.floor(fy), ty = fy - y0, r0 = y0 * w, r1 = Math.min(h - 1, y0 + 1) * w, row = y * W;
    for(let x = 0; x < W; x++){
      const a = src[r0 + xa[x]], b = src[r0 + xb[x]], c = src[r1 + xa[x]], d = src[r1 + xb[x]], t = xt[x];
      out[row + x] = (a + (b - a) * t) * (1 - ty) + (c + (d - c) * t) * ty;
    }
  }
  return out;
}

/** Niveles de la pirámide para un mosaico (el mismo para todas las fotos, así las cajas encajan nivel a nivel). */
export function pyramidLevels(W, H, max = 5){ return Math.max(1, Math.min(max, Math.floor(Math.log2(Math.min(W, H) / 16)))); }

/**
 * Mezcla multibanda según el mapa de dueños. Devuelve { lin: Float32Array(W·H·3) en luz lineal, cover: Uint8Array(W·H) con 1 donde hay imagen }.
 * @param gains ganancia de exposición (lineal) de cada foto
 */
export function blendMultiband(imgs, offs, gains, owner, W, H, { levels = 5 } = {}){
  const LV = pyramidLevels(W, H, levels), S = 2 ** LV, Wp = Math.ceil(W / S) * S, Hp = Math.ceil(H / S) * S;
  // Acumuladores por nivel: 3 canales de banda × peso, y la suma de pesos
  const acc = [], wsum = [], dims = [];
  for(let l = 0; l <= LV; l++){ const wl = Wp >> l, hl = Hp >> l; dims.push([wl, hl]); acc.push([new Float32Array(wl * hl), new Float32Array(wl * hl), new Float32Array(wl * hl)]); wsum.push(new Float32Array(wl * hl)); }

  imgs.forEach((im, i) => {
    const { w, h, data } = im, g = gains[i];
    // Caja de trabajo: lo que la foto aporta (sus píxeles «dueños») más el margen que alcanza el suavizado de la máscara en el nivel más grueso,
    // alineada a S = 2^niveles para que los niveles encajen entre fotos. Fuera de ella la máscara vale 0, así que no hace falta calcularlo.
    let ex0 = Infinity, ey0 = Infinity, ex1 = -1, ey1 = -1;
    for(let y = Math.max(0, -offs[i].y); y < Math.min(h, H - offs[i].y); y++){
      const row = (y + offs[i].y) * W + offs[i].x;
      for(let x = Math.max(0, -offs[i].x); x < Math.min(w, W - offs[i].x); x++) if(owner[row + x] === i){ if(x < ex0) ex0 = x; if(x > ex1) ex1 = x; if(y < ey0) ey0 = y; if(y > ey1) ey1 = y; }
    }
    if(ex1 < 0) return;
    const MARGIN = 4 * S;
    const gx0 = Math.max(0, ex0 - MARGIN) + offs[i].x, gx1 = Math.min(w, ex1 + 1 + MARGIN) + offs[i].x, gy0 = Math.max(0, ey0 - MARGIN) + offs[i].y, gy1 = Math.min(h, ey1 + 1 + MARGIN) + offs[i].y;
    const bx0 = Math.floor(gx0 / S) * S, by0 = Math.floor(gy0 / S) * S, bw = Math.ceil(gx1 / S) * S - bx0, bh = Math.ceil(gy1 / S) * S - by0;
    // Nivel 0: color premultiplicado por alfa (escala perceptual: raíz de la luz lineal) y máscara de dueño
    const pc = [new Float32Array(bw * bh), new Float32Array(bw * bh), new Float32Array(bw * bh)], pa = new Float32Array(bw * bh), pm = new Float32Array(bw * bh);
    for(let Y = Math.max(by0, offs[i].y, 0); Y < Math.min(by0 + bh, offs[i].y + h, H); Y++){
      const y = Y - offs[i].y;
      for(let X = Math.max(bx0, offs[i].x, 0); X < Math.min(bx0 + bw, offs[i].x + w, W); X++){
        const x = X - offs[i].x, s = (y * w + x) * 4; if(data[s + 3] <= 127) continue;
        const o = (Y - by0) * bw + (X - bx0);
        pc[0][o] = Math.sqrt(Math.min(1, TO_LIN[data[s]] * g)); pc[1][o] = Math.sqrt(Math.min(1, TO_LIN[data[s + 1]] * g)); pc[2][o] = Math.sqrt(Math.min(1, TO_LIN[data[s + 2]] * g));
        pa[o] = 1; if(owner[Y * W + X] === i) pm[o] = 1;
      }
    }
    // Pirámides gaussianas de color premultiplicado, alfa y máscara
    const PC = [pc], PA = [pa], PM = [pm];
    for(let l = 0; l < LV; l++){
      const wl = bw >> l, hl = bh >> l;
      PC.push(PC[l].map(ch => blurDown(ch, wl, hl))); PA.push(blurDown(PA[l], wl, hl)); PM.push(blurDown(PM[l], wl, hl));
    }
    // Colores por nivel (de lo grueso a lo fino), rellenando donde no hay imagen con lo que sube del nivel más grueso
    const C = Array(LV + 1), UP = Array(LV + 1);   // UP[l]: el nivel l+1 ya ampliado al tamaño del l (se usa dos veces)
    for(let l = LV; l >= 0; l--){
      const wl = bw >> l, hl = bh >> l, n = wl * hl, a = PA[l], cl = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
      const coarse = l < LV ? (UP[l] = C[l + 1].map(ch => up(ch, wl >> 1, hl >> 1))) : null;
      for(let k = 0; k < n; k++){
        if(a[k] > 1e-3){ for(let c = 0; c < 3; c++) cl[c][k] = PC[l][c][k] / a[k]; }
        else if(coarse){ for(let c = 0; c < 3; c++) cl[c][k] = coarse[c][k]; }
      }
      C[l] = cl;
    }
    // Bandas de Laplace por nivel, ponderadas por la máscara de ese nivel, acumuladas en el mosaico
    for(let l = 0; l <= LV; l++){
      const wl = bw >> l, hl = bh >> l, [Wl] = dims[l], ox = bx0 >> l, oy = by0 >> l;
      const coarse = l < LV ? UP[l] : null, m = PM[l];
      for(let y = 0; y < hl; y++) for(let x = 0; x < wl; x++){
        const wgt = m[y * wl + x]; if(wgt <= 1e-6) continue;
        const k = y * wl + x, o = (y + oy) * Wl + x + ox;
        for(let c = 0; c < 3; c++) acc[l][c][o] += (C[l][c][k] - (coarse ? coarse[c][k] : 0)) * wgt;
        wsum[l][o] += wgt;
      }
    }
  });

  // Normaliza cada nivel y recompone de lo grueso a lo fino
  let rec = null;
  for(let l = LV; l >= 0; l--){
    const [wl, hl] = dims[l], n = wl * hl, cur = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for(let k = 0; k < n; k++){ const s = wsum[l][k]; if(s > 1e-6) for(let c = 0; c < 3; c++) cur[c][k] = acc[l][c][k] / s; }
    if(rec){ for(let c = 0; c < 3; c++){ const u = up(rec[c], wl >> 1, hl >> 1); for(let k = 0; k < n; k++) cur[c][k] += u[k]; } }
    rec = cur;
  }
  const lin = new Float32Array(W * H * 3), cover = new Uint8Array(W * H), [w0] = dims[0];
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const o = y * W + x, k = y * w0 + x; if(wsum[0][k] <= 1e-6) continue;
    cover[o] = 1;
    for(let c = 0; c < 3; c++){ const v = rec[c][k], q = v < 0 ? 0 : v > 1 ? 1 : v; lin[o * 3 + c] = q * q; }
  }
  return { lin, cover };
}
