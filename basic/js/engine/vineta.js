/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · VIÑETA (Premium)
   Oscurece (positivo) o aclara (negativo) los bordes con una caída suave (smootherstep) y tramado: sin anillo visible ni bandas
   en cielos y degradados. El efecto se aplica en luz lineal (se aproxima con un exponente sobre el valor codificado).
   Entradas: pasoVineta(data, w, h, ajustes) con ajustes.vineta de −100 a 100. Salidas: nada (modifica data).
   Límites: sin DOM; elipse con la proporción de la foto; el efecto empieza a un 25 % del radio y llega al 100 % en las esquinas; con 100 las esquinas quedan casi negras (≈ −2,3 pasos) y con 50 ya se nota claramente (la fuerza crece más deprisa que el mando).
   ═══════════════════════════════════════════════════════════════ */
const INICIO = 0.25, GAMMA = 1 / 2.2, OSCURO = 0.97, CLARO = 0.85;
const suave = t => t * t * t * (t * (t * 6 - 15) + 10);
const tramado = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return ((h & 255) + ((h >>> 8) & 255)) / 256 - 1; };

export const hayVineta = a => !!a.vineta;

export function pasoVineta(data, w, h, a) {
  const v = (a.vineta || 0) / 100;
  if (!v) return;
  const cx = (w - 1) / 2, cy = (h - 1) / 2, fuerza = Math.abs(v) ** 0.8, oscuro = v > 0;
  /* La ganancia sólo depende de k (0..1): se tabula (4096 pasos, imperceptible) en vez de elevar a GAMMA en cada píxel. */
  const N = 4096, tabla = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) tabla[i] = oscuro ? (1 - OSCURO * i / N * fuerza) ** GAMMA : i / N * fuerza * CLARO;
  for (let y = 0, px = 0; y < h; y++) {
    const dy = (y - cy) / cy, dy2 = dy * dy;
    for (let x = 0; x < w; x++, px++) {
      const dx = (x - cx) / cx, r = Math.sqrt(dx * dx + dy2) / Math.SQRT2;          // 0 en el centro, 1 en las esquinas
      if (r <= INICIO) continue;
      const g = tabla[Math.round(suave(Math.min(1, (r - INICIO) / (1 - INICIO))) * N)], i = px * 4, d = tramado(px) * 0.5;
      if (oscuro) for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * g + d);
      else for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (255 - data[i + c]) * g + d);
    }
  }
}
