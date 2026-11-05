/* ═══════════════════════════════════════════════════════════════
   PACKS DE CÁMARA · MANDOS
   Esquema de js/ui/kit/params-panel.js (2 mandos). La lista de estilos se rellena al abrir, con las cámaras de plugins/cameras. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "estilo", label: "Estilo", type: "select", def: "", options: [["", "—"]] },
  { key: "intensidad", label: "Intensidad", type: "range", min: 0, max: 100, step: 1, def: 100, unit: " %" }
];
