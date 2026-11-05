/* ═══════════════════════════════════════════════════════════════
   ETIQUETAS AUTOMÁTICAS · MANDOS
   Esquema de js/ui/kit/params-panel.js (2 mandos). Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */
export const PARAMS = [
  { key: "plantilla", label: "Nombre del archivo", type: "text", def: "{fecha}_{etiqueta}_{color}", max: 80 },
  { key: "renombrar", label: "Poner ese nombre al documento", type: "toggle", def: true }
];
