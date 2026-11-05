/* ═══════════════════════════════════════════════════════════════
   RETRATO · ÍNDICES DE LA MALLA DE LA CARA (puro)
   Grupos de puntos de la malla de 478 puntos de MediaPipe (js/ai/tasks/landmarks.js) que usan las zonas de la piel.
   Entradas: ninguna. Salida: IDX = { óvalo, ojos, cejas, labios, … } con listas de índices.
   ═══════════════════════════════════════════════════════════════ */

export const IDX = {
  ovalo: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  ojoD: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],     // el de la izquierda de la foto
  ojoI: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
  ceja_D: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  ceja_I: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  labios: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
  boca: { comisuraD: 61, comisuraI: 291, mentón: 152 },
  nariz: { punta: 1, alaD: 129, alaI: 358, puente: 6, entrecejo: 9, frente: 10 },
  fosaD: 98, fosaI: 327
};
