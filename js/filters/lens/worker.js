/* ═══════════════════════════════════════════════════════════════
   ADAPTIVE PHOTO LENS · WORKER DE CLASIFICACIÓN
   Aquí vive TensorFlow.js y el modelo, fuera del hilo de la interfaz:
   cargar 1,9 MB de pesos y compilar los shaders de la primera
   inferencia son cosas de un segundo largo, y un segundo con los
   deslizadores congelados es exactamente lo que no debe pasar.

   Es un worker CLÁSICO (no módulo) a propósito: `tf.min.js` es un
   paquete UMD y la única forma de cargarlo dentro de un worker es
   `importScripts`, que los workers de tipo módulo no tienen.

   El modelo se carga una vez por sesión de página y se queda en
   memoria; entre sesiones se guarda en IndexedDB con el propio
   sistema de TensorFlow.js, así que la segunda visita no vuelve a
   pedir los pesos ni a la red ni a la caché HTTP. sessionStorage no
   sirve para eso —guarda cadenas y su cuota se queda corta para dos
   megas de pesos—, así que ahí sólo va la constancia de que el modelo
   está listo, que es lo que la interfaz necesita saber deprisa.
   ═══════════════════════════════════════════════════════════════ */

const IDB_KEY = "indexeddb://realify-adaptive-lens-mobilenet-v1-025";

let model = null;
let ready = false;
let backend = "?";

function post(msg){ self.postMessage(msg); }

async function pickBackend(){
  // WebGL en un worker necesita OffscreenCanvas; si no está, la CPU
  // de TensorFlow.js sirve igual: este modelo es pequeño a propósito.
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

async function loadModel(modelUrl){
  let fromCache = false;
  try{
    model = await tf.loadLayersModel(IDB_KEY);
    fromCache = true;
  }catch{
    model = await tf.loadLayersModel(modelUrl);
    try{ await model.save(IDB_KEY); }catch{ /* sin IndexedDB: se recarga la próxima vez */ }
  }
  return fromCache;
}

/* Un pase en vacío antes de dar el «listo»: la primera inferencia en
   WebGL compila todos los shaders y tarda diez veces más que las
   siguientes. Mejor pagarlo aquí, mientras el usuario todavía está
   mirando el panel, que en su primer clic en «Detectar». */
async function warmUp(){
  const x = tf.zeros([1, 224, 224, 3]);
  const y = model.predict(x);
  await y.data();
  x.dispose(); y.dispose();
}

self.onmessage = async e => {
  const m = e.data || {};
  try{
    if(m.type === "init"){
      const t0 = performance.now();
      importScripts(m.tfUrl);
      backend = await pickBackend();
      const cached = await loadModel(m.modelUrl);
      await warmUp();
      ready = true;
      post({ type:"ready", backend, cached, ms: Math.round(performance.now() - t0), version: tf.version.tfjs });
      return;
    }

    if(m.type === "classify"){
      if(!ready) throw new Error("El modelo todavía no está cargado.");
      const t0 = performance.now();
      const top = tf.tidy(() => {
        // MobileNet v1 espera la entrada en [-1, 1].
        const img = tf.browser.fromPixels(m.image).toFloat().sub(127.5).div(127.5).expandDims(0);
        const out = model.predict(img);
        return out.squeeze();
      });
      const probs = await top.data();
      top.dispose();
      const idx = Array.from(probs.keys()).sort((a, b) => probs[b] - probs[a]).slice(0, 10);
      post({ type:"result", id: m.id, top: idx.map(i => [i, probs[i]]),
             ms: Math.round(performance.now() - t0), backend });
      return;
    }
  }catch(err){
    post({ type:"error", id: m.id, message: String(err && err.message || err) });
  }
};
