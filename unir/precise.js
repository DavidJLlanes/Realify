/* ═══════════════════════════════════════════════════════════════
   UNIR · PANORÁMICA PRECISA (OpenCV, fase 7 de PENDIENTE.md)
   Alternativa a la proyección cilíndrica + posición entera: cada pareja
   de fotos contiguas se une con una HOMOGRAFÍA calculada con puntos
   ORB + RANSAC (js/cv/align.js › pairHomography), que cubre giro,
   escala y perspectiva con precisión subpíxel; las homografías se
   encadenan hasta la primera foto y cada foto se resamplea UNA vez a
   su sitio en el mosaico (Lanczos). Después, el motor de siempre
   iguala la exposición y mezcla (unir/engine.js › placed, compose).
   Para panorámicas de campo moderado (tomadas girando sin pasarse de
   unos 90°) y escaneos: con un campo muy ancho la homografía estira
   los extremos, y ahí sigue siendo mejor la cilíndrica.
   Corre en el hilo principal (OpenCV vive en `window`).
   ═══════════════════════════════════════════════════════════════ */

import { pairHomography, mmul, minv, apply } from "../js/cv/align.js";

const sameHeight = (canvases, side) => {
  const h = Math.min(side, ...canvases.map(c => c.height));
  return canvases.map(c => {
    if(c.height === h) return c;
    const k = h / c.height, o = document.createElement("canvas");
    o.width = Math.max(8, Math.round(c.width * k)); o.height = h;
    const x = o.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, o.width, o.height);
    return o;
  });
};

/** Homografías de cada foto a la primera (null en una si no se encontró su solape). `canvases` ya al mismo alto. */
export function chainHomographies(cv, canvases, onStep = null){
  const Hs = [[1, 0, 0, 0, 1, 0, 0, 0, 1]], found = [true], info = [{ inliers: Infinity }];
  for(let i = 1; i < canvases.length; i++){
    onStep?.(i, canvases.length);
    const pr = pairHomography(cv, canvases[i - 1], canvases[i]);
    if(!pr){ found.push(false); Hs.push(null); info.push({ inliers: 0 }); continue; }
    const prev = Hs[i - 1];
    if(!prev){ found.push(false); Hs.push(null); info.push({ inliers: 0 }); continue; }
    Hs.push(mmul(prev, pr.H)); found.push(true); info.push({ inliers: pr.inliers });
  }
  return { Hs, found, info };
}

/**
 * Lleva cada foto a su sitio en el mosaico. Devuelve { images:[{ w, h, data (RGBA, alfa 0 fuera de la foto), x, y }], found } con las posiciones
 * en píxeles del mosaico, o { error } si el mosaico sale desproporcionado (homografías erróneas).
 */
export async function placeMosaic(cv, canvases, { side = 1200, maxArea = 16e6, interp = "linear", onStep = null } = {}){
  const set = sameHeight(canvases, side), { Hs, found, info } = chainHomographies(cv, set, onStep);
  const idx = set.map((_, i) => i).filter(i => Hs[i]);
  if(idx.length < 2) return { error: "No se encontró el solape entre las fotos: revisa el orden o que se solapen" };
  // Cajas de cada foto transformada
  const boxes = new Map(); let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for(const i of idx){
    const c = set[i], pts = [[0, 0], [c.width, 0], [0, c.height], [c.width, c.height]].map(([x, y]) => apply(Hs[i], x, y));
    if(pts.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return { error: "Las fotos no encajan con una homografía (¿campo demasiado ancho?): prueba con la proyección cilíndrica" };
    const x0 = Math.floor(Math.min(...pts.map(p => p[0]))), x1 = Math.ceil(Math.max(...pts.map(p => p[0]))), y0 = Math.floor(Math.min(...pts.map(p => p[1]))), y1 = Math.ceil(Math.max(...pts.map(p => p[1])));
    boxes.set(i, { x0, y0, x1, y1 }); minX = Math.min(minX, x0); minY = Math.min(minY, y0); maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1);
  }
  const W = maxX - minX, H = maxY - minY, base = set[0].width * set[0].height;
  if(W * H > Math.max(maxArea, 1) * 1 || W * H > base * idx.length * 6) return { error: "El mosaico sale desproporcionado (¿campo demasiado ancho?): prueba con la proyección cilíndrica" };
  const images = [];
  for(const i of idx){
    const b = boxes.get(i), bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const src = set[i].getContext("2d", { willReadFrequently: true }).getImageData(0, 0, set[i].width, set[i].height);
    const srcM = cv.matFromImageData(src), dst = new cv.Mat();
    // H de la foto a la caja: traslación por (−x0, −y0)
    const M = cv.matFromArray(3, 3, cv.CV_32F, mmul([1, 0, -b.x0, 0, 1, -b.y0, 0, 0, 1], Hs[i]));
    try{
      cv.warpPerspective(srcM, dst, M, new cv.Size(bw, bh), interp === "lanczos" ? cv.INTER_LANCZOS4 : cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
      images.push({ w: bw, h: bh, data: new Uint8ClampedArray(dst.data), x: b.x0 - minX, y: b.y0 - minY, i });
    } finally { srcM.delete(); dst.delete(); M.delete(); }
    await new Promise(r => setTimeout(r, 0));
  }
  return { images, found, W, H };
}
