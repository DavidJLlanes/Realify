/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · COSIDO EN EL DISPOSITIVO
   Coordina el cosido sin servidor:
     1. Descarga OpenCV.js si hace falta (js/cv/opencv.js, ~11 MB, una vez).
     2. rotation.js › solveCamera: focal, orden y giro de cada foto, con
        copias pequeñas (rápido).
     3. rotation.js › warpPanorama: cada foto, a la resolución final, al
        cilindro o a la esfera con un solo remuestreo.
     4. worker.js: igualar exposición, mezclar (costura por donde menos
        difieren las fotos + pirámides de Laplace) y recortar fuera del
        hilo de la interfaz.
   Los fallos se lanzan como `StitchError` con un `code` para que la
   ventana decida qué ofrecer (p. ej. probar con el servidor).
   ═══════════════════════════════════════════════════════════════ */

import { loadOpenCv } from "../../js/cv/opencv.js";
import { solveCamera, warpPanorama } from "./rotation.js";

const TOUCH = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
/** Altura (px) de las copias con que se busca el giro de las fotos. */
const MATCH_HEIGHT = 1100;
/** Altura final de cada foto: normal / Premium 👑 (el resultado se limita además por `MAX_AREA`). */
const BASIC_HEIGHT = TOUCH ? 1600 : 2200, PREMIUM_HEIGHT = TOUCH ? 2600 : 4200;
/** Área máxima del mosaico: Safari no dibuja lienzos de más de ~16,7 MP, y la mezcla gasta 16 bytes por píxel. */
const MAX_AREA = TOUCH ? 16e6 : 30e6;
/** Área máxima del mosaico para la mezcla multibanda (costuras inteligentes y pirámides: ~21 bytes por píxel más las fotos); con más, se mezcla por distancia al borde. */
const MULTIBAND_MAX_AREA = TOUCH ? 6e6 : 12e6;
/** Con un campo vertical mayor que éste (grados) se proyecta en esfera: en cilindro se estirarían mucho los bordes. */
const SPHERE_FROM_VFOV = 90;

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

/**
 * Une las fotos (lienzos, en cualquier orden) en una panorámica y devuelve el lienzo.
 * @param opts.premium    más resolución y remuestreo Lanczos
 * @param opts.autoCrop   recortar al mayor rectángulo sin huecos
 * @param opts.onProgress texto de lo que se está haciendo
 */
export async function stitchLocal(photos, { premium = false, autoCrop = true, onProgress = () => {} } = {}){
  if(!photos || photos.length < 2) throw new StitchError("Añade al menos dos fotos para crear una panorámica", "few");
  onProgress("Preparando OpenCV…");
  let lib = null;
  try{ lib = await loadOpenCv(); }
  catch(err){ throw new StitchError(err.message || "No se pudo cargar OpenCV", "no-opencv"); }
  if(!lib) throw new StitchError("Para unir las fotos en tu dispositivo hace falta descargar OpenCV", "no-opencv");
  const { cv } = lib;

  try{
    const minHeight = Math.min(...photos.map(c => c.height)), matchH = Math.min(MATCH_HEIGHT, minHeight);
    const small = toHeight(photos, matchH);
    const cam = await solveCamera(cv, small, { onProgress });
    if(cam.found.filter(Boolean).length < 2) throw new StitchError("No se encontró solape suficiente entre las fotos. Comprueba que se solapan al menos un tercio.", "no-overlap");

    const vFov = 2 * Math.atan(matchH / (2 * cam.f)) * 180 / Math.PI;
    const projection = vFov > SPHERE_FROM_VFOV ? "sph" : "cyl";
    // Si el mosaico no cabe, se repite más pequeño en vez de fallar
    let height = Math.min(premium ? PREMIUM_HEIGHT : BASIC_HEIGHT, minHeight), warped = null;
    for(let attempt = 0; attempt < 5; attempt++){
      onProgress("Colocando las fotos…");
      await tick();
      const full = toHeight(photos, height);
      warped = await warpPanorama(cv, full, { R: cam.R, f: cam.f * height / matchH, k: cam.k }, {
        projection, interp: premium ? "lanczos" : "linear", maxArea: MAX_AREA,
        onStep: (i, n) => onProgress(`Colocando las fotos (${Math.min(i + 1, n)} de ${n})…`)
      });
      if(!warped.tooBig) break;
      height = Math.round(height * 0.75);
    }
    if(warped.error) throw new StitchError(warped.error, warped.tooBig ? "too-big" : "failed");

    onProgress("Igualando exposición y mezclando…");
    await tick();
    return await blendInWorker(warped.images, { fusion: "multiband", maxArea: MULTIBAND_MAX_AREA, crop: autoCrop, useGain: true });
  }catch(err){
    if(err instanceof StitchError) throw err;
    throw new StitchError(err?.message || "No se pudo crear la panorámica", "failed");
  }
}
