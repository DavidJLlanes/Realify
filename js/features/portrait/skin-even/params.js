/* ═══════════════════════════════════════════════════════════════
   IMPERFECCIONES Y TONO · PARÁMETROS
   Mandos del grupo «Imperfecciones» del editor de cara (esquema de js/ui/kit/params-panel.js). Las intensidades (_int) empiezan a 0 salvo en
   la función que se abre; `def` es el valor con el que arranca esa función. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "imperf_int", label: "Imperfecciones", type: "range", min: 0, max: 100, step: 1, def: 60, unit: " %", group: "tono" },
  { key: "tono_int", label: "Uniformar tono", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %", group: "tono" }
];
