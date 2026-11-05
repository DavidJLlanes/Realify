/* ═══════════════════════════════════════════════════════════════
   TEXTURA DE PIEL · PARÁMETROS
   Mandos del grupo «Textura» del editor de cara (esquema de js/ui/kit/params-panel.js). Las intensidades (_int) empiezan a 0 salvo en
   la función que se abre; `def` es el valor con el que arranca esa función. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "textura_int", label: "Intensidad", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %", group: "textura", fx: true },
  { key: "textura_poros", label: "Poros", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %", group: "textura" }
];
