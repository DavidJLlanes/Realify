/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · COLOR
   Tablas de paso entre sRGB (bytes) y luz lineal (flotante), comunes a
   engine.js (mezcla simple) y multiband.js (costuras y pirámides).
   ═══════════════════════════════════════════════════════════════ */

/** sRGB (0-255) → luz lineal (0-1). */
export const TO_LIN = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; TO_LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }

/** Luz lineal (0-1, se recorta) → sRGB (0-255, sin redondear). */
export const enc = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; return (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255; };
