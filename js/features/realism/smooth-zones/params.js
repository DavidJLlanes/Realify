/* ═══════════════════════════════════════════════════════════════
   ZONAS LISAS · MANDOS
   Esquema de js/ui/kit/params-panel.js (3 mandos, interfaz simple). Entradas: ninguna. Salida: PARAMS.
   ══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "fuerza", label: "Cantidad de grano", type: "range", min: 0, max: 100, step: 1, def: 60, unit: " %" },
  { key: "tam", label: "Tamaño del grano", type: "range", min: 0, max: 100, step: 1, def: 30, unit: " %" },
  { key: "ver", label: "Sólo mostrar las zonas lisas", type: "toggle", def: false }
];
