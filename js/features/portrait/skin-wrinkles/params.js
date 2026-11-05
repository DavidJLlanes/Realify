/* ═══════════════════════════════════════════════════════════════
   ARRUGAS · PARÁMETROS
   Mandos del grupo «Arrugas» del editor de cara (esquema de js/ui/kit/params-panel.js). Las intensidades (_int) empiezan a 0 salvo en
   la función que se abre; `def` es el valor con el que arranca esa función. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "arrugas_int", label: "Intensidad", type: "range", min: 0, max: 100, step: 1, def: 60, unit: " %", group: "arrugas", fx: true },
  { key: "arrugas_tex", label: "Conservar textura", type: "range", min: 0, max: 100, step: 1, def: 70, unit: " %", group: "arrugas" },
  { key: "z_frente", label: "Frente", type: "toggle", def: true, group: "arrugas" },
  { key: "z_entrecejo", label: "Entrecejo", type: "toggle", def: true, group: "arrugas" },
  { key: "z_ojos", label: "Patas de gallo", type: "toggle", def: true, group: "arrugas" },
  { key: "z_surcos", label: "Surcos y comisuras", type: "toggle", def: true, group: "arrugas" },
  { key: "z_cuello", label: "Cuello", type: "toggle", def: true, group: "arrugas" }
];
