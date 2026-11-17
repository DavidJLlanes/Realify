/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · RECETA NEUTRA
   Pregunta «¿esta receta deja la foto igual que el original?». Está aparte de la cadena para que la sesión y el visor puedan
   usarla sin cargar los motores de píxeles (que son pesados y se cargan al primer ajuste).
   Entradas: esNeutra(receta). Salidas: boolean. Límites: sin DOM ni dependencias.
   ═══════════════════════════════════════════════════════════════ */
export const esNeutra = receta => !Object.values(receta?.ajustes || {}).some(v => v);
