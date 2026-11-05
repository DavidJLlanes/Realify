/* ═══════════════════════════════════════════════════════════════
   RETRATO · GEOMETRÍA DE LA CARA (puro)
   Escala y orientación de una cara a partir de su malla de puntos, y el recorte (caja con margen) sobre el que trabajan los motores
   de piel. Entradas: puntos [[x,y]…] de la foto. Salidas: frame() = { F, up, c, P }, cropFor() = { x, y, w, h, k }.
   ═══════════════════════════════════════════════════════════════ */
import { IDX } from "./landmarks.js";

/** F = ancho de la cara (pómulo a pómulo); up = vector unitario hacia la frente (sigue la inclinación de la cabeza). */
export function frame(pts){
  const a = pts[234], b = pts[454], top = pts[IDX.nariz.frente], chin = pts[IDX.boca.mentón];
  const F = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let ux = top[0] - chin[0], uy = top[1] - chin[1]; const L = Math.hypot(ux, uy) || 1;
  return { F, up: [ux / L, uy / L], c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], P: pts };
}

/** Recorte alrededor de la cara con margen para cuello, pelo y fondo cercano; `maxSide` limita el lado largo de trabajo (escala k ≤ 1 → píxeles de trabajo / píxeles de la foto). */
export function cropFor(pts, imgW, imgH, maxSide = 1600){
  const { F, c } = frame(pts);
  const x0 = Math.max(0, Math.floor(c[0] - F * 1.5)), x1 = Math.min(imgW, Math.ceil(c[0] + F * 1.5));      // margen para el pelo y los pelos sueltos
  const y0 = Math.max(0, Math.floor(c[1] - F * 1.7)), y1 = Math.min(imgH, Math.ceil(c[1] + F * 1.6));
  const w = x1 - x0, h = y1 - y0, k = Math.min(1, maxSide / Math.max(w, h));
  return { x: x0, y: y0, w, h, k, W: Math.max(1, Math.round(w * k)), H: Math.max(1, Math.round(h * k)) };
}

/** Punto de la foto → píxel del recorte de trabajo. */
export const toCrop = (p, crop) => [(p[0] - crop.x) * crop.k, (p[1] - crop.y) * crop.k];
