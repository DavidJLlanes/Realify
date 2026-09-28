/* ═══════════════════════════════════════════════════════════════
   UNIR · MOTOR DE PANORÁMICAS
   Funciones puras (sin DOM) que usa el worker:

     1. Proyección cilíndrica (o plana) de cada foto, con el campo de
        visión horizontal de la cámara.
     2. Posición de cada foto respecto a la anterior: búsqueda en
        pirámide del desplazamiento que mejor casa los GRADIENTES del
        logaritmo de la luminancia en la zona solapada (insensible a
        diferencias de exposición entre tomas).
     3. Compensación de exposición: ganancia por foto a partir del
        brillo medio de las zonas solapadas.
     4. Mezcla con transición suave (pesos por distancia al borde) y
        recorte automático al mayor rectángulo sin huecos.
   ═══════════════════════════════════════════════════════════════ */

const TO_LIN = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; TO_LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
const enc = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; return (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255; };

/** Escala una imagen RGBA a un alto (o ancho) dado, bilineal. */
export function resize(img, W, H){
  const { w, h, data } = img, out = new Uint8ClampedArray(W * H * 4);
  const sx = w / W, sy = h / H;
  for(let y = 0; y < H; y++){
    const fy = Math.min(h - 1, Math.max(0, (y + .5) * sy - .5)), y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < W; x++){
      const fx = Math.min(w - 1, Math.max(0, (x + .5) * sx - .5)), x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      const o = (y * W + x) * 4, a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, d = (y1 * w + x1) * 4;
      for(let k = 0; k < 4; k++) out[o + k] = (data[a + k] + (data[b + k] - data[a + k]) * tx) * (1 - ty) + (data[c + k] + (data[d + k] - data[c + k]) * tx) * ty;
    }
  }
  return { w: W, h: H, data: out };
}

/** Proyección cilíndrica (eje vertical si `vertical` es false). fov en
    grados sobre el lado que avanza la panorámica. Devuelve RGBA con
    alfa 0 fuera de la foto. */
export function cylindrical(img, fov, vertical = false){
  const { w, h, data } = img;
  const L = vertical ? h : w;
  const f = (L / 2) / Math.tan((fov * Math.PI / 180) / 2);
  const Lo = Math.round(2 * f * Math.atan(L / (2 * f)));
  const W = vertical ? w : Lo, H = vertical ? Lo : h;
  const out = new Uint8ClampedArray(W * H * 4), xc = w / 2, yc = h / 2, xo = W / 2, yo = H / 2;
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    let sx, sy;
    if(!vertical){ const th = (x - xo) / f, hh = (y - yo) / f; sx = f * Math.tan(th) + xc; sy = hh * f / Math.cos(th) + yc; }
    else { const th = (y - yo) / f, hh = (x - xo) / f; sy = f * Math.tan(th) + yc; sx = hh * f / Math.cos(th) + xc; }
    if(sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) continue;
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = sx - x0, ty = sy - y0;
    const o = (y * W + x) * 4, a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, d = (y1 * w + x1) * 4;
    for(let k = 0; k < 3; k++) out[o + k] = (data[a + k] + (data[b + k] - data[a + k]) * tx) * (1 - ty) + (data[c + k] + (data[d + k] - data[c + k]) * tx) * ty;
    out[o + 3] = 255;
  }
  return { w: W, h: H, data: out };
}

