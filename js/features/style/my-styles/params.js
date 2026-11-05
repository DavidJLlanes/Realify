/* ═══════════════════════════════════════════════════════════════
   MIS ESTILOS · MANDOS
   Esquema de js/ui/kit/params-panel.js (4 mandos). La lista de estilos guardados se rellena al abrir. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */

export const PARAMS = [
  { key: "accion", label: "Qué hacer", type: "select", def: "aplicar", options: [["aplicar", "Aplicar a esta foto"], ["todas", "Aplicar a todas las fotos abiertas"], ["guardar", "Guardar una referencia como estilo"], ["importar", "Importar de un archivo"], ["exportar", "Guardar en un archivo"], ["borrar", "Borrar"]] },
  { key: "estilo", label: "Estilo", type: "select", def: "", options: [["", "(ninguno guardado)"]] },
  { key: "nombre", label: "Nombre (al guardar)", type: "text", def: "Mi estilo", max: 60 },
  { key: "fuerza", label: "Intensidad", type: "range", min: 0, max: 100, step: 1, def: 80, unit: " %" }
];
