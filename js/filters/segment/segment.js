/* ═══════════════════════════════════════════════════════════════
   SEGMENTACIÓN · ORQUESTADOR
   Igual papel que filters/lens/classify.js, pero para máscaras en vez
   de una categoría: arranca el worker, le pasa una miniatura y
   devuelve una máscara del tamaño ORIGINAL de la imagen (0-255,
   directamente lista para el canal alfa de una máscara de capa).

   Las dos operaciones —persona (BodyPix) y cielo (DeepLab/ADE20K)—
   comparten worker pero cargan su modelo por separado y sólo cuando
   se piden de verdad: son varios megas cada uno, y no toda sesión
   necesita las dos cosas.
   ═══════════════════════════════════════════════════════════════ */

const TF_URL       = new URL("../../vendor/tf.min.js", import.meta.url).href;
const BODYPIX_URL  = new URL("../../vendor/body-pix.min.umd.js", import.meta.url).href;
const DEEPLAB_URL  = new URL("../../vendor/deeplab.min.js", import.meta.url).href;
const BODYPIX_MODEL_URL = new URL("../../../assets/models/bodypix/model.json", import.meta.url).href;
const SKY_MODEL_URL     = new URL("../../../assets/models/deeplab-ade20k/model.json", import.meta.url).href;

/* Lado mayor de la miniatura de trabajo: de sobra para una máscara
   que luego se desvanece un poco en los bordes —no hace falta pedirle
   al modelo resolución que no va a usar—, y DeepLab tiene su propio
   tope interno de 513 px por lado de todas formas. */
const WORK_SIZE = 512;

let worker = null, readyPromise = null;
let nextId = 1;
const pending = new Map();

function ensureWorker(){
  if(readyPromise) return readyPromise;
  if(typeof Worker === "undefined") return Promise.reject(new Error("Este navegador no tiene Web Workers."));

  readyPromise = new Promise((resolve, reject) => {
    try{
      worker = new Worker(new URL("./worker.js", import.meta.url));
    }catch(err){ reject(err); return; }

    worker.onmessage = e => {
      const m = e.data || {};
      if(m.type === "ready"){ resolve(m); return; }
      if(m.type === "result"){
        const p = pending.get(m.id);
        if(p){ pending.delete(m.id); p.resolve(m); }
        return;
      }
      if(m.type === "error"){
        if(m.id != null){
          const p = pending.get(m.id);
          if(p){ pending.delete(m.id); p.reject(new Error(m.message)); }
        } else reject(new Error(m.message));
      }
    };
    worker.onerror = ev => {
      const err = new Error(ev.message || "El worker de segmentación ha fallado.");
      reject(err);
      for(const p of pending.values()) p.reject(err);
      pending.clear();
    };
    worker.postMessage({ type:"init", tfUrl: TF_URL, bodyPixUrl: BODYPIX_URL, deeplabUrl: DEEPLAB_URL });
  });
  readyPromise.catch(() => { readyPromise = null; worker = null; });
  return readyPromise;
}

/* Miniatura de trabajo: recorte no, deformación no —una máscara de
   segmentación necesita ver la foto entera tal cual es, sin recortar
   ningún borde—, así que se reduce entera respetando su proporción. */
function workThumb(src, maxSide){
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, w, h);
  return { imageData: x.getImageData(0, 0, w, h), w, h };
}

/* Máscara pequeña (0/1 por píxel) → alfa 0-255 al tamaño de `src`. Un
   desenfoque ligero en el propio canvas de destino suaviza el
   escalado: sin él, una máscara calculada a 512 px y estirada a un
   documento de 4000 px se ve dentada en el borde del sujeto. */
function upscaleMask(data, w, h, outW, outH){
  const small = document.createElement("canvas");
  small.width = w; small.height = h;
  const sx = small.getContext("2d");
  const img = sx.createImageData(w, h);
  for(let i = 0; i < data.length; i++){
    const v = data[i] ? 255 : 0;
    img.data[i*4] = img.data[i*4+1] = img.data[i*4+2] = 255;
    img.data[i*4+3] = v;
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

async function run(type, src, modelUrl){
  await ensureWorker();
  const { imageData, w, h } = workThumb(src, WORK_SIZE);
  const id = nextId++;
  const res = await new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ type, id, modelUrl,
      image: { data: imageData.data, width: w, height: h } });
  });
  const mask = upscaleMask(res.data, res.width, res.height, src.width, src.height);
  return { mask, ms: res.ms, hasSky: res.hasSky };
}

/** Máscara de persona (0-255) del tamaño de `src`. Vacía —todo ceros—
    si BodyPix no encuentra a nadie con la confianza mínima. */
export function segmentPerson(src){
  return run("segmentPerson", src, BODYPIX_MODEL_URL);
}

/** Máscara de cielo (0-255) del tamaño de `src`. `hasSky` distingue
    «no hay cielo en la foto» de «hubo un fallo»: el modelo siempre
    contesta con las 150 clases de ADE20K disponibles; si ninguna
    corresponde a cielo, la máscara sale vacía a propósito. */
export function segmentSky(src){
  return run("segmentSky", src, SKY_MODEL_URL);
}
