import { processPixels } from "./engine.js";

self.onmessage = ({ data: job }) => {
  try {
    const result = processPixels(job, progress => self.postMessage({ progress }));
    self.postMessage({ result }, [result.data.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || "No se pudo procesar la imagen." });
  }
};
