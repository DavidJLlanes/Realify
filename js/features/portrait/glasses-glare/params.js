/* ═══════════════════════════════════════════════════════════════
   REFLEJOS EN GAFAS · PARÁMETROS
   Mandos del grupo «Reflejos gafas» del editor de cara (esquema de js/ui/kit/params-panel.js). `fx`: el mando activa el efecto; `neutro`: su valor sin
   efecto. Al abrir una función, sus mandos `fx` empiezan en `def` y los de las demás en su neutro. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "gafas_int", label: "Intensidad", type: "range", min: 0, max: 100, step: 1, def: 70, unit: " %", group: "gafas", fx: true }
];
