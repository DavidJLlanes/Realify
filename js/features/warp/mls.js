/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · MÍNIMOS CUADRADOS MÓVILES (MLS)
   Construye el campo (field.js) a partir de «manos»: el punto (x, y) de la foto pasa a (tx, ty). Para cada nodo de la rejilla se
   ajusta, con pesos 1/distancia^(2·alpha), una transformación (similitud, rígida o afín) y se obtiene la posición de origen.
   Restricciones: puntos fijos (no se mueven), anclas en el borde de la imagen, zonas protegidas (máscara 0-1: ahí el campo es
   exactamente cero) y líneas rectas (los destinos de una recta se proyectan sobre su mejor recta, así que siguen rectos).
   Entradas: W, H, manos y opciones. Salida: campo. Límites: sin DOM; coste ≈ nodos × manos (con 100 manos y una foto de 12 MP ≈ 0.3 s).
   ═══════════════════════════════════════════════════════════════ */
import { crearCampo } from "./field.js";

/* Destinos de cada recta proyectados sobre la recta de mejor ajuste (por componentes principales). */
export function enderezar(manos, rectas){
  const r = manos.map(m => ({ ...m }));
  for(const idx of rectas){
    if(idx.length < 3) continue;
    let cx = 0, cy = 0; for(const i of idx){ cx += r[i].tx; cy += r[i].ty; } cx /= idx.length; cy /= idx.length;
    let sxx = 0, sxy = 0, syy = 0;
    for(const i of idx){ const a = r[i].tx - cx, b = r[i].ty - cy; sxx += a * a; sxy += a * b; syy += b * b; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(th), uy = Math.sin(th);
    for(const i of idx){ const t = (r[i].tx - cx) * ux + (r[i].ty - cy) * uy; r[i].tx = cx + t * ux; r[i].ty = cy + t * uy; }
  }
  return r;
}

function anclas(W, H){
  const n = Math.max(2, Math.round(Math.max(W, H) / Math.min(W, H) * 3)), a = [];
  for(let k = 0; k <= n; k++){ const x = W * k / n, y = H * k / n; a.push([x, 0], [x, H], [0, y], [W, y]); }
  return a.map(([x, y]) => ({ x, y, tx: x, ty: y }));
}

/* Factor de protección por nodo: 0 si algún píxel de su vecindad (±paso) está protegido, para que ningún píxel protegido se mueva. */
function libre(W, H, c, prot){
  const f = new Float32Array(c.gw * c.gh).fill(1), p = c.paso;
  for(let j = 0; j < c.gh; j++) for(let i = 0; i < c.gw; i++){
    let m = 1;
    const x0 = Math.max(0, i * p - p), x1 = Math.min(W - 1, i * p + p), y0 = Math.max(0, j * p - p), y1 = Math.min(H - 1, j * p + p);
    for(let y = y0; y <= y1 && m > 0; y++) for(let x = x0; x <= x1; x++){ const v = 1 - prot[y * W + x]; if(v < m) m = v; }
    f[j * c.gw + i] = m;
  }
  return f;
}

export function campoMLS(W, H, manos, { paso = 8, alpha = 1, modo = "similitud", fijos = [], protegida = null, rectas = [], bordes = true } = {}){
  const c = crearCampo(W, H, paso);
  const hs = [...enderezar(manos, rectas), ...fijos.map(f => ({ x: f.x, y: f.y, tx: f.x, ty: f.y })), ...(bordes ? anclas(W, H) : [])];
  const n = hs.length; if(!manos.length) return c;
  const px = new Float64Array(n), py = new Float64Array(n), qx = new Float64Array(n), qy = new Float64Array(n);
  hs.forEach((h, i) => { px[i] = h.tx; py[i] = h.ty; qx[i] = h.x; qy[i] = h.y; });          // p = destino, q = origen (mapa hacia atrás)
  const w = new Float64Array(n), fr = protegida ? libre(W, H, c, protegida) : null;
  for(let j = 0; j < c.gh; j++) for(let i = 0; i < c.gw; i++){
    const vx = i * paso, vy = j * paso, o = j * c.gw + i;
    if(fr && fr[o] === 0) continue;
    let sw = 0, pcx = 0, pcy = 0, qcx = 0, qcy = 0, hit = -1;
    for(let k = 0; k < n; k++){
      const d2 = (px[k] - vx) ** 2 + (py[k] - vy) ** 2;
      if(d2 < 1e-9){ hit = k; break; }
      const wk = 1 / d2 ** alpha; w[k] = wk; sw += wk; pcx += wk * px[k]; pcy += wk * py[k]; qcx += wk * qx[k]; qcy += wk * qy[k];
    }
    let fx, fy;
    if(hit >= 0){ fx = qx[hit]; fy = qy[hit]; }
    else {
      pcx /= sw; pcy /= sw; qcx /= sw; qcy /= sw;
      let nr = 0, ni = 0, den = 0, a00 = 0, a01 = 0, a11 = 0, b00 = 0, b01 = 0, b10 = 0, b11 = 0;
      for(let k = 0; k < n; k++){
        const ax = px[k] - pcx, ay = py[k] - pcy, bx = qx[k] - qcx, by = qy[k] - qcy, wk = w[k];
        nr += wk * (ax * bx + ay * by); ni += wk * (ax * by - ay * bx); den += wk * (ax * ax + ay * ay);
        a00 += wk * ax * ax; a01 += wk * ax * ay; a11 += wk * ay * ay;
        b00 += wk * ax * bx; b01 += wk * ax * by; b10 += wk * ay * bx; b11 += wk * ay * by;
      }
      const ux = vx - pcx, uy = vy - pcy, det = a00 * a11 - a01 * a01;
      if(modo === "afin" && det > 1e-6 * (a00 + a11) ** 2){
        const m00 = (a11 * b00 - a01 * b10) / det, m01 = (a11 * b01 - a01 * b11) / det, m10 = (a00 * b10 - a01 * b00) / det, m11 = (a00 * b11 - a01 * b01) / det;
        fx = ux * m00 + uy * m10 + qcx; fy = ux * m01 + uy * m11 + qcy;
      } else {
        let re = nr / den, im = ni / den;
        if(modo === "rigida"){ const m = Math.hypot(nr, ni) || 1; re = nr / m; im = ni / m; }
        fx = re * ux - im * uy + qcx; fy = re * uy + im * ux + qcy;
      }
    }
    const t = fr ? fr[o] : 1;
    c.dx[o] = (fx - vx) * t; c.dy[o] = (fy - vy) * t;
  }
  return c;
}
