/* ═══════════════════════════════════════════════════════════════
   TEXTO ALTERNATIVO · MANDOS
   Esquema de js/ui/kit/params-panel.js (2 mandos). Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */
export const PARAMS = [
  { key: "largo", label: "Longitud", type: "seg", def: "corto", options: [["corto", "Corto (alt)"], ["largo", "Largo"]] },
  { key: "motor", label: "Motor", type: "select", def: "plantillas", options: [["plantillas", "Plantillas (rápido)"], ["florence", "Florence-2 · IA (275 MB)"]] }
];