/* Logaritmo de la luminancia y validez (alfa y ni quemado ni negro). */
function logLum(img){
  const { w, h, data } = img, l = new Float32Array(w * h), v = new Uint8Array(w * h);
  for(let p = 0, i = 0; p < l.length; p++, i += 4){
    const r = data[i], g = data[i + 1], b = data[i + 2];
    l[p] = Math.log2(TO_LIN[r] * .2126 + TO_LIN[g] * .7152 + TO_LIN[b] * .0722 + 1e-3);
    v[p] = data[i + 3] > 200 && Math.max(r, g, b) < 250 ? 1 : 0;
  }
  return { w, h, l, v };
}
function halve(m){
  const W = m.w >> 1, H = m.h >> 1, l = new Float32Array(W * H), v = new Uint8Array(W * H);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const i = 2 * y * m.w + 2 * x, o = y * W + x;
    l[o] = (m.l[i] + m.l[i + 1] + m.l[i + m.w] + m.l[i + m.w + 1]) / 4;
    v[o] = m.v[i] & m.v[i + 1] & m.v[i + m.w] & m.v[i + m.w + 1];
  }
  return { w: W, h: H, l, v };
}
/* Error medio de gradientes con `b` colocada en (dx, dy) respecto a `a`. */
function err(a, b, dx, dy, step = 1){
  const x0 = Math.max(0, dx), x1 = Math.min(a.w - 1, dx + b.w - 1), y0 = Math.max(0, dy), y1 = Math.min(a.h - 1, dy + b.h - 1);
  if(x1 - x0 < 4 || y1 - y0 < 4) return { e: Infinity, n: 0 };
  /* Correlación normalizada de los gradientes: 1 = casan perfectamente.
     El error medio de antes premiaba solapar zonas lisas (cielo, piel),
     que casan con cualquier cosa; la correlación sólo sube si los bordes
     y texturas coinciden de verdad. */
  let sab = 0, saa = 0, sbb = 0, n = 0;
  for(let y = y0; y < y1; y += step){
    for(let x = x0; x < x1; x += step){
      const ia = y * a.w + x, ib = (y - dy) * b.w + (x - dx);
      if(!(a.v[ia] & a.v[ia + 1] & a.v[ia + a.w] & b.v[ib] & b.v[ib + 1] & b.v[ib + b.w])) continue;
      const gxa = a.l[ia + 1] - a.l[ia], gya = a.l[ia + a.w] - a.l[ia];
      const gxb = b.l[ib + 1] - b.l[ib], gyb = b.l[ib + b.w] - b.l[ib];
      sab += gxa * gxb + gya * gyb; saa += gxa * gxa + gya * gya; sbb += gxb * gxb + gyb * gyb;
      n++;
    }
  }
  if(n < 50 || saa < 1e-6 || sbb < 1e-6) return { e: Infinity, n };
  return { e: 1 - sab / Math.sqrt(saa * sbb), n };
}

/** Posición de `b` respecto a `a` (esquina superior izquierda de b en
    coordenadas de a). dir: "h", "v" o "auto". Devuelve también el
    error, para decidir la dirección o avisar si no se encontró. */
export function pairOffset(a, b, dir = "auto"){
  const pa = [logLum(a)], pb = [logLum(b)];
  while(Math.min(pa[pa.length - 1].w, pa[pa.length - 1].h, pb[pb.length - 1].w, pb[pb.length - 1].h) > 90 && pa.length < 8){
    pa.push(halve(pa[pa.length - 1])); pb.push(halve(pb[pb.length - 1]));
  }
  const top = pa.length - 1, A = pa[top], B = pb[top];
  const cand = [];
  const tryDir = d => {
    // Búsqueda completa en el nivel más pequeño: solape entre el 8 % y el 92 %.
    const along = d === "h" ? A.w : A.h, across = d === "h" ? A.h : A.w;
    const lo = Math.round(along * 0.08), hi = Math.round(along * 0.92), cr = Math.round(across * 0.2);
    let best = { e: Infinity };
    for(const sign of [1, -1]){
      for(let t = lo; t <= hi; t++){
        const pos = sign > 0 ? t : -(d === "h" ? B.w : B.h) + (along - t);
        for(let c = -cr; c <= cr; c++){
          const dx = d === "h" ? pos : c, dy = d === "h" ? c : pos;
          const r = err(A, B, dx, dy);
          // Se premia un poco el solape grande (evita casar sólo una franja estrecha)
          const score = r.e * (1 + 30 / Math.max(30, r.n));
          if(score < best.e) best = { e: score, dx, dy };
        }
      }
    }
    return best;
  };
  if(dir === "h" || dir === "auto") cand.push({ ...tryDir("h"), d: "h" });
  if(dir === "v" || dir === "auto") cand.push({ ...tryDir("v"), d: "v" });
  let { dx, dy, d, e } = cand.sort((x, y) => x.e - y.e)[0];
  if(!Number.isFinite(e)) return null;
  // Refinado por niveles (±2 px en cada uno)
  for(let l = top - 1; l >= 0; l--){
    dx *= 2; dy *= 2;
    let best = Infinity, bx = dx, by = dy;
    for(let j = -2; j <= 2; j++) for(let i = -2; i <= 2; i++){
      const r = err(pa[l], pb[l], dx + i, dy + j, l === 0 ? 1 : 1);
      if(r.e < best){ best = r.e; bx = dx + i; by = dy + j; }
    }
    dx = bx; dy = by; e = best;
  }
  return { dx, dy, d, e };
}

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

