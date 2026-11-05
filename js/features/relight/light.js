/* ═══════════════════════════════════════════════════════════════
   RELIGHT · LUZ DIRECCIONAL (puro, sin DOM)
   Luz de Lambert a partir de las normales, con la dirección dada por el acimut (−90° izquierda … +90° derecha, 0 = de frente) y la
   altura (0° a la altura de la cara … 90° desde arriba), y suavizada para que no se vean los poros del mapa de normales.
   Entradas: normales, ancho, alto, acimut, altura, sigma de suavizado en píxeles. Salida: Float32Array 0-1 (cuánta luz recibe cada punto).
   ═══════════════════════════════════════════════════════════════ */
import { gauss } from "../portrait/shared/blur.js";

export function lambert({ nx, ny, nz }, W, H, azimut, altura, sigma = 0){
  const a = azimut * Math.PI / 180, e = altura * Math.PI / 180;
  const lx = Math.sin(a) * Math.cos(e), ly = -Math.sin(e), lz = Math.cos(a) * Math.cos(e), out = new Float32Array(W * H);
  for(let i = 0; i < out.length; i++){ const v = nx[i] * lx + ny[i] * ly + nz[i] * lz; out[i] = v > 0 ? v : 0; }
  return sigma > 0.8 ? gauss(out, W, H, sigma) : out;
}
