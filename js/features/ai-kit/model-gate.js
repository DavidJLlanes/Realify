/* ═══════════════════════════════════════════════════════════════
   AI-KIT · AVISO DE DESCARGA Y ERRORES DE MEMORIA
   Lo que necesita una función antes de usar un modelo: saber si ya está guardado, cuánto pesa (para avisar antes de
   descargarlo) y si la sesión anterior se cerró por falta de memoria con él. El aviso de descarga lo lanza runModel.
   ═══════════════════════════════════════════════════════════════ */

export { isModelCached, sizeNote, crashedBefore } from "../../ai/runtime.js";
