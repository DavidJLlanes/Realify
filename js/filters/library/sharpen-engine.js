/* ═══════════════════════════════════════════════════════════════
   MOTOR DE «ENFOQUE AVANZADO / ESTABILIZADOR»
   Todo en coma flotante y sobre la LUMINANCIA: el detalle recuperado se
   suma por igual a R, G y B, así que el enfoque no tiñe los bordes ni
   multiplica el ruido de color (antes se enfocaba cada canal por
   separado, con su propio umbral).

   Tres métodos, con los mismos mandos:
     · unsharp — máscara de enfoque clásica: Y + cantidad·(Y − G(Y)).
     · focus   — deconvolución de foco (Van Cittert, 3 pasadas) con un
                 desenfoque gaussiano como PSF: recupera más detalle
                 real que la máscara para el mismo radio.
     · motion  — deconvolución (Landweber, 6 pasadas) con una PSF de
                 movimiento en línea recta (2 × radio de largo, en el
                 ángulo elegido).
   Después:
     · Umbral: rampa suave (no corta en seco) sobre el detalle.
     · Proteger bordes: menos enfoque donde ya hay un borde fuerte.
     · Reducir halos: limita lo que el resultado se pasa del mínimo y el
       máximo de sus vecinos (el halo es justo ese exceso).
   Cubre toda la imagen, bordes incluidos (los vecinos fuera se repiten).
   Sin DOM: se puede probar en Node.
   ═══════════════════════════════════════════════════════════════ */

/* Desenfoque gaussiano separable con borde repetido. Para σ ≤ 0,8,
   núcleo exacto; por encima, tres cajas (mismo resultado a la vista y
   coste fijo por píxel, sea cual sea el radio). */
function hPassKernel(src, dst, w, h, k, R){
  for(let y = 0; y < h; y++){
    const o = y * w;
    for(let x = 0; x < w; x++){
      let s = 0;
      if(x >= R && x < w - R){ const b = o + x - R; for(let t = 0; t < k.length; t++) s += src[b + t] * k[t]; }
      else for(let t = -R; t <= R; t++){ let xx = x + t; xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx; s += src[o + xx] * k[t + R]; }
      dst[o + x] = s;
    }
  }
}
// Vertical por filas enteras (acceso secuencial a memoria)
function vPassKernel(src, dst, w, h, k, R){
  for(let y = 0; y < h; y++){
    const o = y * w;
    for(let x = 0; x < w; x++) dst[o + x] = 0;
    for(let t = -R; t <= R; t++){
      let yy = y + t; yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy;
      const r = yy * w, kt = k[t + R];
      for(let x = 0; x < w; x++) dst[o + x] += src[r + x] * kt;
    }
  }
}
function boxH(src, dst, w, h, r){
  const n = 2 * r + 1;
  for(let y = 0; y < h; y++){
    const o = y * w;
    let s = 0;
    for(let t = -r; t <= r; t++) s += src[o + (t < 0 ? 0 : t >= w ? w - 1 : t)];
    for(let x = 0; x < w; x++){
      dst[o + x] = s / n;
      const a = x + r + 1, b = x - r;
      s += src[o + (a >= w ? w - 1 : a)] - src[o + (b < 0 ? 0 : b)];
    }
  }
}
// Caja vertical con sumas por columna que avanzan fila a fila
function boxV(src, dst, w, h, r){
  const n = 2 * r + 1, sum = new Float64Array(w);
  for(let t = -r; t <= r; t++){ const q = (t < 0 ? 0 : t >= h ? h - 1 : t) * w; for(let x = 0; x < w; x++) sum[x] += src[q + x]; }
  for(let y = 0; y < h; y++){
    const o = y * w;
    for(let x = 0; x < w; x++) dst[o + x] = sum[x] / n;
    const a = (y + r + 1 >= h ? h - 1 : y + r + 1) * w, b = (y - r < 0 ? 0 : y - r) * w;
    for(let x = 0; x < w; x++) sum[x] += src[a + x] - src[b + x];
  }
}
export function gaussBlur(src, w, h, sigma){
  const out = new Float32Array(src.length);
  if(sigma < 0.2){ out.set(src); return out; }
  const tmp = new Float32Array(src.length);
  if(sigma <= 0.8){
    const R = Math.ceil(3 * sigma), k = new Float32Array(2 * R + 1);
    let sum = 0;
    for(let t = -R; t <= R; t++) sum += k[t + R] = Math.exp(-t * t / (2 * sigma * sigma));
    for(let i = 0; i < k.length; i++) k[i] /= sum;
    hPassKernel(src, tmp, w, h, k, R); vPassKernel(tmp, out, w, h, k, R);
    return out;
  }
  // Tres cajas equivalentes a la gaussiana (Kovesi), alternando búferes
  const wIdeal = Math.sqrt(12 * sigma * sigma / 3 + 1);
  let wl = Math.floor(wIdeal); if(wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4));
  let a = src;
  for(let i = 0; i < 3; i++){
    const r = ((i < m ? wl : wl + 2) - 1) / 2;
    boxH(a, tmp, w, h, r); boxV(tmp, out, w, h, r);
    a = out;            // boxH lee de `out` y escribe en `tmp`: no se pisan
  }
  return out;
}

