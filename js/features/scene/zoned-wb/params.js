/* ═══════════════════════════════════════════════════════════════
   BALANCE DE BLANCOS POR ZONAS · MANDOS
   Esquema de js/ui/kit/params-panel.js (los mismos mandos sirven al diálogo simple). Entradas: ninguna. Salida: PARAMS.
   ══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "fuerza", label: "Cantidad", type: "range", min: 0, max: 100, step: 1, def: 70, unit: " %" },
  { key: "zonas", label: "Tamaño de las zonas (más = más pequeñas)", type: "range", min: 2, max: 12, step: 1, def: 4 }
];
