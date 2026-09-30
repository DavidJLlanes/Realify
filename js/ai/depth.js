/* ═══════════════════════════════════════════════════════════════
   IA · PROFUNDIDAD (Premium 👑)
   Depth Anything V2 Small calcula, a 518×518, lo cerca o lejos que
   está cada punto de la foto (1 = lo más cercano, 0 = lo más lejano).

   Procesado Premium («el bueno y el mejor»):
     · Bueno: el mapa se amplía a la resolución de trabajo con
       interpolación bilineal (sin escalones).
     · Mejor: se ajusta a los bordes REALES de la foto con un filtro
       guiado por la propia imagen: el contorno de una persona en el
       mapa coincide con el de la foto, que es lo que evita halos al
       desenfocar el fondo o poner niebla detrás de alguien.
   ═══════════════════════════════════════════════════════════════ */

import { runModel } from "./runtime.js";
import { guidedFilterAlpha } from "../editor/refineedge-math.js";

let cache = null;   // { src, map } — la última foto analizada

/** Mapa de profundidad 518×518 de `source` (un lienzo). */
export async function depthMap(source){
  if(cache && cache.src === source) return cache.map;
  const S = 518, c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high";
  x.drawImage(source, 0, 0, S, S);
  const r = await runModel("depth", "depth", { rgba: x.getImageData(0, 0, S, S).data }, [], { title: "Calculando la profundidad con IA" });
  const map = { d: r.depth, n: r.size };
  cache = { src: source, map };
  return map;
}

/** Profundidad a w×h (Float32, 0-1), ajustada a los bordes de `rgba`
    (los píxeles de la foto a ese mismo tamaño). */
export function depthAt(map, w, h, rgba){
  const { d, n } = map, out = new Float32Array(w * h);
  for(let y = 0; y < h; y++){
    const fy = Math.min(n - 1, Math.max(0, (y + 0.5) * n / h - 0.5)), y0 = fy | 0, y1 = Math.min(n - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < w; x++){
      const fx = Math.min(n - 1, Math.max(0, (x + 0.5) * n / w - 0.5)), x0 = fx | 0, x1 = Math.min(n - 1, x0 + 1), tx = fx - x0;
      const a = d[y0 * n + x0] + (d[y0 * n + x1] - d[y0 * n + x0]) * tx, b = d[y1 * n + x0] + (d[y1 * n + x1] - d[y1 * n + x0]) * tx;
      out[y * w + x] = a + (b - a) * ty;
    }
  }
  if(!rgba) return out;
  const I = new Float32Array(w * h);
  for(let i = 0, j = 0; i < w * h; i++, j += 4) I[i] = (rgba[j] * 0.2126 + rgba[j + 1] * 0.7152 + rgba[j + 2] * 0.0722) / 255;
  const r = Math.max(2, Math.round(Math.max(w, h) / 300));
  const g = guidedFilterAlpha(I, out, w, h, r, 0.0008);
  for(let i = 0; i < g.length; i++) g[i] = Math.min(1, Math.max(0, g[i]));
  return g;
}
