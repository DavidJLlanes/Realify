/* ═══════════════════════════════════════════════════════════════
   RETRATO · TRAZADO DE MÁSCARAS SUAVES (puro, sin DOM)
   Rellena polígonos y dibuja trazos con borde suave sobre matrices Float32Array (0-1), sin lienzo: así el motor corre igual en
   un worker o en Node. Polígono: regla par-impar por líneas de barrido a 1 muestra por píxel y borde suavizado con gauss().
   Entradas: w, h y puntos [[x,y]…] en píxeles de la matriz. Salida: Float32Array(w·h).
   ═══════════════════════════════════════════════════════════════ */
import { gauss } from "./blur.js";

export function fillPolygon(w, h, pts, soft = 0){
  const out = new Float32Array(w * h);
  if(pts.length < 3) return out;
  let y0 = Infinity, y1 = -Infinity;
  for(const p of pts){ if(p[1] < y0) y0 = p[1]; if(p[1] > y1) y1 = p[1]; }
  y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(h - 1, Math.ceil(y1));
  for(let y = y0; y <= y1; y++){
    const yy = y + 0.5, xs = [];
    for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){
      const a = pts[j], b = pts[i];
      if((a[1] <= yy) !== (b[1] <= yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for(let k = 0; k + 1 < xs.length; k += 2){
      const xa = Math.max(0, Math.round(xs[k])), xb = Math.min(w, Math.round(xs[k + 1]));
      for(let x = xa; x < xb; x++) out[y * w + x] = 1;
    }
  }
  return soft > 0.5 ? gauss(out, w, h, soft) : out;
}

/** Trazo de grosor `ancho` (px) a lo largo de una polilínea, con caída gaussiana del centro al borde. */
export function strokePath(w, h, pts, ancho, soft = 0){
  const out = new Float32Array(w * h), r = ancho / 2, pad = Math.ceil(r + soft * 2) + 1;
  for(let s = 0; s + 1 < pts.length; s++){
    const [ax, ay] = pts[s], [bx, by] = pts[s + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const xa = Math.max(0, Math.floor(Math.min(ax, bx) - pad)), xb = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + pad));
    const ya = Math.max(0, Math.floor(Math.min(ay, by) - pad)), yb = Math.min(h - 1, Math.ceil(Math.max(ay, by) + pad));
    for(let y = ya; y <= yb; y++) for(let x = xa; x <= xb; x++){
      const t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / L2));
      const d = Math.hypot(x + 0.5 - (ax + t * dx), y + 0.5 - (ay + t * dy));
      const v = d <= r ? 1 : Math.exp(-((d - r) * (d - r)) / (2 * Math.max(0.5, soft) ** 2));
      if(v > out[y * w + x]) out[y * w + x] = v;
    }
  }
  return out;
}

/** a·(1 − b) en cada punto: quita de `a` la parte cubierta por `b`. */
export function subtract(a, b){ const o = new Float32Array(a.length); for(let i = 0; i < a.length; i++) o[i] = a[i] * (1 - b[i]); return o; }
export function union(list){ const o = new Float32Array(list[0].length); for(const m of list) for(let i = 0; i < o.length; i++) if(m[i] > o[i]) o[i] = m[i]; return o; }
export function multiply(a, b){ const o = new Float32Array(a.length); for(let i = 0; i < a.length; i++) o[i] = a[i] * b[i]; return o; }
