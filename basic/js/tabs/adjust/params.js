/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · AJUSTES (tabla)
   Los 15 ajustes de la pestaña Ajustar (más Auto, que los rellena). Cada uno es sólo datos: añadir o quitar uno es una línea; el
   motor que lo aplica está en engine/ y se identifica por el mismo `id`.
   Entradas: ninguna. Salidas: AJUSTES = [{ id, texto, icono, min, max, def }].
   Límites: los valores son enteros; 0 = sin efecto (nitidez y ruido van de 0 a 100, el resto de −100 a 100).
   ═══════════════════════════════════════════════════════════════ */
const A = (id, texto, icono, min = -100, max = 100) => ({ id, texto, icono, min, max, def: 0 });

export const AJUSTES = [
  A("exposicion", "Exposición", "sun-medium"),
  A("brillantez", "Brillantez", "sparkle"),
  A("luces", "Luces altas", "sunset"),
  A("sombras", "Sombras", "cloud"),
  A("contraste", "Contraste", "contrast"),
  A("brillo", "Brillo", "lightbulb"),
  A("negro", "Punto negro", "circle-dot"),
  A("saturacion", "Saturación", "droplets"),
  A("intensidad", "Intensidad", "flame"),
  A("temperatura", "Temperatura", "thermometer"),
  A("tinte", "Tinte", "pipette"),
  A("nitidez", "Nitidez", "focus", 0, 100),
  A("definicion", "Definición", "scan"),
  A("ruido", "Reducir ruido", "grid-2x2", 0, 100),
  A("vineta", "Viñeta", "circle-dashed"),
];
