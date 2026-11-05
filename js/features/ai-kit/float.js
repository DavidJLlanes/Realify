/* ═══════════════════════════════════════════════════════════════
   AI-KIT · LUZ LINEAL
   Tabla sRGB → luz lineal (0-1) para los 256 valores de un byte, y las conversiones de vuelta y de huella que usan las
   funciones de IA al trabajar en coma flotante (modo Premium: «el bueno y el mejor»).
   Salidas: DEC (Float32Array de 256), enc (luz lineal → byte sRGB) y hash (ruido determinista).
   Más adelante (Fases 3 y 4): OKLab y tramado.
   ═══════════════════════════════════════════════════════════════ */

import { hash32 as hash, linearToSrgb255 as enc } from "../../core/util/math.js";

export const DEC = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; DEC[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }

export { hash, enc };
