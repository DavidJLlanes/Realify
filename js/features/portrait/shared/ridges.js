/* ═══════════════════════════════════════════════════════════════
   RETRATO · DETECTOR DE SURCOS (puro, sin DOM)
   Filtro de crestas tipo Frangi sobre la luminancia: marca las líneas OSCURAS y finas (arrugas, surcos) y no los bordes ni las manchas.
   Hessiano por diferencias finitas sobre la luminancia suavizada a dos escalas; valor 0-1, normalizado por la escala.
   Entradas: plano de luminancia perceptual (raíz de la lineal), ancho, alto, escalas en píxeles. Salida: Float32Array 0-1.
   ═══════════════════════════════════════════════════════════════ */
import { gauss } from "./blur.js";

export function ridgeStrength(P, w, h, sigmas, contraste = 0.012, beta = 0.5){
  const out = new Float32Array(w * h);
  for(const s of sigmas){
    const g = gauss(P, w, h, s), k = s * s;
    for(let y = 1; y < h - 1; y++) for(let x = 1; x < w - 1; x++){
      const i = y * w + x, c = g[i];
      const xx = (g[i - 1] - 2 * c + g[i + 1]) * k, yy = (g[i - w] - 2 * c + g[i + w]) * k;
      const xy = (g[i + w + 1] - g[i + w - 1] - g[i - w + 1] + g[i - w - 1]) * 0.25 * k;
      const m = (xx + yy) / 2, d = Math.sqrt(((xx - yy) / 2) ** 2 + xy * xy);
      const l1 = m + d, l2 = m - d;                     // l1 ≥ l2; valle oscuro → curvatura grande y positiva en un sentido
      if(l1 <= 0) continue;
      const rb = Math.abs(l2) / l1, S2 = l1 * l1 + l2 * l2;
      const v = Math.exp(-(rb * rb) / (2 * beta * beta)) * (1 - Math.exp(-S2 / (2 * contraste * contraste)));
      if(v > out[i]) out[i] = v;
    }
  }
  return out;
}
