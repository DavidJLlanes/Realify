/* ═══════════════════════════════════════════════════════════════
   EFECTO COLOR · ADAPTADOR AL LIENZO
   Lee los píxeles del fotograma, llama al motor puro (motor.js) y devuelve un lienzo nuevo. Entradas: lienzo y params. Salida: lienzo. Sin cambios (todo a 0) devuelve el mismo lienzo.
   ═══════════════════════════════════════════════════════════════ */
import { aplicarColor, POR_DEFECTO } from "./motor.js";

export function crear(){
  return {
    prepare(){},
    process(frame, params){
      const p = { ...POR_DEFECTO, ...params }; if(!Object.values(p).some(Boolean)) return frame;
      const out = Object.assign(document.createElement("canvas"), { width: frame.width, height: frame.height }), x = out.getContext("2d", { willReadFrequently: true });
      x.drawImage(frame, 0, 0); const im = x.getImageData(0, 0, out.width, out.height); aplicarColor(im.data, p); x.putImageData(im, 0, 0); return out;
    },
    dispose(){}
  };
}
