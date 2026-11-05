/* ═══════════════════════════════════════════════════════════════
   REALISMO · ZONAS DEMASIADO LISAS (puro, sin DOM)
   Mide la energía de detalle fino de la luminancia (la foto menos su desenfoque, al cuadrado y relativa a la señal, como el ruido de disparo)
   y la promedia en un entorno ancho: donde queda por debajo de lo que daría un sensor real, la zona es «demasiado lisa» (cielos, pieles
   y fondos de imágenes generadas). Quemados y negros puros no cuentan (ahí un sensor tampoco da ruido).
   Entradas: planos en luz lineal { W, H, Y }. Salida: { liso: Float32Array 0-1, cobertura: fracción de la foto lisa }.
   ═══════════════════════════════════════════════════════════════ */
import { gauss, smoothstep } from "../../portrait/shared/blur.js";

export const UMBRAL = { E0: 0.006, E1: 0.02 };

export function mapaLiso(p){
  const { W, H, Y } = p, n = W * H, base = gauss(Y, W, H, 1.6), v = new Float32Array(n);
  for(let i = 0; i < n; i++){ const d = Y[i] - base[i]; v[i] = d * d / (Y[i] + 0.02); }
  const e = gauss(v, W, H, Math.max(4, Math.min(W, H) / 120)), liso = new Float32Array(n);
  let suma = 0;
  for(let i = 0; i < n; i++){
    const util = Y[i] > 0.004 && Y[i] < 0.93 ? 1 : 0;
    liso[i] = (1 - smoothstep(UMBRAL.E0, UMBRAL.E1, Math.sqrt(e[i]))) * util;
    suma += liso[i];
  }
  const f = gauss(liso, W, H, Math.max(2, Math.min(W, H) / 300));
  return { liso: f, cobertura: suma / n };
}
