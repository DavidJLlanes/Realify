/* ═══════════════════════════════════════════════════════════════
   MEJORAR CIELO · MANDOS
   Esquema de js/ui/kit/params-panel.js (los mismos mandos sirven al diálogo simple). Entradas: ninguna. Salida: PARAMS.
   ══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "realce", label: "Realce del cielo", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %" },
  { key: "relleno", label: "Rellenar cielo apagado", type: "range", min: 0, max: 100, step: 1, def: 0, unit: " %" },
  { key: "primerPlano", label: "Luz del primer plano", type: "range", min: -100, max: 100, step: 1, def: 0, unit: " %" }
];
