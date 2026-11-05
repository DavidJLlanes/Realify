/* ═══════════════════════════════════════════════════════════════
   RELIGHT · NORMALES (puro, sin DOM)
   Normales de la superficie de la cara a partir del mapa de profundidad (Depth Anything V2 Small, 0-1, 1 = cerca) suavizado, mezcladas con
   las de un elipsoide ajustado al óvalo de la cara: el mapa de profundidad da la forma real (nariz, pómulos) y el elipsoide evita que
   el ruido del modelo estropee la luz. Entradas: profundidad (Float32 o null), máscara del óvalo, ancho, alto, ancho de cara en píxeles.
   Salida: { nx, ny, nz } Float32Array unitarios. Sin profundidad sale sólo el elipsoide.
   ═══════════════════════════════════════════════════════════════ */
import { gauss } from "../portrait/shared/blur.js";

export function normalesCara(prof, ovalo, W, H, F, mezcla = 0.55){
  const n = W * H, nx = new Float32Array(n), ny = new Float32Array(n), nz = new Float32Array(n).fill(1);
  let sx = 0, sy = 0, sw = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) if(ovalo[y * W + x] > 0.5){ sx += x; sy += y; sw++; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  if(!sw) return { nx, ny, nz };
  const cx = sx / sw, cy = sy / sw, rx = Math.max(4, (x1 - x0) / 2) * 1.15, ry = Math.max(4, (y1 - y0) / 2) * 1.15;
  const d = prof ? gauss(prof, W, H, Math.max(1, F * 0.02)) : null, zs = F * 0.45;
  for(let y = 1; y < H - 1; y++) for(let x = 1; x < W - 1; x++){
    const i = y * W + x, u = (x - cx) / rx, v = (y - cy) / ry, q = Math.max(0.02, 1 - u * u - v * v), s = Math.sqrt(q);
    let ex = u / s * 0.8, ey = v / s * 0.8, ez = 1;                              // elipsoide: z = √(1 − u² − v²)
    if(d){ const gx = (d[i + 1] - d[i - 1]) / 2 * zs, gy = (d[i + W] - d[i - W]) / 2 * zs; ex = ex * (1 - mezcla) + -gx * mezcla; ey = ey * (1 - mezcla) + -gy * mezcla; }
    const L = Math.hypot(ex, ey, ez); nx[i] = ex / L; ny[i] = ey / L; nz[i] = ez / L;
  }
  return { nx, ny, nz };
}
