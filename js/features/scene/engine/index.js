/* ═══════════════════════════════════════════════════════════════
   ESCENA · MOTOR (puro, sin DOM)
   Reúne los motores de escena, cada uno sobre planos Float32 en luz lineal. Entradas y salidas: ver cada archivo.
   ═══════════════════════════════════════════════════════════════ */
export { mejorarCielo, haySky } from "./cielo.js";
export { quitarNeblina, hayNeblina, luzAtmosferica } from "./neblina.js";
export { realzarTipo, hayTipo, TIPOS } from "./categorias.js";
export { balanceZonas, hayBalance } from "./balance.js";
export { recuperarLuces, hayLuces } from "./luces.js";
export { armonizar, hayArmonia } from "./armonizar.js";
export { cromaProfundidad, luzRelieve, hayCroma, hayRelieve, normalesProfundidad } from "./profundidad.js";
