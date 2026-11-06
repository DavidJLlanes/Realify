/* ═══════════════════════════════════════════════════════════════
   QUITAR DESENFOQUE · MANDOS
   Esquema de js/ui/kit/params-panel.js (los mismos mandos sirven al diálogo simple). Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "tipo", label: "Método", type: "select", def: "movimiento", options: [["movimiento", "Movimiento (medido)"], ["enfoque", "Fuera de foco (medido)"], ["ia", "IA · NAFNet (33 MB)"]] },
  { key: "tamano", label: "Tamaño del desenfoque (0 = medirlo)", type: "range", min: 0, max: 40, step: 1, def: 0, unit: " px" },
  { key: "angulo", label: "Ángulo del movimiento (−1 = medirlo)", type: "range", min: -1, max: 179, step: 1, def: -1, unit: " °" },
  { key: "cantidad", label: "Cantidad", type: "range", min: 0, max: 100, step: 1, def: 70, unit: " %" }
];
