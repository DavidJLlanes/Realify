/* ═══════════════════════════════════════════════════════════════
   ESCENA · COPIA DE TRABAJO EN LUZ LINEAL
   Baja la foto visible a la escala de trabajo (WORK() o la que se pida), la pasa a planos Float32 en luz lineal y, al terminar, devuelve
   un lienzo del tamaño de la foto con el resultado (con tramado para no crear bandas). Entradas: lienzo de la foto y lado máximo. Salidas:
   trabajar() = { k, W, H, rgba, planes }, aLienzo(prep, src) = lienzo del tamaño de `src`.
   ═══════════════════════════════════════════════════════════════ */
import { toPlanes, fromPlanes } from "../../portrait/shared/planes.js";

export function trabajar(src, maxSide){
  const k = Math.min(1, maxSide / Math.max(src.width, src.height)), W = Math.max(1, Math.round(src.width * k)), H = Math.max(1, Math.round(src.height * k));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, W, H);
  const rgba = x.getImageData(0, 0, W, H).data;
  return { k, W, H, rgba, planes: toPlanes(rgba, W, H) };
}

export function aLienzo(prep, src){
  const { W, H, planes } = prep, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"), d = x.createImageData(W, H); fromPlanes(planes, d.data);
  for(let i = 3; i < d.data.length; i += 4) d.data[i] = 255;
  x.putImageData(d, 0, 0);
  if(W === src.width && H === src.height) return c;
  const o = document.createElement("canvas"); o.width = src.width; o.height = src.height;
  const ox = o.getContext("2d"); ox.imageSmoothingQuality = "high"; ox.drawImage(c, 0, 0, o.width, o.height); return o;
}
