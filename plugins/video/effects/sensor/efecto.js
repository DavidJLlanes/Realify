/* ═══════════════════════════════════════════════════════════════
   EFECTO SENSOR DE REALIFY · ADAPTADOR
   Pasa cada fotograma por el motor de la cadena de sensor (WebGL, modo Premium) y devuelve un lienzo. Las etapas de CPU (limpieza espectral por Fourier y JPEG) se dejan fuera: son
   demasiado lentas para vídeo. La semilla cambia con el fotograma, así el ruido «vive» y no queda un patrón fijo. Entradas: lienzo, params { preset, dosis }, t. Salida: lienzo.
   Si no hay WebGL devuelve el fotograma sin tocar y lo dice el motor (errores).
   ═══════════════════════════════════════════════════════════════ */
import { cargarSensor } from "../../bridge/efectos.js";
const SOLO_CPU = ["periodic", "hfslope", "jpeg"];

export function crear(){
  let S = null, premiumAntes = false;
  const etapas = (preset) => {
    const base = S.defaultStages(), pr = S.PRESETS[preset] || {}, o = {};
    for(const s of S.CHAIN){ const { on = false, ...p } = pr[s.id] || {}; o[s.id] = { on: !!on && !SOLO_CPU.includes(s.id), p: { ...base[s.id].p, ...p } }; }
    return o;
  };
  return {
    async prepare(){ S = await cargarSensor(); if(!S.engine.available()) throw new Error("El sensor de Realify necesita WebGL"); premiumAntes = S.engine.isPremium(); S.engine.setPremium(true); },
    process(frame, params, t){
      const dosis = Math.max(0, Math.min(1, (params.dosis ?? 100) / 100)); if(dosis <= 0) return frame;
      const out = Object.assign(document.createElement("canvas"), { width: frame.width, height: frame.height });
      S.engine.setSeed(1000 + Math.round((t || 0) * 1000)); S.engine.setSource(frame);
      S.engine.renderTo(out.getContext("2d"), etapas(params.preset || "Preparación de textura · suave"), { dose: dosis }); return out;
    },
    dispose(){ try{ S?.engine.setPremium(premiumAntes); }catch{} }
  };
}
