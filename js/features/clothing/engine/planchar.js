/* ═══════════════════════════════════════════════════════════════
   ROPA · PLANCHAR ARRUGAS (puro, sin DOM)
   Separa en la luminancia (log, luz lineal) tres capas: forma general de la prenda (baja frecuencia: se conserva), sombreado de los pliegues
   (media frecuencia: se aplana según la fuerza) y trama del tejido (alta frecuencia: se conserva o se reinyecta). Donde hay un cambio de
   COLOR (rayas, estampados, costuras) el sombreado no se toca, porque ahí el salto de luz es dibujo y no arruga. El cambio se aplica como
   un factor sobre R, G y B, así el color de la tela no se desplaza. Entradas: planos { W,H,R,G,B,Y } (se modifican), máscara 0-1,
   valores { arrugas 0-100, tamano 0-100, conservaTrama 0-100, conservar 0-100 }. Salida: nada (modifica los planos).
   ═══════════════════════════════════════════════════════════════ */
import { gauss, gaussMasked, smoothstep } from "../../portrait/shared/blur.js";
import { tamano } from "../shared/mascara.js";
import { clasesColor } from "./clases.js";

export const hayPlanchado = v => (v.arrugas || 0) > 0 || (v.conservaTrama != null && v.conservaTrama < 100);

/** Bordes de color (no de luz): 0 en tela lisa, 1 en una raya o un estampado. */
export function bordesColor(p, sigma){
  const { W, H, R, B, Y } = p, n = W * H, rg = new Float32Array(n), bg = new Float32Array(n);
  for(let i = 0; i < n; i++){ const y = Y[i] + 1e-4; rg[i] = Math.log((R[i] + 1e-4) / y); bg[i] = Math.log((B[i] + 1e-4) / y); }
  const a = gauss(rg, W, H, 1), b = gauss(bg, W, H, 1), e = new Float32Array(n);
  for(let y = 1; y < H - 1; y++) for(let x = 1; x < W - 1; x++){
    const i = y * W + x, gx = Math.hypot(a[i + 1] - a[i - 1], b[i + 1] - b[i - 1]), gy = Math.hypot(a[i + W] - a[i - W], b[i + W] - b[i - W]);
    e[i] = smoothstep(0.06, 0.2, Math.hypot(gx, gy) / 2);
  }
  return gauss(e, W, H, Math.max(1, sigma));
}

export function planchar(p, mask, v){
  const { W, H, R, G, B, Y } = p, n = W * H, F = tamano(mask), arr = Math.min(100, Math.max(0, v.arrugas || 0)) / 100;
  const trama = v.conservaTrama == null ? 1 : Math.max(0, v.conservaTrama) / 100, cons = Math.min(100, Math.max(0, v.conservar == null ? 30 : v.conservar)) / 100;
  if(arr <= 0 && trama >= 1) return;
  const ly = new Float32Array(n); for(let i = 0; i < n; i++) ly[i] = Math.log(Math.max(Y[i], 1e-4));
  const sm = Math.max(0.9, F * 0.006), sl = F * (0.08 + 0.4 * (v.tamano == null ? 40 : v.tamano) / 100);
  const cls = clasesColor(p, mask), mid = new Float32Array(n), low = new Float32Array(n), prot0 = null;
  for(const w of cls){ const a = gaussMasked(ly, w, W, H, sm), b = gaussMasked(ly, w, W, H, sl); for(let i = 0; i < n; i++) if(w[i] > 0.5){ mid[i] = a[i]; low[i] = b[i]; } }
  const prot = arr > 0 ? bordesColor(p, sm * 2) : null;
  for(let i = 0; i < n; i++){
    const m = mask[i]; if(m <= 0.001) continue;
    const wr = mid[i] - low[i], tex = ly[i] - mid[i];
    const a = arr * (1 - cons * 0.5) * (1 - (prot ? prot[i] : 0));
    const nuevo = ly[i] - a * wr - (1 - trama) * tex;
    const f = Math.min(2, Math.max(0.5, Math.exp(nuevo - ly[i]))), k = 1 + m * (f - 1);
    R[i] *= k; G[i] *= k; B[i] *= k;
  }
  for(let i = 0; i < n; i++) Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
}
