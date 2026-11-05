/* ═══════════════════════════════════════════════════════════════
   COLOCAR TEXTO EN LA ZONA LIBRE · MANDOS
   Esquema de js/ui/kit/params-panel.js (4 mandos, interfaz simple). Entradas: ninguna. Salida: PARAMS.
   ══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "texto", label: "Texto", type: "text", def: "Realify", max: 80 },
  { key: "tam", label: "Tamaño", type: "range", min: 2, max: 30, step: 1, def: 8, unit: " %" },
  { key: "color", label: "Color", type: "select", def: "auto", options: [["auto", "Automático"], ["claro", "Claro"], ["oscuro", "Oscuro"]] },
  { key: "opacidad", label: "Opacidad", type: "range", min: 10, max: 100, step: 1, def: 90, unit: " %" }
];
