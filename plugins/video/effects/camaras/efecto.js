/* ═══════════════════════════════════════════════════════════════
   EFECTO ESTILOS DE CÁMARA · ADAPTADOR
   Dibuja cada fotograma con CamarasGL (WebGL2) y la receta elegida. La semilla cambia con el fotograma (grano, polvo y parpadeo se mueven). Entradas: lienzo, params { estilo, intensidad }, t.
   Salida: lienzo nuevo. Sin WebGL2 lanza un error claro en prepare (el motor salta el efecto y lo anota).
   ═══════════════════════════════════════════════════════════════ */
import { cargarCamaras } from "../../bridge/efectos.js";

export function crear(){
  let C = null, gl = null;
  return {
    async prepare(){ C = await cargarCamaras(); gl = new C.CamarasGL(); },
    process(frame, params, t){
      const pr = C.PRESETS.find(p => p.id === params.estilo) || C.PRESETS[0], w = frame.width, h = frame.height;
      gl.setImage(frame, w, h); gl.setTexture(frame);
      gl.render({ preset: pr.id, intensity: params.intensidad ?? 100, seed: 1 + Math.round((t || 0) * 30), date: "", premium: true, values: pr.values }, { cw: w, ch: h });
      const out = Object.assign(document.createElement("canvas"), { width: w, height: h }); out.getContext("2d").drawImage(gl.canvas, 0, 0); return out;
    },
    dispose(){ try{ gl?.dispose(); }catch{} gl = null; }
  };
}
