/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · RELLENO CON LAMA
   Adaptador de `rellenar` (fondo.js) al relleno con IA (js/ai/relleno.js: LaMa, o MI-GAN en el móvil).
   Entradas: RGBA N×N, hueco N×N, N. Salida: RGBA N×N. LaMa se descarga la primera vez (≈208 MB, avisa el runtime); MI-GAN ya viene en la web.
   ═══════════════════════════════════════════════════════════════ */
export async function lamaInpaint(rgba, hole, N){
  const { rellenar } = await import("../../ai/relleno.js");
  return rellenar(rgba, hole, N, { title: "Rellenando el fondo" });
}
