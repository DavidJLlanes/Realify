/* ═══════════════════════════════════════════════════════════════
   QUITAR NEBLINA CON PROFUNDIDAD · MANDOS
   Esquema de js/ui/kit/params-panel.js (los mismos mandos sirven al diálogo simple). Entradas: ninguna. Salida: PARAMS.
   ══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "fuerza", label: "Cantidad", type: "range", min: 0, max: 100, step: 1, def: 60, unit: " %" },
  { key: "profundidad", label: "Peso de la distancia", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %" }
];
