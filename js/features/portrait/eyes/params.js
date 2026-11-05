/* ═══════════════════════════════════════════════════════════════
   OJOS · PARÁMETROS
   Mandos del grupo «Ojos» del editor de cara (esquema de js/ui/kit/params-panel.js). `fx`: el mando activa el efecto; `neutro`: su valor sin
   efecto. Al abrir una función, sus mandos `fx` empiezan en `def` y los de las demás en su neutro. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "ojos_luz", label: "Luz del iris", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %", group: "ojos", fx: true },
  { key: "ojos_color", label: "Color del iris", type: "select", options: [["natural", "Natural"], ["marron", "Marrón"], ["avellana", "Avellana"], ["verde", "Verde"], ["azul", "Azul"], ["gris", "Gris"]], def: "natural", group: "ojos", fx: true, neutro: "natural" },
  { key: "ojos_color_int", label: "Cuánto color", type: "range", min: 0, max: 100, step: 1, def: 70, unit: " %", group: "ojos" },
  { key: "ojos_blanco", label: "Blanco del ojo", type: "range", min: 0, max: 100, step: 1, def: 30, unit: " %", group: "ojos", fx: true }
];
