/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · COSIDO EN EL DISPOSITIVO
   Coordina el cosido sin servidor en dos pasos:
     analyzePhotos (lento, una vez)
       1. Descarga OpenCV.js si hace falta (js/cv/opencv.js, ~11 MB).
       2. rotation.js › solveCamera: focal, lente, orden y giro de cada
          foto con copias pequeñas, con los puntos de control manuales.
     renderPanorama (rápido, se repite al cambiar opciones)
       3. projections.js: horizonte (nivelar, rumbo, inclinación, giro).
       4. rotation.js › warpPanorama: cada foto, a la resolución final, a
          la proyección elegida con un solo remuestreo.
       5. masks.js: zonas excluidas y «mantener».
       6. worker.js: igualar exposición, mezclar (costura por donde menos
          difieren las fotos + pirámides de Laplace) y recortar fuera del
          hilo de la interfaz; recorte manual al final.
   `stitchLocal` hace los dos pasos seguidos. Los fallos se lanzan como
   `StitchError` con un `code` para que la ventana decida qué ofrecer
   (p. ej. probar con el servidor).
   ═══════════════════════════════════════════════════════════════ */

import { loadOpenCv } from "../../js/cv/opencv.js";
import { solveCamera, warpPanorama, MAX_AUTO_ORDER } from "./rotation.js";
import { rotateWorld, levelRotation, worldRotation, PROJECTION_IDS } from "./projections.js";
import { hasInk, excludedCopy, grayedCopy, keepCanvas, applyKeep } from "./masks.js";

const TOUCH = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
/** Altura (px) de las copias con que se busca el giro de las fotos. */
const MATCH_HEIGHT = 1100;
/** Altura final de cada foto: normal / Premium 👑 (el resultado se limita además por `MAX_AREA`). */
const BASIC_HEIGHT = TOUCH ? 1600 : 2200, PREMIUM_HEIGHT = TOUCH ? 2600 : 4200;
/** Área máxima del mosaico: Safari no dibuja lienzos de más de ~16,7 MP, y la mezcla gasta 16 bytes por píxel. */
const MAX_AREA = TOUCH ? 16e6 : 30e6;
/** Área máxima del mosaico para la mezcla multibanda (costuras inteligentes y pirámides: ~21 bytes por píxel más las fotos); con más, se mezcla por distancia al borde. */
const MULTIBAND_MAX_AREA = TOUCH ? 6e6 : 12e6;
/** Premium 👑: más puntos de unión, ajuste con más coincidencias, copias de análisis más grandes y mezcla multibanda con más niveles y para mosaicos mayores. */
const PREMIUM = { matchHeight: 1600, features: 9000, baPoints: 1200, levels: 6, multibandArea: TOUCH ? 9e6 : 24e6 };
/** Con un campo vertical mayor que éste (grados) se proyecta en esfera: en cilindro se estirarían mucho los bordes. */
const SPHERE_FROM_VFOV = 90;
/** Vista previa: altura de cada foto y área máxima del mosaico (rápida: unos segundos incluso en móvil). */
const PREVIEW_HEIGHT = TOUCH ? 420 : 560, PREVIEW_MAX_AREA = TOUCH ? 3e6 : 6e6;

/** Hasta cuántas fotos se ordenan solas (con más se respeta el orden dado y la interfaz avisa). */
export const AUTO_ORDER_LIMIT = MAX_AUTO_ORDER;

/** Valores admitidos de las opciones avanzadas (el valor por defecto es lo de siempre). */
const PROJECTIONS = PROJECTION_IDS, BLENDS = ["multiband", "seam", "feather"];

/** code: "few" · "no-opencv" · "no-overlap" · "too-big" · "failed" */
export class StitchError extends Error {
  constructor(message, code){ super(message); this.name = "StitchError"; this.code = code; }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/** Copias de los lienzos a la misma altura. */
function toHeight(canvases, height){
  return canvases.map(c => {
    if(c.height === height) return c;
    const k = height / c.height, out = document.createElement("canvas");
    out.width = Math.max(8, Math.round(c.width * k)); out.height = height;
    const x = out.getContext("2d", { willReadFrequently: true });
    x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, out.width, out.height);
    return out;
  });
}

