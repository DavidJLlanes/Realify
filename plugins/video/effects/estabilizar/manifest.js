/* ═══════════════════════════════════════════════════════════════
   EFECTO ESTABILIZAR · MANIFIESTO
   Calma el temblor de la cámara (sólo desplazamientos) y recorta un poco los bordes. Entradas: ninguna. Salida: objeto. Tipo temporal: ve el fotograma anterior.
   ═══════════════════════════════════════════════════════════════ */
export default { id: "estabilizar", version: 1, nombre: "Estabilizar", premium: true, tipo: "temporal", ventana: 1,
  params: [
    { key: "fuerza", label: "Fuerza", type: "range", min: 0, max: 100, step: 1, def: 60, fmt: v => v + " %" },
    { key: "recorte", label: "Recorte de bordes", type: "range", min: 0, max: 20, step: 1, def: 8, fmt: v => v + " %" }
  ],
  carga: () => import("./efecto.js") };
