/* ═══════════════════════════════════════════════════════════════
   RETRATO · MÁSCARAS DE LAS PARTES EN EL RECORTE (puro, sin DOM)
   Pasa una máscara del modelo de partes (pelo, gafas, persona…; baja resolución, a la caja de la persona) al recorte de trabajo:
   interpolación bilineal y, si se pide, refinado de borde con un filtro guiado por la luminancia del recorte (así el pelo sigue los
   mechones y no el contorno de 128 px del modelo). Entradas: persona.partes, nombre, recorte y luminancia (Float32). Salida: Float32Array 0-1.
   ═══════════════════════════════════════════════════════════════ */
import { guidedFilterAlpha } from "../../../editor/selection/refineedge-math.js";

function muestra(m, w, h, caja, X, Y){
  const fx = Math.min(w - 1.001, Math.max(0, (X - caja.x) / caja.w * w - 0.5)), fy = Math.min(h - 1.001, Math.max(0, (Y - caja.y) / caja.h * h - 0.5));
  const a = fy | 0, b = fx | 0, tx = fx - b, ty = fy - a;
  return ((m[a * w + b] * (1 - tx) + m[a * w + b + 1] * tx) * (1 - ty) + (m[(a + 1) * w + b] * (1 - tx) + m[(a + 1) * w + b + 1] * tx) * ty) / 255;
}

/** Máscara de `nombre` en el recorte, o null si el modelo no la dio. `refinar`: { Y, radio } para ajustarla a los bordes reales. */
export function mascaraParte(partes, nombre, crop, refinar = null){
  const m = partes && partes.mascaras[nombre];
  if(!m) return null;
  const { W, H } = crop, out = new Float32Array(W * H);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++)
    out[y * W + x] = muestra(m, partes.w, partes.h, partes.caja, crop.x + (x + 0.5) / crop.k, crop.y + (y + 0.5) / crop.k);
  if(!refinar) return out;
  const g = new Float32Array(W * H); for(let i = 0; i < g.length; i++) g[i] = Math.sqrt(Math.max(0, refinar.Y[i]));
  return guidedFilterAlpha(g, out, W, H, Math.max(2, refinar.radio | 0), 0.002);
}

/** Caja (en píxeles de la foto) que ocupa la parte `nombre` según el modelo, o null. Sirve para que el recorte de trabajo no corte el pelo. */
export function cajaParte(partes, nombre, umbral = 100){
  const m = partes && partes.mascaras[nombre]; if(!m) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for(let y = 0; y < partes.h; y++) for(let x = 0; x < partes.w; x++) if(m[y * partes.w + x] > umbral){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  if(x1 < 0) return null;
  const c = partes.caja, sx = c.w / partes.w, sy = c.h / partes.h;
  return { x0: c.x + x0 * sx, y0: c.y + y0 * sy, x1: c.x + (x1 + 1) * sx, y1: c.y + (y1 + 1) * sy };
}
