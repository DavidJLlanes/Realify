/* ═══════════════════════════════════════════════════════════════
   IA · CAPACIDADES DE LA GPU
   Dice si el navegador tiene un adaptador WebGPU real y si admite «shader-f16» (números de 16 bits), que necesitan los modelos en fp16 y q4f16
   (Depth Anything Base, Qwen). Sin f16, ONNX Runtime puede abortar en plena inferencia y dejar el motor inservible. Resultado en caché.
   Entradas: ninguna. Salida: promesa de { gpu, f16 }.
   ═══════════════════════════════════════════════════════════════ */
let cache = null;

export const capacidadesGPU = () => cache || (cache = (async () => {
  try{
    const a = navigator.gpu && await navigator.gpu.requestAdapter();
    return { gpu: !!a, f16: !!(a && a.features && a.features.has("shader-f16")) };
  }catch{ return { gpu: false, f16: false }; }
})());
