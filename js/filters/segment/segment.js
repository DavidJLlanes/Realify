/* ═══════════════════════════════════════════════════════════════
   SEGMENTACIÓN · ORQUESTADOR
   Máscaras de persona (BodyPix) y de cielo (DeepLab v3, ADE20K) del
   tamaño ORIGINAL de la imagen (0-255, listas para el canal alfa de
   una máscara de capa).

   Antes funcionaban con TensorFlow.js en un worker propio; ahora son
   los mismos modelos convertidos a ONNX y corren en el worker de IA
   común (js/ai/worker.js: WebGPU si hay, si no WebAssembly), sin
   TF.js. Además los modelos dan una PROBABILIDAD, no un sí/no: el
   borde de la máscara sale suave en vez de dentado.
   ═══════════════════════════════════════════════════════════════ */

import { runModel } from "../../ai/runtime.js";

/* Miniatura de trabajo: la foto entera, reducida respetando su
   proporción. DeepLab trabaja como mucho a 513 px por lado. */
function workThumb(src, maxSide, snap16 = false){
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  let w = Math.max(1, Math.round(src.width * scale)), h = Math.max(1, Math.round(src.height * scale));
  // BodyPix pide lados de 16k + 1
  if(snap16){ w = Math.max(17, Math.round((w - 1) / 16) * 16 + 1); h = Math.max(17, Math.round((h - 1) / 16) * 16 + 1); }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, w, h);
  return { rgba: x.getImageData(0, 0, w, h).data, w, h };
}

/* Probabilidad pequeña (0-1) → alfa 0-255 al tamaño de `src`. Se
   endurece un poco (el borde queda nítido pero sin escalones) y se
   amplía con suavizado; un desenfoque ligero evita los dientes al
   estirar una rejilla de 129 celdas a una foto de 4000 px. */
function upscaleMask(prob, w, h, outW, outH){
  const small = document.createElement("canvas");
  small.width = w; small.height = h;
  const sx = small.getContext("2d");
  const img = sx.createImageData(w, h);
  for(let i = 0; i < prob.length; i++){
    const a = Math.min(1, Math.max(0, (prob[i] - 0.5) * 3 + 0.5));
    img.data[i*4] = img.data[i*4+1] = img.data[i*4+2] = 255;
    img.data[i*4+3] = Math.round(a * 255);
  }
  sx.putImageData(img, 0, 0);
  const out = document.createElement("canvas");
  out.width = outW; out.height = outH;
  const ox = out.getContext("2d", { willReadFrequently: true });
  ox.imageSmoothingQuality = "high";
  ox.filter = "blur(1.5px)";
  ox.drawImage(small, 0, 0, outW, outH);
  const outImg = ox.getImageData(0, 0, outW, outH);
  const mask = new Uint8ClampedArray(outW * outH);
  for(let i = 0; i < mask.length; i++) mask[i] = outImg.data[i*4+3];
  return mask;
}

/** Máscara de persona (0-255) del tamaño de `src`. Vacía —todo ceros—
    si BodyPix no encuentra a nadie. */
export async function segmentPerson(src){
  const t0 = performance.now();
  const { rgba, w, h } = workThumb(src, 513, true);
  const r = await runModel("segPerson", "person", { rgba, w, h }, [rgba.buffer], { title: "Buscando a la persona con IA" });
  return { mask: upscaleMask(r.prob, r.w, r.h, src.width, src.height), ms: Math.round(performance.now() - t0) };
}

/** Máscara de cielo (0-255) del tamaño de `src`. `hasSky` distingue
    «no hay cielo en la foto» de «hubo un fallo». `prob` (0-1, en la
    rejilla del modelo, `pw`×`ph`) sirve para afinar el borde. */
export async function segmentSky(src){
  const t0 = performance.now();
  const { rgba, w, h } = workThumb(src, 513);
  const r = await runModel("segSky", "sky", { rgba, w, h }, [rgba.buffer], { title: "Detectando el cielo con IA" });
  return { mask: upscaleMask(r.prob, r.w, r.h, src.width, src.height), hasSky: r.hasSky, prob: r.prob, pw: r.w, ph: r.h,
           ms: Math.round(performance.now() - t0) };
}
