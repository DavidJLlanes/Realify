/* ═══════════════════════════════════════════════════════════════
   CABELLO · PARÁMETROS
   Mandos del grupo «Cabello» del editor de cara (esquema de js/ui/kit/params-panel.js). `fx`: el mando activa el efecto; `neutro`: su valor sin
   efecto. Al abrir una función, sus mandos `fx` empiezan en `def` y los de las demás en su neutro. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "pelo_tono", label: "Tono", type: "range", min: -180, max: 180, step: 1, def: 0, unit: " °", group: "pelo", fx: true },
  { key: "pelo_sat", label: "Saturación", type: "range", min: -100, max: 100, step: 1, def: 0, unit: " %", group: "pelo", fx: true },
  { key: "pelo_luz", label: "Luz", type: "range", min: -50, max: 50, step: 1, def: 0, unit: " %", group: "pelo", fx: true },
  { key: "pelo_brillo", label: "Brillo", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %", group: "pelo", fx: true },
  { key: "pelo_volumen", label: "Volumen", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %", group: "pelo", fx: true }
];
