/* ═══════════════════════════════════════════════════════════════
   basic · vignette-engine (motor de píxeles, sin DOM)
   Viñeteado de calidad Premium 👑, COMPARTIDO por Realify Pro (js/filters/library/basic/vignette.js) y Realify Basic
   (basic/js/engine/pipeline.js): un solo código para los dos.
   Caída suave (smootherstep, sin anillo visible), tabla de ganancias y tramado (sin bandas en cielos y degradados).
   Tres modos:
     · "oscuro"  — multiplica en luz lineal (se aproxima con un exponente sobre el valor codificado): oscurece sin ensuciar el color.
     · "lineal"  — mezcla hacia un color en luz lineal (blanco o color libre de Pro): sin halos oscuros en la transición.
     · "mezcla"  — mezcla hacia un color sobre el valor codificado (el aclarado de Basic).
   Entradas: vineteaPixeles(data, w, h, { modo, alfa 0..1, color [r,g,b], inicio 0..1, fin 0..1, redondez 0..1 }).
   Salidas: nada (modifica data RGBA en su sitio; no toca el canal alfa ni los píxeles transparentes).
   Límites: la elipse sale de la proporción de la foto (redondez 0) o es un círculo (redondez 1); las esquinas valen siempre 1.
   ═══════════════════════════════════════════════════════════════ */
const GAMMA = 1 / 2.2, N = 4096;
const suave = t => t * t * t * (t * (t * 6 - 15) + 10);
const tramado = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return ((h & 255) + ((h >>> 8) & 255)) / 256 - 1; };

/** Semiejes de la forma (en píxeles) donde el radio vale 1: círculo (redondez 1) ↔ elipse de la foto (0). */
function ejes(w, h, redondez) {
  const cx = (w - 1) / 2 || 0.5, cy = (h - 1) / 2 || 0.5, t = Math.max(0, Math.min(1, redondez)), esquina = Math.hypot(cx, cy);
  const ax = cx * Math.SQRT2 * (1 - t) + esquina * t, ay = cy * Math.SQRT2 * (1 - t) + esquina * t, rmax = Math.hypot(cx / ax, cy / ay) || 1;
  return { cx, cy, sx: ax * rmax, sy: ay * rmax };
}

export function vineteaPixeles(data, w, h, { modo = "oscuro", alfa = 1, color = [0, 0, 0], inicio = 0.25, fin = 1, redondez = 0 } = {}) {
  if (alfa <= 0) return;
  const { cx, cy, sx, sy } = ejes(w, h, redondez), ancho = Math.max(0.01, fin - inicio);
  /* Ganancia (modo oscuro) o peso de la mezcla (otros): sólo depende de la posición en la rampa (0..1), se tabula una vez. */
  const tabla = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) tabla[i] = modo === "oscuro" ? (1 - alfa * i / N) ** GAMMA : alfa * i / N;
  /* Luz lineal para "lineal": a lineal con tabla de 256, de vuelta con tabla de 4096 (el exponente por píxel sería lento). */
  let aLin = null, deLin = null, colLin = null;
  if (modo === "lineal") {
    aLin = new Float32Array(256); for (let i = 0; i < 256; i++) aLin[i] = (i / 255) ** 2.2;
    deLin = new Uint8ClampedArray(N + 1); for (let i = 0; i <= N; i++) deLin[i] = Math.round(255 * (i / N) ** GAMMA);
    colLin = color.map(c => aLin[Math.max(0, Math.min(255, Math.round(c)))]);
  }
  for (let y = 0, px = 0; y < h; y++) {
    const dy = (y - cy) / sy, dy2 = dy * dy;
    for (let x = 0; x < w; x++, px++) {
      const dx = (x - cx) / sx, r = Math.sqrt(dx * dx + dy2);
      if (r <= inicio) continue;
      const i = px * 4;
      if (data[i + 3] === 0) continue;
      const k = tabla[Math.round(suave(Math.min(1, (r - inicio) / ancho)) * N)], d = tramado(px) * 0.5;
      if (modo === "oscuro") for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * k + d);
      else if (modo === "lineal") for (let c = 0; c < 3; c++) { const l = aLin[data[i + c]]; data[i + c] = deLin[Math.round((l + (colLin[c] - l) * k) * N)] + d; }
      else for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (color[c] - data[i + c]) * k + d);
    }
  }
}
