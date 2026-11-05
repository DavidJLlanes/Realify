/* ═══════════════════════════════════════════════════════════════
   POLVO Y MOTAS · MANDOS
   Esquema de js/ui/kit/params-panel.js (los mismos mandos sirven al diálogo simple). Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "sensibilidad", label: "Sensibilidad", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %" },
  { key: "tamano", label: "Tamaño máximo de una mota", type: "range", min: 4, max: 60, step: 1, def: 24, unit: " px" }
];
