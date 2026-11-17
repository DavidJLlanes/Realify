/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · TRANSFORMAR (dibujo del recorte)
   Dibuja la foto con voltear, giro, enderezado, perspectiva y recorte en UN solo remuestreo (no una pasada por cada cosa): lo afín
   (voltear, girar, enderezar, recortar) con una matriz de lienzo y suavizado de alta calidad; la perspectiva con la malla de triángulos
   proyectivos de Realify (warpRectToQuad).
   Entradas: transformar(fuente, geo, { recortar }) con fuente = lienzo (la foto o su reducción) y geo = calcularGeo(…) en píxeles de la
   foto original (se escala solo según el tamaño de la fuente). Salidas: lienzo nuevo (el marco entero, o sólo el recorte).
   Límites: lo que cae fuera de la foto queda transparente (el recorte automático lo evita).
   ═══════════════════════════════════════════════════════════════ */
import { warpRectToQuad } from "../../../js/editor/tools/perspective.js";

export function transformar(fuente, geo, { recortar = true, anchoOriginal, perspectiva = false } = {}) {
  const k = fuente.width / anchoOriginal, o = recortar ? geo.rect : { x: 0, y: 0, w: geo.frame.w, h: geo.frame.h };
  const w = Math.max(1, Math.round(o.w * k)), h = Math.max(1, Math.round(o.h * k));
  const lienzo = Object.assign(document.createElement("canvas"), { width: w, height: h }), x = lienzo.getContext("2d");
  const q = geo.quad.map(([px, py]) => [(px - o.x) * k, (py - o.y) * k]);
  if (perspectiva) { warpRectToQuad(x, fuente, q, w, h, 28, 28); return lienzo; }
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  const [tl, tr, , bl] = q, fw = fuente.width, fh = fuente.height;
  x.setTransform((tr[0] - tl[0]) / fw, (tr[1] - tl[1]) / fw, (bl[0] - tl[0]) / fh, (bl[1] - tl[1]) / fh, tl[0], tl[1]);
  x.drawImage(fuente, 0, 0);
  return lienzo;
}
