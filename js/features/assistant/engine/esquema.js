/* ═══════════════════════════════════════════════════════════════
   ASISTENTE · ESQUEMA DE HERRAMIENTAS (motor puro, sin DOM)
   La lista cerrada de lo que el asistente puede hacer, con sus mandos y rangos: las capas de ajuste clásicas (calidez, brillo y contraste, exposición,
   saturación, blanco y negro), el grano de película y TODAS las funciones de IA con mandos simples, que se generan solas desde sus manifiestos.
   Nada fuera de esta lista se puede ejecutar: lo que proponga el intérprete (o un modelo de lenguaje) se valida contra ella.
   Entradas: manifiestos (js/ui/menu/ia/manifests.js). Salida: Map id → { id, tipo, label, params:[{ key, label, type, min, max, step, def, options }] }.
   ═══════════════════════════════════════════════════════════════ */
const R = (key, label, min, max, def = 0, step = 1) => ({ key, label, type: "range", min, max, step, def });

/** Capas de ajuste y grano: no son funciones de IA, así que no salen de un manifiesto. `tipo` dice cómo se aplican. */
export const CLASICAS = [
  { id: "wb", tipo: "capa", label: "Calidez y tinte", params: [R("temp", "Temperatura", -100, 100), R("tint", "Tinte", -100, 100)] },
  { id: "bc", tipo: "capa", label: "Brillo y contraste", params: [R("brightness", "Brillo", -100, 100), R("contrast", "Contraste", -100, 100)] },
  { id: "exposure", tipo: "capa", label: "Exposición", params: [R("ev", "Exposición (EV)", -3, 3, 0, 0.1)] },
  { id: "hsl", tipo: "capa", label: "Saturación", params: [R("sat", "Saturación", -100, 100)] },
  { id: "gray", tipo: "capa", label: "Blanco y negro", params: [] },
  { id: "grano", tipo: "grano", label: "Grano de película", params: [R("fuerza", "Cantidad", 0, 100, 50), R("tam", "Tamaño", 0, 100, 30)] }
];

const TIPOS = new Set(["range", "toggle", "seg", "select"]), EXCLUIDOS = new Set(["lote", "asistente"]);

export function construirEsquema(manifests = []){
  const e = new Map(CLASICAS.map(t => [t.id, t]));
  for(const m of manifests){
    if(!m || m.ui !== "simple" || EXCLUIDOS.has(m.submenu) || !Array.isArray(m.params) || !m.params.length) continue;
    if(!m.params.every(p => TIPOS.has(p.type))) continue;
    e.set(m.cmd, { id: m.cmd, tipo: "ia", label: m.short || m.label, cmd: m.cmd, params: m.params.map(p => ({ key: p.key, label: p.label, type: p.type, min: p.min, max: p.max, step: p.step || 1, def: p.def, options: typeof p.options === "function" ? null : p.options })) });
  }
  return e;
}
