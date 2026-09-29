import { renderPhoto } from "./pipeline.js";
import { renderPremiumRows } from "./premium/render.js";

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
    /* Premium: filas de salida [d0, d1), reducidas en luz lineal si el
       resultado es menor que el original; en 8 bits (ImageBitmap) o 16
       (Uint16Array RGB, para TIFF). */
    if (type === "premium") {
      const { d0, d1, outW, outH, bits } = data;
      const px = renderPremiumRows(source, settings, d0, d1, outW, outH, bits);
      if (bits === 16) { self.postMessage({ id, pixels: px }, [px.buffer]); return; }
      const c = new OffscreenCanvas(outW, d1 - d0);
      c.getContext("2d").putImageData(new ImageData(px, outW, d1 - d0), 0, 0);
      const bitmap = c.transferToImageBitmap();
      self.postMessage({ id, bitmap }, [bitmap]);
      return;
    }
    const canvas = renderPhoto(source, settings, {region:data.region});
    const bitmap = canvas.transferToImageBitmap();
    canvas.width=canvas.height=1;
    self.postMessage({ id, bitmap }, [bitmap]);
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
