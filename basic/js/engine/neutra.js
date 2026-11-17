/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · RECETA NEUTRA
   Valores de fábrica del recorte y del estilo y la pregunta «¿esta receta deja la foto igual que el original?». Está aparte de la cadena para que
   la sesión y el visor puedan usarla sin cargar los motores de píxeles (que son pesados y se cargan al primer ajuste).
   Entradas: esNeutra(receta) · esNeutraRecorte(recorte) · esNeutraEstilo(estilo). Salidas: boolean · RECORTE0 y ESTILO0 (valores sin tocar).
   Límites: sin DOM ni dependencias.
   ═══════════════════════════════════════════════════════════════ */
export const RECORTE0 = { giro: 0, volteoH: false, volteoV: false, angulo: 0, persV: 0, persH: 0, proporcion: "orig", rect: null };

export const ESTILO0 = { n: -1, k: 100 };

export const esNeutraEstilo = e => !e || e.n == null || e.n < 0;
export const esNeutraRecorte = r => !r || (!r.giro && !r.volteoH && !r.volteoV && !r.angulo && !r.persV && !r.persH && (r.proporcion || "orig") === "orig" && !r.rect);
export const esNeutra = receta => !Object.values(receta?.ajustes || {}).some(v => v) && esNeutraRecorte(receta?.recorte) && esNeutraEstilo(receta?.estilo);
