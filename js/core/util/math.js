/* ═══════════════════════════════════════════════════════════════
   UTILIDADES · Matemáticas pequeñas que estaban copiadas en muchos archivos (limitar valores, curvas gamma, bases, hash entero, tramado).
   Una sola copia: antes estaban repetidas, idénticas, en 3 o más archivos (fase 4 de la reorganización).
   ═══════════════════════════════════════════════════════════════ */

export const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

export const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

export const hash32 = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

export const linearToSrgb255 = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const ditherAt = (x, y, c) => {
  let h = Math.imul(x * 3 + c + 0x2545f491, 0x9e3779b1) ^ Math.imul(y + 0x6a09e667, 0x85ebca77);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return ((h & 1023) + 0.5) / 1024 - 0.5;
};

export const clampCmp = (v, a, b) => v < a ? a : v > b ? b : v;

export const bell = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
