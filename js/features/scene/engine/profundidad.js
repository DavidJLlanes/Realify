/* ═══════════════════════════════════════════════════════════════
   ESCENA · EFECTOS CON PROFUNDIDAD (puro, sin DOM)
   · Aberración cromática: los canales rojo y azul se desplazan en radial desde el centro, y el desplazamiento crece con la DISTANCIA
     (u = 1 − d), como un objetivo que se resiente en lo lejano.
   · Luz direccional con relieve: normales a partir del gradiente del mapa de profundidad (suavizado), luz de Lambert (js/features/relight/) y
     ganancia multiplicativa alrededor de su media, así no cambia la exposición media.
   Entradas: planos (se modifican), profundidad d (1 = cerca, 0 = lejos), valores. Salida: nada.
   ═══════════════════════════════════════════════════════════════ */
import { gauss } from "../../portrait/shared/blur.js";
import { lambert } from "../../relight/light.js";

export const hayCroma = v => (v.fuerza || 0) > 0;
export const hayRelieve = v => (v.intensidad || 0) > 0;

function muestra(a, W, H, x, y){
  x = Math.min(W - 1.001, Math.max(0, x)); y = Math.min(H - 1.001, Math.max(0, y));
  const x0 = x | 0, y0 = y | 0, tx = x - x0, ty = y - y0, i = y0 * W + x0;
  return (a[i] * (1 - tx) + a[i + 1] * tx) * (1 - ty) + (a[i + W] * (1 - tx) + a[i + W + 1] * tx) * ty;
}

export function cromaProfundidad(p, d, v){
  const { W, H, R, B, G } = p, f = Math.min(100, Math.max(0, v.fuerza || 0)) / 100, max = 0.003 * Math.max(W, H) * f, cx = W / 2, cy = H / 2, rad = Math.hypot(cx, cy);
  if(max <= 0) return;
  const R0 = Float32Array.from(R), B0 = Float32Array.from(B);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const i = y * W + x, dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) / rad, u = 1 - Math.min(1, Math.max(0, d[i])), a = max * (0.25 + 0.75 * u) * r, l = Math.hypot(dx, dy) || 1;
    R[i] = muestra(R0, W, H, x - dx / l * a, y - dy / l * a); B[i] = muestra(B0, W, H, x + dx / l * a, y + dy / l * a);
    p.Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
  }
}

export function normalesProfundidad(d, W, H, relieve){
  const s = gauss(d, W, H, Math.max(1.5, Math.sqrt(W * H) * 0.004)), nx = new Float32Array(W * H), ny = new Float32Array(W * H), nz = new Float32Array(W * H), k = relieve * Math.max(W, H) * 0.5;
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const i = y * W + x, gx = (s[y * W + Math.min(W - 1, x + 1)] - s[y * W + Math.max(0, x - 1)]) * k, gy = (s[Math.min(H - 1, y + 1) * W + x] - s[Math.max(0, y - 1) * W + x]) * k, l = Math.hypot(gx, gy, 1);
    nx[i] = -gx / l; ny[i] = -gy / l; nz[i] = 1 / l;
  }
  return { nx, ny, nz };
}

export function luzRelieve(p, d, v){
  const { W, H, R, G, B, Y } = p, n = W * H, k = Math.min(100, Math.max(0, v.intensidad || 0)) / 100, N = normalesProfundidad(d, W, H, 0.4 + (v.relieve == null ? 50 : v.relieve) / 100 * 2);
  const L = lambert(N, W, H, v.azimut == null ? -40 : v.azimut, v.altura == null ? 30 : v.altura, Math.max(1, Math.sqrt(n) * 0.003));
  let m = 0; for(let i = 0; i < n; i++) m += L[i]; m /= n;
  for(let i = 0; i < n; i++){ const f = Math.min(1.8, Math.max(0.5, 1 + k * 1.2 * (L[i] - m))); R[i] = Math.min(1, R[i] * f); G[i] = Math.min(1, G[i] * f); B[i] = Math.min(1, B[i] * f); Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i]; }
}
