/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · PUENTE · MEDIABUNNY
   Carga bajo demanda (import() dinámico) Mediabunny 1.65.2 (MPL-2.0, js/vendor/mediabunny/): lee y escribe MP4/WebM, ordena los códecs y usa WebCodecs. Nada se descarga
   hasta que el editor abre o exporta un vídeo. Entradas: ninguna. Salida: promesa del módulo (una sola carga, se reutiliza). Falla con un Error claro si no se puede cargar.
   ═══════════════════════════════════════════════════════════════ */
let carga = null;
export function cargarMediabunny(){
  if(!carga) carga = import("../../../js/vendor/mediabunny/mediabunny.min.mjs").catch(err => { carga = null; throw new Error("No se pudo cargar el soporte de vídeo: " + (err.message || err)); });
  return carga;
}
