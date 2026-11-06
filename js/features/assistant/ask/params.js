/* ═══════════════════════════════════════════════════════════════
   ASISTENTE · MANDOS
   Esquema de js/ui/kit/params-panel.js (texto y motor). Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */
export const PARAMS = [
  { key: "pedido", label: "¿Qué quieres hacer con la foto?", type: "text", def: "más cálida y con grano de película", max: 160 },
  { key: "motor", label: "Motor", type: "select", def: "reglas", options: [["reglas", "Reglas (rápido, sin descarga)"], ["qwen", "IA · Qwen 1,5B (1,2 GB, WebGPU)"]] }
];
