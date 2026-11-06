/* ═══════════════════════════════════════════════════════════════
   EFECTO SENSOR DE REALIFY · MANIFIESTO
   La cadena de sensor de las fotos (ruido, óptica, croma…) aplicada a cada fotograma. Los presets son los de js/filters/camera; la dosis los mezcla. Entradas: ninguna. Salida: objeto.
   ═══════════════════════════════════════════════════════════════ */
export const PRESETS_VIDEO = ["Preparación de textura · suave", "Preparación de textura · intensa"];
export default { id: "sensor", version: 1, nombre: "Sensor de Realify", premium: true, tipo: "fotograma",
  params: [
    { key: "preset", label: "Receta", type: "select", def: PRESETS_VIDEO[0], options: PRESETS_VIDEO.map(n => [n, n.replace("Preparación de textura · ", "Textura ")]) },
    { key: "dosis", label: "Dosis", type: "range", min: 0, max: 100, step: 1, def: 100, fmt: v => v + " %" }
  ],
  carga: () => import("./efecto.js") };
