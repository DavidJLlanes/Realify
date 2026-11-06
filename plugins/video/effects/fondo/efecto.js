/* ═══════════════════════════════════════════════════════════════
   EFECTO FONDO · ADAPTADOR
   Pide el alfa al modelo (bridge/ia.js), lo suaviza en el tiempo, lo lleva al tamaño del fotograma y compone sujeto sobre fondo (desenfocado, oscuro, gris o color). Si dos fotogramas
   no son consecutivos (se busca en la línea de tiempo) se olvida el pasado. Entradas: lienzo, params { modo, fuerza, color, estable }, t. Salida: lienzo.
   `crear({ alfaDe })` permite inyectar otro proveedor de alfa (pruebas). Si el modelo falla, el motor salta el efecto y lo anota.
   ═══════════════════════════════════════════════════════════════ */
import { alfaDelFotograma } from "../../bridge/ia.js";
import { suavizarTemporal, escalarAlfa, endurecer, componer } from "./engine.js";

const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) || 0);

export function crear({ alfaDe = alfaDelFotograma } = {}){
  let previo = null, tPrevio = -1, fps = 30;
  return {
    prepare(ctx){ fps = ctx?.fps || 30; },
    async process(frame, params, t){
      const w = frame.width, h = frame.height, consecutivo = tPrevio >= 0 && t > tPrevio && t - tPrevio < 2.5 / fps;
      const { alfa, n } = await alfaDe(frame), k = (params.estable ?? 55) / 100;
      const suave = suavizarTemporal(consecutivo ? previo : null, alfa, k); previo = suave; tPrevio = t;
      const a = endurecer(escalarAlfa(suave, n, w, h), 0.4);
      const out = Object.assign(document.createElement("canvas"), { width: w, height: h }), x = out.getContext("2d", { willReadFrequently: true }), f = (params.fuerza ?? 70) / 100;
      const bg = Object.assign(document.createElement("canvas"), { width: w, height: h }), bx = bg.getContext("2d", { willReadFrequently: true });
      if(params.modo === "color"){ bx.fillStyle = params.color || "#1b8a5a"; bx.fillRect(0, 0, w, h); }
      else { bx.filter = params.modo === "desenfoque" ? `blur(${Math.round(2 + f * Math.max(w, h) / 40)}px)` : params.modo === "gris" ? `grayscale(${f})` : `brightness(${1 - f * 0.8})`; bx.drawImage(frame, 0, 0); bx.filter = "none"; }
      x.drawImage(frame, 0, 0); const im = x.getImageData(0, 0, w, h); componer(im.data, bx.getImageData(0, 0, w, h).data, a); x.putImageData(im, 0, 0); return out;
    },
    dispose(){ previo = null; }
  };
}
