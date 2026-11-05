/* ═══════════════════════════════════════════════════════════════
   LUZ EN LA CARA · PARÁMETROS
   Mandos del grupo «Luz» del editor de cara (esquema de js/ui/kit/params-panel.js). `fx`: el mando activa el efecto; `neutro`: su valor sin
   efecto. Al abrir una función, sus mandos `fx` empiezan en `def` y los de las demás en su neutro. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "luz_int", label: "Intensidad", type: "range", min: 0, max: 100, step: 1, def: 60, unit: " %", group: "luz", fx: true },
  { key: "luz_azim", label: "Dirección (izquierda ↔ derecha)", type: "range", min: -90, max: 90, step: 1, def: -40, unit: " °", group: "luz" },
  { key: "luz_alt", label: "Altura", type: "range", min: 0, max: 90, step: 1, def: 35, unit: " °", group: "luz" },
  { key: "luz_suave", label: "Suavidad", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %", group: "luz" }
];
