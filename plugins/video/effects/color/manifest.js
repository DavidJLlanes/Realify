/* ═══════════════════════════════════════════════════════════════
   EFECTO COLOR · MANIFIESTO
   Datos del efecto: los mandos salen de aquí (el editor los pinta sin conocer el efecto). Entradas: ninguna. Salida: objeto por defecto.
   ═══════════════════════════════════════════════════════════════ */
export default { id: "color", version: 1, nombre: "Color", premium: true, tipo: "fotograma",
  params: [
    { key: "exposicion", label: "Exposición", type: "range", min: -2, max: 2, step: 0.05, def: 0, fmt: v => (v > 0 ? "+" : "") + v.toFixed(2) + " EV" },
    { key: "contraste", label: "Contraste", type: "range", min: -100, max: 100, step: 1, def: 0 },
    { key: "saturacion", label: "Saturación", type: "range", min: -100, max: 100, step: 1, def: 0 },
    { key: "temperatura", label: "Temperatura", type: "range", min: -100, max: 100, step: 1, def: 0 },
    { key: "tinte", label: "Tinte", type: "range", min: -100, max: 100, step: 1, def: 0 }
  ],
  carga: () => import("./efecto.js") };
