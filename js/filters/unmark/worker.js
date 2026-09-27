/* Unmark: las etapas de perturbación corren aquí para que el panel
   siga respondiendo mientras se arrastra un deslizador. Recibe el
   RGBA y los parámetros ya dosificados; devuelve el RGBA nuevo. */
import { runPipeline } from "./disrupt.js";

self.onmessage = ({ data: job }) => {
  try{
    const out = runPipeline(job, f => self.postMessage({ id: job.id, progress: f }));
    self.postMessage({ id: job.id, data: out }, [out.buffer]);
  }catch(err){
    self.postMessage({ id: job.id, error: err.message || "No se pudo procesar la imagen." });
  }
};
