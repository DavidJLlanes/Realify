/* ═══════════════════════════════════════════════════════════════
   BRILLOS DE LA PIEL · PARÁMETROS
   Mandos del grupo «Brillos» del editor de cara (esquema de js/ui/kit/params-panel.js). Las intensidades (_int) empiezan a 0 salvo en
   la función que se abre; `def` es el valor con el que arranca esa función. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "brillos_int", label: "Intensidad", type: "range", min: 0, max: 100, step: 1, def: 60, unit: " %", group: "brillos", fx: true }
];