function blendInWorker(images, options){
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    const done = fn => value => { worker.terminate(); fn(value); };
    worker.onmessage = e => {
      if(e.data.type === "error") return done(reject)(new StitchError(e.data.message, "failed"));
      const { w, h, data } = e.data, canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
      done(resolve)(canvas);
    };
    worker.onerror = e => done(reject)(new StitchError(e.message || "Falló la mezcla de las fotos", "failed"));
    worker.postMessage({ type: "compose", req: 1, images, options }, images.map(im => im.data.buffer));
  });
}

/** Abre OpenCV. Devuelve `{ cv }`: `cv` es «thenable» y devolverlo suelto desde una promesa no termina nunca (ver js/cv/opencv.js). */
async function openCv(onProgress){
  onProgress("Preparando OpenCV…");
  let lib = null;
  try{ lib = await loadOpenCv(); }
  catch(err){ throw new StitchError(err.message || "No se pudo cargar OpenCV", "no-opencv"); }
  if(!lib) throw new StitchError("Para unir las fotos en tu dispositivo hace falta descargar OpenCV", "no-opencv");
  return { cv: lib.cv };
}

/** Envuelve un fallo cualquiera en un StitchError. */
const asStitchError = err => err instanceof StitchError ? err : new StitchError(err?.message || "No se pudo crear la panorámica", "failed");

/**
 * Paso lento (se hace una vez): busca dónde está cada foto y con qué lente se hizo.
 * @param photos           lienzos (cualquier orden)
 * @param opts.premium     motor Premium 👑 (más puntos de unión y ajuste más fino)
 * @param opts.lens        corregir la distorsión de la lente
 * @param opts.autoOrder   ordenar las fotos solas (hasta MAX_AUTO_ORDER; con más se respeta el orden dado)
 * @param opts.manual      puntos de control puestos a mano [{ a, b, pts: [xa, ya, xb, yb, …] }] (coordenadas 0–1 de cada foto)
 * @param opts.exclude     máscaras «excluir» por foto (lienzo o null): no se buscan puntos de unión ahí
 * @returns { cam, matchH, minHeight, count } que se pasa a renderPanorama
 */
export async function analyzePhotos(photos, { premium = false, lens = true, autoOrder = true, manual = [], exclude = [], onProgress = () => {} } = {}){
  if(!photos || photos.length < 2) throw new StitchError("Añade al menos dos fotos para crear una panorámica", "few");
  const { cv } = await openCv(onProgress);
  try{
    const minHeight = Math.min(...photos.map(c => c.height)), matchH = Math.min(premium ? PREMIUM.matchHeight : MATCH_HEIGHT, minHeight);
    const small = toHeight(photos.map((c, i) => hasInk(exclude[i]) ? grayedCopy(c, exclude[i]) : c), matchH);
    const cam = await solveCamera(cv, small, { lens, autoOrder, manual, onProgress, ...(premium ? { features: PREMIUM.features, baPoints: PREMIUM.baPoints } : {}) });
    if(cam.found.filter(Boolean).length < 2) throw new StitchError("No se encontró solape suficiente entre las fotos. Comprueba que se solapan al menos un tercio.", "no-overlap");
    return { cam, matchH, minHeight, count: photos.length };
  }catch(err){ throw asStitchError(err); }
}

/**
 * Paso rápido (se repite al cambiar las opciones): coloca las fotos en la proyección elegida y las mezcla.
 * @param photos            los mismos lienzos (o copias más pequeñas de la misma forma, para la vista previa)
 * @param analysis          lo que devolvió analyzePhotos
 * @param opts.premium      resolución final alta + Lanczos + mezcla de 6 niveles
 * @param opts.projection   "auto" (cilindro o esfera según el campo) · "cyl" · "sph" · "merc" · "rect" · "stereo" · "fish"
 * @param opts.horizon      { level, yaw, pitch, roll }: nivelar solo y girar el mundo (grados)
 * @param opts.blend        "multiband" · "seam" (costura sin pirámides) · "feather" (degradado)
 * @param opts.exposure     igualar la exposición entre fotos
 * @param opts.autoCrop     recortar al mayor rectángulo sin huecos
 * @param opts.crop         recorte manual { l, t, r, b } (fracciones 0–0,45 de cada lado), tras el automático
 * @param opts.exclude      máscaras «excluir» por foto · opts.keep: máscaras «mantener» por foto (lienzo o null)
 * @param opts.preview      vista previa: tamaño pequeño y sin pasos caros
 */
