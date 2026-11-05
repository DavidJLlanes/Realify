/* ═══════════════════════════════════════════════════════════════
   LABIOS Y CEJAS · PARÁMETROS
   Mandos del grupo «Labios y cejas» del editor de cara (esquema de js/ui/kit/params-panel.js). `fx`: el mando activa el efecto; `neutro`: su valor sin
   efecto. Al abrir una función, sus mandos `fx` empiezan en `def` y los de las demás en su neutro. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "labios_int", label: "Color de los labios", type: "range", min: -100, max: 100, step: 1, def: 30, unit: " %", group: "labios", fx: true },
  { key: "labios_def", label: "Definición de los labios", type: "range", min: 0, max: 100, step: 1, def: 30, unit: " %", group: "labios", fx: true },
  { key: "cejas_int", label: "Cejas más oscuras", type: "range", min: 0, max: 100, step: 1, def: 0, unit: " %", group: "labios", fx: true },
  { key: "cejas_huecos", label: "Rellenar huecos de las cejas", type: "range", min: 0, max: 100, step: 1, def: 40, unit: " %", group: "labios", fx: true }
];
