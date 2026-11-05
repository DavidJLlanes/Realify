/* ═══════════════════════════════════════════════════════════════
   MOIRÉ Y BANDAS · MANDOS
   Esquema de js/ui/kit/params-panel.js (los mismos mandos sirven al diálogo simple). Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "cantidad", label: "Cantidad", type: "range", min: 0, max: 100, step: 1, def: 60, unit: " %" },
  { key: "soloColor", label: "Solo el color (no toca la luz)", type: "toggle", def: false }
];
