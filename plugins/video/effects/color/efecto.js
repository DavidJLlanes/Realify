/* ═══════════════════════════════════════════════════════════════
   EFECTO COLOR · ADAPTADOR AL LIENZO
   Pasa el fotograma por la versión WebGL (gl.js) y, si no hay WebGL, lee los píxeles y llama al motor puro (motor.js); devuelve un lienzo nuevo. Entradas: lienzo y params. Salida: lienzo. Sin cambios (todo a 0) devuelve el mismo lienzo.
   ═══════════════════════════════════════════════════════════════ */
import { aplicarColor, POR_DEFECTO } from "./motor.js";
import { crearGL } from "./gl.js";

export function crear(){
  let gl = null, probado = false;
  return {
    prepare(){ if(!probado){ probado = true; try{ gl = crearGL(); }catch{ gl = null; } } },
    process(frame, params){
      const p = { ...POR_DEFECTO, ...params }; if(!Object.values(p).some(Boolean)) return frame;
      if(!probado) this.prepare();
      if(gl){ try{ return gl.aplicar(frame, p); }catch{ gl = null; } }
      const out = Object.assign(document.createElement("canvas"), { width: frame.width, height: frame.height }), x = out.getContext("2d", { willReadFrequently: true });
      x.drawImage(frame, 0, 0); const im = x.getImageData(0, 0, out.width, out.height); aplicarColor(im.data, p); x.putImageData(im, 0, 0); return out;
    },
    dispose(){ gl?.liberar(); gl = null; probado = false; }
  };
}
