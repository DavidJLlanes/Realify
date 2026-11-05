/* ═══════════════════════════════════════════════════════════════
   COLOCAR TEXTO EN LA ZONA LIBRE · ANÁLISIS
   Mapa de importancia (sujeto + caras, el de «Recorte inteligente») y luminancia en la misma rejilla. Entradas: lienzo de la foto.
   Salida: { imp, lum, gw, gh }.
   ══════════════════════════════════════════════════════════════ */
import { importanceMap } from "../../smartcrop.js";

export async function analizar(src){
  const M = await importanceMap(src), { gw, gh } = M;
  const c = document.createElement("canvas"); c.width = gw; c.height = gh;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(src, 0, 0, gw, gh);
  const d = x.getImageData(0, 0, gw, gh).data, lum = new Float32Array(gw * gh);
  for(let i = 0; i < lum.length; i++) lum[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
  return { imp: M.imp, lum, gw, gh };
}
