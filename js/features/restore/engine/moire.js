/* ═══════════════════════════════════════════════════════════════
   RESTAURAR · MOIRÉ Y BANDAS (puro, sin DOM)
   El moiré y las bandas son patrones periódicos: en el espectro de un bloque aparecen como picos aislados muy por encima de lo que los rodea.
   Se divide la imagen en bloques solapados (Hann), se buscan los picos (mayores que `k` veces la mediana local del espectro y lejos de las
   frecuencias bajas, que son la escena) y se les aplica una muesca gaussiana. Se trabaja en luminancia y en dos planos de color; el moiré
   suele ser sobre todo de color, así que el color se limpia más fuerte. Entradas: planos (se modifican), valores { cantidad 0-100, soloColor }.
   Salida: cuántos picos se atenuaron.
   ═══════════════════════════════════════════════════════════════ */
import { porBloques } from "./fft2.js";

const N = 128;
export const hayMoire = v => (v.cantidad || 0) > 0;

export function quitarMoire(p, v){
  const { W, H, R, G, B, Y } = p, c = Math.min(100, Math.max(0, v.cantidad || 0)) / 100, n = W * H;
  if(c <= 0) return 0;
  const cr = new Float32Array(n), cb = new Float32Array(n); for(let i = 0; i < n; i++){ cr[i] = R[i] - Y[i]; cb[i] = B[i] - Y[i]; }
  const k = 5 - 2.5 * c, mag = new Float64Array(N * N), vec = new Float64Array(24); let picos = 0;
  const muesca = (re, im, nn, canal) => {
    for(let i = 0; i < nn * nn; i++) mag[i] = Math.hypot(re[i], im[i]);
    const fuerza = canal === 0 ? (v.soloColor ? 0 : c) : Math.min(1, c * 1.15);
    if(fuerza <= 0) return;
    const marca = [];
    for(let fy = 0; fy < nn; fy++) for(let fx = 0; fx < nn; fx++){
      const ky = fy > nn / 2 ? fy - nn : fy, kx = fx > nn / 2 ? fx - nn : fx; if(Math.hypot(kx, ky) < 7) continue;
      const m = mag[fy * nn + fx]; if(m < 1e-6) continue;
      // Mediana de los 24 vecinos (cada 2 bins, radio 4) con un vector fijo y ordenación por inserción: sin reservar memoria por bin (era el cuello de botella)
      let q = 0;
      for(let dy = -4; dy <= 4; dy += 2) for(let dx = -4; dx <= 4; dx += 2){
        if(!dx && !dy) continue;
        const x = mag[((fy + dy + nn) % nn) * nn + ((fx + dx + nn) % nn)]; let j = q++;
        while(j > 0 && vec[j - 1] > x){ vec[j] = vec[j - 1]; j--; }
        vec[j] = x;
      }
      const med = vec[12];
      if(m > k * med && m > 0.35 * Math.sqrt(re.length) * 0 + 1e-3 * nn * nn * 0.5) marca.push([fx, fy]);
    }
    for(const [fx, fy] of marca){
      picos++;
      for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++){
        const x = (fx + dx + nn) % nn, y = (fy + dy + nn) % nn, g = 1 - fuerza * Math.exp(-(dx * dx + dy * dy) / 1.6); re[y * nn + x] *= g; im[y * nn + x] *= g;
      }
    }
  };
  const [y2, r2, b2] = porBloques([Y, cr, cb], W, H, N, muesca);
  for(let i = 0; i < n; i++){
    const yy = v.soloColor ? Y[i] : Math.max(0, y2[i]), rr = yy + r2[i], bb = yy + b2[i];
    R[i] = Math.min(1, Math.max(0, rr)); B[i] = Math.min(1, Math.max(0, bb)); G[i] = Math.min(1, Math.max(0, (yy - 0.2126 * R[i] - 0.0722 * B[i]) / 0.7152));
  }
  for(let i = 0; i < n; i++) Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
  return picos;
}
