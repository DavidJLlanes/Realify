/* ═══════════════════════════════════════════════════════════════
   ESTILO DESDE UNA FOTO · MANDOS
   Esquema de js/ui/kit/params-panel.js (4 mandos). Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "modo", label: "Qué hacer", type: "select", def: "transferir", options: [["transferir", "Aplicar el estilo"], ["sugerir", "Sugerir ajustes"]] },
  { key: "fuerza", label: "Intensidad", type: "range", min: 0, max: 100, step: 1, def: 80, unit: " %" },
  { key: "tono", label: "Tono (luces y sombras)", type: "range", min: 0, max: 100, step: 1, def: 100, unit: " %" },
  { key: "color", label: "Color", type: "range", min: 0, max: 100, step: 1, def: 100, unit: " %" }
];
