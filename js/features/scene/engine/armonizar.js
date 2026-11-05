/* ═══════════════════════════════════════════════════════════════
   ESCENA · UNIFICAR ILUMINACIÓN (puro, sin DOM)
   Acerca el color y la luz del sujeto a los del fondo que lo rodea. El fondo se mide con un promedio ponderado SOLO por los píxeles de fondo
   (sin arrastrar el color del sujeto), en OKLab: el tono medio del sujeto se desplaza hacia el del fondo (a, b) y su luminosidad se acerca a la
   del fondo, con límites para que una piel no se vuelva verde. Entradas: planos (se modifican), máscara del sujeto 0-1, valores { color 0-100,
   luz 0-100 }. Salida: nada.
   ═══════════════════════════════════════════════════════════════ */
import { gaussMasked, gauss } from "../../portrait/shared/blur.js";
import { oklab, linear } from "../../ai-kit/oklab.js";

export const hayArmonia = v => (v.color || 0) > 0 || (v.luz || 0) > 0;

export function armonizar(p, sujeto, v){
  const { W, H, R, G, B, Y } = p, n = W * H, kc = Math.min(100, Math.max(0, v.color || 0)) / 100, kl = Math.min(100, Math.max(0, v.luz || 0)) / 100, lab = new Float32Array(3), rgb = new Float32Array(3);
  const L = new Float32Array(n), A = new Float32Array(n), Bb = new Float32Array(n), fondo = new Float32Array(n);
  let sL = 0, sa = 0, sb = 0, c = 0;
  for(let i = 0; i < n; i++){ oklab(R[i], G[i], B[i], lab); L[i] = lab[0]; A[i] = lab[1]; Bb[i] = lab[2]; fondo[i] = 1 - sujeto[i]; if(sujeto[i] > 0.5){ sL += lab[0]; sa += lab[1]; sb += lab[2]; c++; } }
  if(c < 50) return;
  sL /= c; sa /= c; sb /= c;
  const s = Math.max(6, Math.sqrt(n) * 0.12), fL = gaussMasked(L, fondo, W, H, s), fa = gaussMasked(A, fondo, W, H, s), fb = gaussMasked(Bb, fondo, W, H, s), m = gauss(sujeto, W, H, 1);
  for(let i = 0; i < n; i++){
    const w = m[i]; if(w <= 0.01) continue;
    const da = Math.max(-0.05, Math.min(0.05, (fa[i] - sa) * 0.6)) * kc, db = Math.max(-0.05, Math.min(0.05, (fb[i] - sb) * 0.6)) * kc;
    const gl = 1 + Math.max(-0.25, Math.min(0.25, (fL[i] / Math.max(sL, 0.05) - 1) * 0.5)) * kl;
    linear(Math.min(1, L[i] * gl), A[i] + da * w, Bb[i] + db * w, rgb);
    R[i] += w * (Math.min(1, Math.max(0, rgb[0])) - R[i]); G[i] += w * (Math.min(1, Math.max(0, rgb[1])) - G[i]); B[i] += w * (Math.min(1, Math.max(0, rgb[2])) - B[i]);
  }
  for(let i = 0; i < n; i++) Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
}
