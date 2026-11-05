/* ═══════════════════════════════════════════════════════════════
   RESTAURAR · MOTOR (puro, sin DOM)
   Reúne los motores de restauración, cada uno sobre planos Float32 en luz lineal. Entradas y salidas: ver cada archivo.
   ═══════════════════════════════════════════════════════════════ */
export { quitarDesenfoque, hayDeblur, estimar, nucleo } from "./deblur.js";
export { quitarMotas, detectarMotas, hayPolvo } from "./polvo.js";
export { quitarMoire, hayMoire } from "./moire.js";
export { limpiarRuido, nivelRuido, hayLimpieza } from "./limpiar.js";
