/* ═══════════════════════════════════════════════════════════════
   SEGMENTACIÓN · WORKER
   Mismo patrón que filters/lens/worker.js: TensorFlow.js y los
   modelos viven aquí, fuera del hilo de la interfaz. Dos modelos
   posibles —BodyPix para personas, DeepLab (ADE20K) para escena
   completa, de donde sale «cielo»—, cada uno cargado sólo la primera
   vez que hace falta de verdad: no todo el mundo va a pedir las dos
   cosas en la misma sesión, y son varios megas de pesos cada uno.

   Worker CLÁSICO, no módulo: tanto `tf.min.js` como los paquetes de
   BodyPix y DeepLab son UMD, y `importScripts` —que sólo tienen los
   workers clásicos— es la única forma de cargarlos sin empaquetador.
   ═══════════════════════════════════════════════════════════════ */

/* A diferencia de Lens —que carga con `tf.loadLayersModel` y sí puede
   guardarse a mano en IndexedDB con `model.save(...)`—, BodyPix y
   DeepLab cargan como GraphModel a través de sus propias librerías, sin
   ese gancho. La segunda visita sin conexión de todas formas encuentra
   los pesos: el service worker de la app cachea cualquier petición al
   mismo origen (ver sw.js), pesos del modelo incluidos. */
let personNet = null, skyModel = null;

function post(msg, transfer){ self.postMessage(msg, transfer || []); }

async function pickBackend(){
  try{
    if(typeof OffscreenCanvas !== "undefined" && await tf.setBackend("webgl")){
      await tf.ready();
      return "webgl";
    }
  }catch{}
  await tf.setBackend("cpu");
  await tf.ready();
  return "cpu";
}

async function ensurePersonNet(modelUrl){
  if(personNet) return personNet;
  // El paquete se expone a sí mismo como `self["body-pix"]` —con
  // guión, tal cual su nombre en npm—, no como el identificador
  // `bodyPix`: no se puede acceder con notación de punto.
  personNet = await self["body-pix"].load({
    architecture:"MobileNetV1", outputStride:16, multiplier:0.75, quantBytes:2, modelUrl
  });
  return personNet;
}

async function ensureSkyModel(modelUrl){
  if(skyModel) return skyModel;
  skyModel = await deeplab.load({ base:"ade20k", quantizationBytes:2, modelUrl });
  return skyModel;
}

self.onmessage = async e => {
  const m = e.data || {};
  try{
    if(m.type === "init"){
      const t0 = performance.now();
      importScripts(m.tfUrl, m.bodyPixUrl, m.deeplabUrl);
      const backend = await pickBackend();
      post({ type:"ready", backend, ms: Math.round(performance.now() - t0) });
      return;
    }

    if(m.type === "segmentPerson"){
      const t0 = performance.now();
      const net = await ensurePersonNet(m.modelUrl);
      const img = new ImageData(new Uint8ClampedArray(m.image.data), m.image.width, m.image.height);
      const seg = await net.segmentPerson(img, {
        internalResolution: "medium", segmentationThreshold: 0.5
      });
      // `seg.data` es un Uint8Array de 0/1, un byte por píxel: se manda
      // tal cual —el hilo principal lo convierte a alfa 0-255—.
      post({ type:"result", id: m.id, kind:"person",
             data: seg.data, width: seg.width, height: seg.height,
             ms: Math.round(performance.now() - t0) }, [seg.data.buffer]);
      return;
    }

    if(m.type === "segmentSky"){
      const t0 = performance.now();
      const model = await ensureSkyModel(m.modelUrl);
      const img = new ImageData(new Uint8ClampedArray(m.image.data), m.image.width, m.image.height);
      const { legend, width, height, segmentationMap } = await model.segment(img);
      const sky = legend.sky;
      const n = width * height;
      const mask = new Uint8Array(n);
      if(sky){
        for(let i = 0, p = 0; i < segmentationMap.length; i += 4, p++){
          if(segmentationMap[i] === sky[0] && segmentationMap[i+1] === sky[1] && segmentationMap[i+2] === sky[2]){
            mask[p] = 1;
          }
        }
      }
      post({ type:"result", id: m.id, kind:"sky",
             data: mask, width, height, hasSky: !!sky,
             ms: Math.round(performance.now() - t0) }, [mask.buffer]);
      return;
    }
  }catch(err){
    post({ type:"error", id: m.id, message: String(err && err.message || err) });
  }
};