/** Calcula posiciones (en coordenadas de la panorámica) y ganancias. */
export function layout(imgs, dir = "auto"){
  const pos = [{ x: 0, y: 0 }], gains = [1], found = [true];
  let d = dir;
  for(let i = 1; i < imgs.length; i++){
    const r = pairOffset(imgs[i - 1], imgs[i], d);
    if(!r){ found.push(false); const p = pos[i - 1]; pos.push(d === "v" ? { x: p.x, y: p.y + imgs[i - 1].h } : { x: p.x + imgs[i - 1].w, y: p.y }); gains.push(gains[i - 1]); continue; }
    if(d === "auto") d = r.d;   // la primera pareja decide la dirección
    found.push(true);
    pos.push({ x: pos[i - 1].x + r.dx, y: pos[i - 1].y + r.dy });
    gains.push(gains[i - 1] * overlapGain(imgs[i - 1], imgs[i], r.dx, r.dy));
  }
  // Ganancias normalizadas a media geométrica 1
  const g = Math.exp(gains.reduce((s, v) => s + Math.log(v), 0) / gains.length);
  return { pos, gains: gains.map(v => v / g), dir: d === "auto" ? "h" : d, found };
}

/** Mezcla. `blend` (px) = ancho de la transición; `useGain` iguala la
    exposición; `crop` recorta al mayor rectángulo cubierto. */
export function compose(imgs, L, { blend = 60, useGain = true, crop = true } = {}){
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  imgs.forEach((im, i) => { const p = L.pos[i]; minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + im.w); maxY = Math.max(maxY, p.y + im.h); });
  const W = Math.round(maxX - minX), H = Math.round(maxY - minY), N = W * H;
  const acc = new Float32Array(N * 3), wsum = new Float32Array(N);
  const F = Math.max(1, blend);
  imgs.forEach((im, i) => {
    const ox = Math.round(L.pos[i].x - minX), oy = Math.round(L.pos[i].y - minY), g = useGain ? L.gains[i] : 1;
    // Distancia al borde de la zona válida (alfa), por filas y columnas
    const { w, h, data } = im;
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
    for(let y = 0; y < h; y++){
      const Y = y + oy; if(Y < 0 || Y >= H) continue;
      for(let x = 0; x < w; x++){
        const X = x + ox; if(X < 0 || X >= W) continue;
        const s = (y * w + x) * 4; if(data[s + 3] < 128) continue;
        const d = dist[y * w + x], wt = Math.min(1, d / F) ** 2 + 1e-4, o = Y * W + X;
        acc[o * 3] += TO_LIN[data[s]] * g * wt; acc[o * 3 + 1] += TO_LIN[data[s + 1]] * g * wt; acc[o * 3 + 2] += TO_LIN[data[s + 2]] * g * wt;
        wsum[o] += wt;
      }
    }
  });
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
