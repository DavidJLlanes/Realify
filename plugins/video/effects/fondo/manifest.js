/* ═══════════════════════════════════════════════════════════════
   EFECTO FONDO · MANIFIESTO
   Recorta a la persona con IA en cada fotograma y cambia lo de detrás: desenfocarlo, oscurecerlo, pasarlo a blanco y negro o ponerle un color. El modelo (MODNet, 26 MB) se descarga la
   primera vez y avisa. Entradas: ninguna. Salida: objeto.
   ═══════════════════════════════════════════════════════════════ */
export default { id: "fondo", version: 1, nombre: "Fondo con IA", premium: true, tipo: "fotograma",
  params: [
    { key: "modo", label: "Fondo", type: "select", def: "desenfoque", options: [["desenfoque", "Desenfocado"], ["oscuro", "Oscurecido"], ["gris", "Blanco y negro"], ["color", "Color liso"]] },
    { key: "fuerza", label: "Fuerza", type: "range", min: 0, max: 100, step: 1, def: 70, fmt: v => v + " %" },
    { key: "color", label: "Color", type: "color", def: "#1b8a5a" },
    { key: "estable", label: "Estabilidad del borde", type: "range", min: 0, max: 90, step: 1, def: 55, fmt: v => v + " %" }
  ],
  carga: () => import("./efecto.js") };
