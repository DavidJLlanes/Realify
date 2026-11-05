/* ═══════════════════════════════════════════════════════════════
   PERSONAS · GRUPOS DE CLASES DEL SEGFORMER (puro, sin DOM)
   Qué clases del modelo forman cada parte que se ofrece al usuario (ids en js/ai/tasks/humanparse.js). Lo usan el proveedor de
   partes y «Seleccionar partes». Entradas: ninguna. Salida: GRUPOS = { parte: [ids de clase] }.
   ═══════════════════════════════════════════════════════════════ */

/** Grupos de clases del SegFormer (ids en js/ai/tasks/humanparse.js). */
export const GRUPOS = {
  pelo: [2], cara: [11], gafas: [3], sombrero: [1], ropaArriba: [4], vestido: [7], falda: [5], pantalon: [6], cinturon: [8],
  zapatos: [9, 10], brazoI: [14], brazoD: [15], piernaI: [12], piernaD: [13], bolso: [16], bufanda: [17],
  persona: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], piel: [11, 12, 13, 14, 15], ropa: [4, 5, 6, 7, 8, 17], brazos: [14, 15], piernas: [12, 13]
};
