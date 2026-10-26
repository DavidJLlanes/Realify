/* Worker de «Enfoque avanzado / estabilizador»: el cálculo a resolución
   completa (sharpen-engine.js) fuera del hilo de la interfaz. */
import { sharpenRGBA } from "./sharpen-engine.js";

self.onmessage = e => {
  const { id, data, w, h, p, scale = 1 } = e.data;
  try{
    const out = new Uint8ClampedArray(data);
    sharpenRGBA(out, w, h, p, scale);
    self.postMessage({ id, data: out.buffer }, [out.buffer]);
  }catch(err){ self.postMessage({ id, error: String(err && err.message || err) }); }
};
