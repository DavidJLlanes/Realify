/* ═══════════════════════════════════════════════════════════════
   LUZ DIRECCIONAL CON RELIEVE · MANDOS
   Esquema de js/ui/kit/params-panel.js (los mismos mandos sirven al diálogo simple). Entradas: ninguna. Salida: PARAMS.
   ══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "azimut", label: "Dirección", type: "range", min: -90, max: 90, step: 1, def: -40, unit: " °" },
  { key: "altura", label: "Altura", type: "range", min: 0, max: 90, step: 1, def: 30, unit: " °" },
  { key: "intensidad", label: "Intensidad", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %" },
  { key: "relieve", label: "Relieve", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %" }
];
