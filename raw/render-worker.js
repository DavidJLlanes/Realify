import { renderPhoto } from "./pipeline.js";

let source;
self.onmessage = ({ data }) => {
  const { id, type, settings } = data;
  try {
    if (type === "source") {
      source?.close?.();
      source = data.source || data.bitmap;
      self.postMessage({ id });
      return;
    }
    if (!source) throw new Error("No hay imagen para revelar");
    const canvas = renderPhoto(source, settings, {region:data.region});
    const bitmap = canvas.transferToImageBitmap();
    canvas.width=canvas.height=1;
    self.postMessage({ id, bitmap }, [bitmap]);
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