/* PSF de movimiento: media a lo largo de una línea de longitud 2·len
   centrada en cada píxel (interpolación bilineal). */
export function lineBlur(src, w, h, len, angleDeg){
  const out = new Float32Array(src.length);
  if(len < 0.3){ out.set(src); return out; }
  const a = angleDeg * Math.PI / 180, cx = Math.cos(a), cy = Math.sin(a);
  const n = Math.max(2, Math.ceil(len * 2)), inv = 1 / (n + 1);
  const xs = new Int32Array(w), xs1 = new Int32Array(w);
  /* Cada muestra de la línea es un desplazamiento fijo para toda la
     imagen: los pesos bilineales son constantes y se recorre por filas. */
  for(let i = 0; i <= n; i++){
    const t = -len + 2 * len * i / n, dx = t * cx, dy = t * cy;
    const ix = Math.floor(dx), iy = Math.floor(dy), fx = dx - ix, fy = dy - iy;
    const w00 = (1 - fx) * (1 - fy) * inv, w10 = fx * (1 - fy) * inv, w01 = (1 - fx) * fy * inv, w11 = fx * fy * inv;
    for(let x = 0; x < w; x++){
      let u = x + ix; xs[x] = u < 0 ? 0 : u >= w ? w - 1 : u;
      u = x + ix + 1; xs1[x] = u < 0 ? 0 : u >= w ? w - 1 : u;
    }
    for(let y = 0; y < h; y++){
      let y0 = y + iy, y1 = y0 + 1;
      y0 = y0 < 0 ? 0 : y0 >= h ? h - 1 : y0; y1 = y1 < 0 ? 0 : y1 >= h ? h - 1 : y1;
      const r0 = y0 * w, r1 = y1 * w, o = y * w;
      for(let x = 0; x < w; x++){
        const a0 = xs[x], a1 = xs1[x];
        out[o + x] += src[r0 + a0] * w00 + src[r0 + a1] * w10 + src[r1 + a0] * w01 + src[r1 + a1] * w11;
      }
    }
  }
  return out;
}

/** Filas de margen que necesita una franja para salir idéntica al
 *  cálculo de la imagen entera (alcance de todas las pasadas). */
export function sharpenMargin(p, scale = 1){
  const r = Math.max(0.1, p.radius * scale);
  const reach = p.mode === "motion" ? Math.ceil(r) + 1 : Math.ceil(3.5 * r) + 2;
  const passes = p.mode === "motion" ? 12 : p.mode === "focus" ? 3 : 1;
  return passes * reach + 2;
}

/**
 * Enfoca `data` (RGBA de 8 bits, se modifica en su sitio).
 * p: { mode, amount (%), radius (px), threshold (0–40), edge (%), halo (%), angle (°) }
 * scale: factor de la copia reducida de la vista previa (1 = tamaño real).
 */
