/* ═══════════════════════════════════════════════════════════════
   EFECTO ESTILOS DE CÁMARA · MANIFIESTO
   Las cámaras del catálogo de plugins/cameras (película, VHS, cámara desechable, CCD…) como estilo de todo el clip. La lista de estilos se rellena al cargar (cargarOpciones).
   Entradas: ninguna. Salida: objeto con `opciones()` (promesa de [id, nombre]) y mandos.
   ═══════════════════════════════════════════════════════════════ */
export default { id: "camaras", version: 1, nombre: "Estilo de cámara", premium: true, tipo: "fotograma",
  params: [
    { key: "estilo", label: "Cámara", type: "select", def: "vhs", options: [["vhs", "VHS"]], opciones: async () => { const { PRESETS } = await (await import("../../bridge/efectos.js")).cargarCamaras(); return PRESETS.map(p => [p.id, p.name]); } },
    { key: "intensidad", label: "Intensidad", type: "range", min: 0, max: 100, step: 1, def: 100, fmt: v => v + " %" }
  ],
  carga: () => import("./efecto.js") };
