/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · PUENTE · MOTORES DE IMAGEN DE REALIFY
   Los efectos de vídeo reutilizan los motores que ya existen para fotos: la cadena de sensor (js/filters/camera, WebGL) y las cámaras (plugins/cameras, WebGL).
   Se cargan bajo demanda (import() dinámico) la primera vez que un efecto se instancia. Entradas: ninguna. Salidas: promesas de módulos y datos de catálogo.
   ═══════════════════════════════════════════════════════════════ */
export const cargarSensor = async () => {
  const [eng, chain, pres] = await Promise.all([import("../../../js/filters/camera/engine.js"), import("../../../js/filters/camera/chain.js"), import("../../../js/filters/camera/presets.js")]);
  return { engine: eng, CHAIN: chain.CHAIN, defaultStages: chain.defaultStages, PRESETS: pres.PRESETS };
};
export const cargarCamaras = async () => {
  const [eng, pres] = await Promise.all([import("../../cameras/engine.js"), import("../../cameras/presets.js")]);
  return { CamarasGL: eng.CamarasGL, PRESETS: pres.PRESETS, CATS: pres.CATS };
};
