/* ═══════════════════════════════════════════════════════════════
   REALZAR POR TIPO · MANDOS
   Esquema de js/ui/kit/params-panel.js (los mismos mandos sirven al diálogo simple). Entradas: ninguna. Salida: PARAMS.
   ══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "tipo", label: "Tipo", type: "select", def: "agua", options: [["agua", "Agua"], ["follaje", "Follaje"], ["cielo", "Cielo"], ["edificios", "Edificios"], ["piel", "Piel"]] },
  { key: "cantidad", label: "Color", type: "range", min: -100, max: 100, step: 1, def: 40, unit: " %" },
  { key: "detalle", label: "Detalle", type: "range", min: 0, max: 100, step: 1, def: 30, unit: " %" }
];
