/* ═══════════════════════════════════════════════════════════════
   RECUPERAR LUCES · MANDOS
   Esquema de js/ui/kit/params-panel.js (los mismos mandos sirven al diálogo simple). Entradas: ninguna. Salida: PARAMS.
   ══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "fuerza", label: "Cantidad", type: "range", min: 0, max: 100, step: 1, def: 70, unit: " %" },
  { key: "umbral", label: "Desde qué nivel es «quemado»", type: "range", min: 80, max: 100, step: 1, def: 98, unit: " %" }
];