export function sharpenRGBA(data, w, h, p, scale = 1){
  const n = w * h, Y = new Float32Array(n);
  for(let i = 0, j = 0; i < n; i++, j += 4) Y[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  const r = Math.max(0.1, p.radius * scale);
  const psf = p.mode === "motion" ? (a => lineBlur(a, w, h, r, p.angle || 0)) : (a => gaussBlur(a, w, h, r));
  // Detalle recuperado (sin multiplicar aún por la cantidad)
  let D;
  if(p.mode === "unsharp"){
    const B = psf(Y); D = B;
    for(let i = 0; i < n; i++) D[i] = Y[i] - B[i];
  }else if(p.mode === "focus"){
    // Van Cittert: e ← e + (Y − PSF(e)); el detalle es e − Y
    let e = Y;
    for(let it = 0; it < 3; it++){
      const B = psf(e), ne = new Float32Array(n);
      for(let i = 0; i < n; i++){ const v = e[i] + (Y[i] - B[i]); ne[i] = v < -64 ? -64 : v > 319 ? 319 : v; }
      e = ne;
    }
    D = e;
    for(let i = 0; i < n; i++) D[i] = e[i] - Y[i];
  }else{
    /* Movimiento: Landweber, e ← e + β·PSF(Y − PSF(e)). Van Cittert
       diverge con una PSF en línea (su respuesta tiene lóbulos
       negativos y esas frecuencias crecen en cada pasada); Landweber
       converge siempre. Con una foto movida de prueba: +2,5 dB. */
    const e = Float32Array.from(Y);
    for(let it = 0; it < 6; it++){
      const r = psf(e);
      for(let i = 0; i < n; i++) r[i] = Y[i] - r[i];
      const g = psf(r);
      for(let i = 0; i < n; i++){ const v = e[i] + 1.8 * g[i]; e[i] = v < -64 ? -64 : v > 319 ? 319 : v; }
    }
    D = e;
    for(let i = 0; i < n; i++) D[i] = e[i] - Y[i];
  }
  const amt = p.amount / 100, t = p.threshold || 0, edgeK = (p.edge || 0) / 100, halo = Math.min(1, (p.halo || 0) / 100);
  for(let y = 0; y < h; y++){
    const o = y * w, up = (y > 0 ? y - 1 : y) * w, dn = (y < h - 1 ? y + 1 : y) * w;
    for(let x = 0; x < w; x++){
      const i = o + x, xl = x > 0 ? x - 1 : x, xr = x < w - 1 ? x + 1 : x;
      let d = D[i];
      const ad = d < 0 ? -d : d;
      // Umbral con rampa suave entre t y 2t
      if(t > 0){ if(ad <= t) continue; if(ad < 2 * t) d *= (ad - t) / t; }
      if(edgeK > 0){
        const gx = Y[o + xr] - Y[o + xl], gy = Y[dn + x] - Y[up + x];
        const g = (gx < 0 ? -gx : gx) + (gy < 0 ? -gy : gy);
        d *= 1 - edgeK * (g > 255 ? 1 : g / 255);
      }
      let v = Y[i] + d * amt;
      if(halo > 0){
        /* Sólo hace falta el extremo hacia el que se mueve: el máximo
           de la vecindad 3×3 si sube, el mínimo si baja. */
        const c = [Y[up + xl], Y[up + x], Y[up + xr], Y[o + xl], Y[o + xr], Y[dn + xl], Y[dn + x], Y[dn + xr]];
        if(v > Y[i]){ let hi = Y[i]; for(let k = 0; k < 8; k++) if(c[k] > hi) hi = c[k]; if(v > hi) v = hi + (v - hi) * (1 - halo); }
        else { let lo = Y[i]; for(let k = 0; k < 8; k++) if(c[k] < lo) lo = c[k]; if(v < lo) v = lo - (lo - v) * (1 - halo); }
      }
      const dy = v - Y[i], j = i * 4;
      data[j] = data[j] + dy; data[j + 1] = data[j + 1] + dy; data[j + 2] = data[j + 2] + dy;   // Uint8Clamped: redondea y recorta
    }
  }
  return data;
}
