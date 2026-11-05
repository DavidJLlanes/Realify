/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · RELLENO CON LAMA
   Adaptador de `rellenar` (fondo.js) al modelo LaMa del catálogo (js/ai/models/inpaint.js), con la misma llamada que «Borrar con IA».
   Entradas: RGBA N×N, hueco N×N, N. Salida: RGBA N×N. La primera vez descarga el modelo (≈208 MB, avisa el ejecutor del runtime).
   ═══════════════════════════════════════════════════════════════ */
export async function lamaInpaint(rgba, hole, N){
  const { runModel } = await import("../../ai/runtime.js");
  return runModel("inpaint", "lama", { rgba, hole, size: N }, [rgba.buffer, hole.buffer], { title: "Rellenando el fondo" });
}
