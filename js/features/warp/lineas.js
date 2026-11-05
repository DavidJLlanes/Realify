/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · LÍNEAS RECTAS DEL FONDO
   Un modelo de relleno rompe las rectas del fondo (marcos, horizonte, juntas) que atraviesan el hueco. Aquí se detectan las rectas
   del fondo alrededor del hueco con una transformada de Hough guiada por la dirección del gradiente (lineas) y se vuelven a pintar
   dentro del hueco continuando el perfil de la recta desde fuera (pintarLineas), con borde suave.
   Entradas: RGBA, ancho, alto, hueco (0/1) y excluir (0/1: hueco + persona, no se mira ahí). Salida: lista de rectas { th, rho } y la
   imagen retocada. Sin DOM. Límites: sólo rectas de un borde claro y de longitud suficiente; las curvas se dejan al modelo.
   ═══════════════════════════════════════════════════════════════ */
import { gauss } from "../portrait/shared/blur.js";

const luma = (d, i) => (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;

/* Rectas del fondo cerca del hueco: [{ th, rho, votos }] con normal n = (cos th, sin th) y recta n·p = rho. */
export function lineas(rgba, W, H, hueco, excluir, { radio = 60, minVotos = 0, umbral = 0.06, max = 8 } = {}){
  const Y = new Float32Array(W * H); for(let i = 0; i < Y.length; i++) Y[i] = luma(rgba, i);
  const cerca = gauss(hueco, W, H, radio / 3), lejos = gauss(excluir, W, H, 2);        // anillo alrededor del hueco; lejos de la persona
  const NT = 180, diag = Math.ceil(Math.hypot(W, H)), NR = diag * 2 + 1, acc = new Float32Array(NT * NR);
  const need = minVotos || Math.max(20, Math.round(Math.max(W, H) * 0.03));
  for(let y = 1; y < H - 1; y++) for(let x = 1; x < W - 1; x++){
    const i = y * W + x; if(cerca[i] < 0.02 || lejos[i] > 0.02) continue;
    const gx = Y[i + 1] - Y[i - 1], gy = Y[i + W] - Y[i - W], m = Math.hypot(gx, gy) / 2; if(m < umbral) continue;
    const th0 = (Math.atan2(gy, gx) * 180 / Math.PI + 180) % 180;
    for(let dt = -1; dt <= 1; dt++){
      const t = (Math.round(th0) + dt + NT) % NT, a = t * Math.PI / 180, rho = Math.round(x * Math.cos(a) + y * Math.sin(a)) + diag;
      acc[t * NR + rho] += dt === 0 ? 1 : 0.5;
    }
  }
  for(let t = 0; t < NT; t++){ const f = acc.slice(t * NR, (t + 1) * NR); for(let r = 1; r < NR - 1; r++) acc[t * NR + r] = f[r - 1] + f[r] + f[r + 1]; }      // la recta cae entre dos celdas de rho
  const celdas = []; for(let i = 0; i < acc.length; i++) if(acc[i] >= need) celdas.push(i);
  celdas.sort((a, b) => acc[b] - acc[a]);
  const res = [];
  for(const c of celdas){
    const t = Math.floor(c / NR), rho = c % NR - diag;
    if(res.some(r => Math.min(Math.abs(r.t - t), NT - Math.abs(r.t - t)) < 3 && Math.abs(r.rho - rho) < 4)) continue;
    res.push({ t, th: t * Math.PI / 180, rho, votos: acc[c] }); if(res.length >= max) break;
  }
  return res;
}

/* Perfil de la recta en el parámetro t, s = -w..w, tomado de la imagen original. null si algún punto cae en `excluir`. */
function perfil(rgba, W, H, excluir, L, t, w){
  const ux = -Math.sin(L.th), uy = Math.cos(L.th), nx = Math.cos(L.th), ny = Math.sin(L.th), out = [];
  for(let s = -w; s <= w; s++){
    const x = nx * (L.rho + s) + ux * t, y = ny * (L.rho + s) + uy * t;                // posición real: se interpola, no se redondea
    const x0 = Math.floor(x), y0 = Math.floor(y); if(x0 < 0 || y0 < 0 || x0 + 1 >= W || y0 + 1 >= H) return null;
    if(excluir[y0 * W + x0] > 0.5 || excluir[y0 * W + x0 + 1] > 0.5 || excluir[(y0 + 1) * W + x0] > 0.5 || excluir[(y0 + 1) * W + x0 + 1] > 0.5) return null;
    const u = x - x0, v = y - y0, o = (y0 * W + x0) * 4, c = k => rgba[o + k] * (1 - u) * (1 - v) + rgba[o + 4 + k] * u * (1 - v) + rgba[o + W * 4 + k] * (1 - u) * v + rgba[o + W * 4 + 4 + k] * u * v;
    out.push([c(0), c(1), c(2)]);
  }
  return out;
}

function extremo(rgba, W, H, excluir, L, t0, paso, w){
  for(let k = 0; k < 60; k++){
    const t = t0 + paso * k, ps = [];
    for(let j = 0; j < 3; j++){ const p = perfil(rgba, W, H, excluir, L, t - paso * j, w); if(p) ps.push(p); }
    if(ps.length === 3) return { t, p: ps[0].map((_, s) => [0, 1, 2].map(c => (ps[0][s][c] + ps[1][s][c] + ps[2][s][c]) / 3)) };
  }
  return null;
}

/* Vuelve a pintar las rectas dentro del hueco sobre `out` (RGBA ya rellenado). Devuelve el número de rectas pintadas. */
export function pintarLineas(out, rgba, W, H, hueco, excluir, rectas, { w = 5 } = {}){
  let hechas = 0;
  for(const L of rectas){
    const ux = -Math.sin(L.th), uy = Math.cos(L.th), nx = Math.cos(L.th), ny = Math.sin(L.th), px = [];
    let tmin = Infinity, tmax = -Infinity;
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      if(hueco[y * W + x] < 0.5) continue;
      if(Math.abs(nx * x + ny * y - L.rho) > w + 1) continue;
      const t = ux * x + uy * y; px.push(x, y, t); if(t < tmin) tmin = t; if(t > tmax) tmax = t;
    }
    if(!px.length) continue;
    const A = extremo(rgba, W, H, excluir, L, tmin - 1, -1, w), B = extremo(rgba, W, H, excluir, L, tmax + 1, 1, w);
    if(!A && !B) continue;
    for(let k = 0; k < px.length; k += 3){
      const x = px[k], y = px[k + 1], t = px[k + 2], s = nx * x + ny * y - L.rho;
      const fs = Math.min(2 * w - 0.001, Math.max(0, s + w)), s0 = Math.floor(fs), su = fs - s0;
      const en = (P, c) => P[s0][c] * (1 - su) + P[s0 + 1][c] * su;                  // perfil interpolado en s (no redondeado)
      const f = A && B ? Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t))) : 0, pr = [0, 1, 2].map(c => A && B ? en(A.p, c) * (1 - f) + en(B.p, c) * f : en((A || B).p, c));
      const al = Math.max(0, Math.min(1, (w + 1 - Math.abs(s)) / 2)), o = (y * W + x) * 4;
      for(let c = 0; c < 3; c++) out[o + c] = out[o + c] * (1 - al) + pr[c] * al;
    }
    hechas++;
  }
  return hechas;
}