export async function renderPanorama(photos, analysis, { premium = false, projection: wanted = "auto", horizon = {}, blend = "multiband", exposure = true, autoCrop = true, crop = {}, exclude = [], keep = [], preview = false, onProgress = () => {} } = {}){
  const { cv } = await openCv(onProgress), { cam, matchH, minHeight } = analysis;
  try{
    const vFov = 2 * Math.atan(matchH / (2 * cam.f)) * 180 / Math.PI;
    const projection = wanted !== "auto" && PROJECTIONS.includes(wanted) ? wanted : vFov > SPHERE_FROM_VFOV ? "sph" : "cyl";
    let R = cam.R;
    if(horizon.level) R = rotateWorld(R, levelRotation(R));
    if(horizon.yaw || horizon.pitch || horizon.roll) R = rotateWorld(R, worldRotation(horizon.yaw || 0, horizon.pitch || 0, horizon.roll || 0));
    const shortest = Math.min(...photos.map(c => c.height));
    // Si el mosaico no cabe, se repite más pequeño en vez de fallar
    let height = preview ? Math.min(PREVIEW_HEIGHT, shortest) : Math.min(premium ? PREMIUM_HEIGHT : BASIC_HEIGHT, shortest, minHeight), warped = null, full = null;
    const maxArea = preview ? PREVIEW_MAX_AREA : MAX_AREA, interp = premium && !preview ? "lanczos" : "linear";
    for(let attempt = 0; attempt < 5; attempt++){
      onProgress("Colocando las fotos…");
      await tick();
      full = toHeight(photos, height);
      const solid = full.map((c, i) => hasInk(exclude[i]) ? excludedCopy(c, exclude[i]) : c);
      const camera = { R, f: cam.f * height / matchH, k: cam.k };
      warped = await warpPanorama(cv, solid, camera, { projection, interp, maxArea, onStep: (i, n) => onProgress(`Colocando las fotos (${Math.min(i + 1, n)} de ${n})…`) });
      if(!warped.tooBig) break;
      height = Math.round(height * 0.75);
    }
    if(warped.error) throw new StitchError(warped.error, warped.tooBig ? "too-big" : "failed");

    // «Mantener»: esa zona sale sólo de su foto
    const keeps = [];
    for(let i = 0; i < full.length; i++){
      if(!hasInk(keep[i]) || !R[i]) continue;
      const only = new Map([[i, keepCanvas(full[i].width, full[i].height, keep[i])]]);
      const w = await warpPanorama(cv, full, { R, f: cam.f * height / matchH, k: cam.k }, { projection, maxArea, only });
      if(w.images?.[0]) keeps.push({ i, image: w.images[0] });
    }
    if(keeps.length) applyKeep(warped.images, keeps);

    onProgress("Igualando exposición y mezclando…");
    await tick();
    const area = preview ? PREVIEW_MAX_AREA : premium ? PREMIUM.multibandArea : MULTIBAND_MAX_AREA;
    const out = await blendInWorker(warped.images, { fusion: BLENDS.includes(blend) ? blend : "multiband", maxArea: area, levels: premium && !preview ? PREMIUM.levels : 5, crop: autoCrop, useGain: exposure });
    return cropFractions(out, crop);
  }catch(err){ throw asStitchError(err); }
}

/** Recorte manual: quita una fracción de cada lado. */
function cropFractions(canvas, { l = 0, t = 0, r = 0, b = 0 } = {}){
  const L = Math.round(canvas.width * Math.min(l, 0.45)), T = Math.round(canvas.height * Math.min(t, 0.45));
  const w = canvas.width - L - Math.round(canvas.width * Math.min(r, 0.45)), h = canvas.height - T - Math.round(canvas.height * Math.min(b, 0.45));
  if(!(L || T) && w === canvas.width && h === canvas.height) return canvas;
  const out = document.createElement("canvas"); out.width = Math.max(8, w); out.height = Math.max(8, h);
  out.getContext("2d").drawImage(canvas, L, T, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** Todo de una vez (análisis + mosaico): lo que usan las pruebas y el modo sin vista previa. Mismas opciones que analyzePhotos y renderPanorama. */
export async function stitchLocal(photos, opts = {}){
  const analysis = await analyzePhotos(photos, opts);
  return renderPanorama(photos, analysis, opts);
}
