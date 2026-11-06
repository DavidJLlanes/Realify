/* ═══════════════════════════════════════════════════════════════
   IA · RELLENO (elección de motor)
   Un solo punto para rellenar huecos: LaMa (208 MB, más calidad) en equipos de escritorio y MI-GAN (28 MB, ya incluido en la web, sin
   descarga) en el móvil o con poca memoria. Entradas: RGBA N×N, hueco N×N, N y opciones de runModel. Salida: { rgba } N×N.
   ═══════════════════════════════════════════════════════════════ */
import { COARSE } from "../core/device.js";

export const rellenoLigero = () => COARSE || (navigator.deviceMemory || 8) <= 4;

export async function rellenar(rgba, hole, N, opts = {}){
  const { runModel } = await import("./runtime.js");
  const args = { rgba, hole, size: N }, tr = [rgba.buffer, hole.buffer];
  return rellenoLigero() ? runModel("migan", "migan", args, tr, opts) : runModel("inpaint", "lama", args, tr, opts);
}
