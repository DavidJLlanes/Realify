/* ═══════════════════════════════════════════════════════════════
   UNIFICAR ILUMINACIÓN · MANDOS
   Esquema de js/ui/kit/params-panel.js (los mismos mandos sirven al diálogo simple). Entradas: ninguna. Salida: PARAMS.
   ══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "color", label: "Color del fondo", type: "range", min: 0, max: 100, step: 1, def: 60, unit: " %" },
  { key: "luz", label: "Luz del fondo", type: "range", min: 0, max: 100, step: 1, def: 40, unit: " %" }
];
