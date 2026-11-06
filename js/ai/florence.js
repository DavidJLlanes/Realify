/* ═══════════════════════════════════════════════════════════════
   IA · FLORENCE-2 (describir una foto)
   Prepara la foto (768×768, estirada como el procesador oficial) y pide al worker el texto. Órdenes: corta («What does the image describe?»),
   detallada y párrafo. El resultado está en inglés. Entradas: lienzo y nivel. Salida: texto.
   Límites: 275 MB que se bajan al usarlo (avisando); en un móvil tarda decenas de segundos. Sin detecciones ni regiones: sólo descripción.
   ═══════════════════════════════════════════════════════════════ */
import { runModel } from "./runtime.js";

export const ORDENES = { corta: ["What does the image describe?", 40], detallada: ["Describe in detail what is shown in the image.", 80], parrafo: ["Describe with a paragraph what is shown in the image.", 120] };

export async function describirFoto(src, nivel = "corta"){
  const [prompt, maxTokens] = ORDENES[nivel] || ORDENES.corta, S = 768;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, S, S);
  const rgba = x.getImageData(0, 0, S, S).data;
  const r = await runModel("florence", "florence_dec", { rgba, prompt, maxTokens }, [rgba.buffer], { title: "Describiendo la foto con IA" });
  return r.text;
}
