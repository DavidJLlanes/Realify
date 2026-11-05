/* ═══════════════════════════════════════════════════════════════
   ROPA · ZONA DE TELA ELEGIDA CON UN TOQUE (puro, sin DOM)
   Crece una región desde el punto tocado por parecido de color (cromaticidad en luz lineal) y sin saltos bruscos de luz entre vecinos: los
   pliegues oscurecen la tela poco a poco, pero el borde de la tela con el fondo es un salto de golpe. Sirve para sábanas, cortinas o manteles cuando no hay SAM; con SAM se usa su
   máscara y esta sólo es el plan B. Entradas: planos { W,H,R,G,B,Y }, punto (x,y) y tolerancia 0-100. Salida: Float32Array 0-1 suave.
   ═══════════════════════════════════════════════════════════════ */
import { gauss } from "../../portrait/shared/blur.js";

const cro = (p, i) => { const y = Math.max(p.Y[i], 1e-4); return [Math.log((p.R[i] + 1e-4) / (y + 1e-4)), Math.log((p.B[i] + 1e-4) / (y + 1e-4)), Math.log(y)]; };

export function crecerRegion(p, x, y, tol = 40){
  const { W, H } = p, n = W * H, dentro = new Uint8Array(n), pila = [], t = 0.05 + tol / 100 * 0.35, tl = 3, ts = 0.06 + tol / 100 * 0.4;
  x = Math.min(W - 1, Math.max(0, x | 0)); y = Math.min(H - 1, Math.max(0, y | 0));
  /* color de referencia: promedio de un parche 5×5 alrededor del toque */
  let s = [0, 0, 0], c = 0;
  for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++){ const xx = x + dx, yy = y + dy; if(xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = cro(p, yy * W + xx); s[0] += q[0]; s[1] += q[1]; s[2] += q[2]; c++; }
  const ref = s.map(v => v / c); let q0 = y * W + x;
  dentro[q0] = 1; pila.push(q0); let cuenta = 1;
  while(pila.length){
    const i = pila.pop(), xi = i % W, yi = (i - xi) / W;
    for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
      const xx = xi + dx, yy = yi + dy; if(xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx; if(dentro[j]) continue;
      const q = cro(p, j), qi = cro(p, i);
      if(Math.hypot(q[0] - ref[0], q[1] - ref[1]) <= t && Math.abs(q[2] - ref[2]) <= tl && Math.abs(q[2] - qi[2]) <= ts){ dentro[j] = 1; pila.push(j); cuenta++; }
    }
  }
  const m = new Float32Array(n); for(let i = 0; i < n; i++) m[i] = dentro[i];
  return cuenta < 12 ? m : cerrar(m, W, H);
}

/* rellena huecos pequeños (trama, hilos) y suaviza el borde */
function cerrar(m, W, H){
  const r = Math.max(1, Math.round(Math.min(W, H) / 300)), a = gauss(m, W, H, r * 2);
  const o = new Float32Array(m.length); for(let i = 0; i < o.length; i++) o[i] = Math.min(1, Math.max(0, (a[i] - 0.35) / 0.3));
  return gauss(o, W, H, 1);
}
