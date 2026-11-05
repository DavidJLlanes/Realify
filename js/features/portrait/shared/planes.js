/* ═══════════════════════════════════════════════════════════════
   RETRATO · PLANOS EN LUZ LINEAL (puro, sin DOM)
   Pasa un recorte RGBA de 8 bits a tres planos Float32 en luz lineal (modo Premium: coma flotante) más la luminancia, y de vuelta con
   tramado para no crear bandas. Los motores de piel se pasan un «ctx» con estos planos y las zonas; cada etapa lo modifica.
   Entradas: RGBA (Uint8ClampedArray), ancho, alto. Salidas: toPlanes() = { W, H, R, G, B, Y }, fromPlanes(planes, rgba).
   ═══════════════════════════════════════════════════════════════ */
import { DEC, enc } from "../../ai-kit/float.js";
import { ditherAt } from "../../../core/util/math.js";

export function toPlanes(rgba, W, H){
  const n = W * H, R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), Y = new Float32Array(n);
  for(let i = 0; i < n; i++){ R[i] = DEC[rgba[i * 4]]; G[i] = DEC[rgba[i * 4 + 1]]; B[i] = DEC[rgba[i * 4 + 2]]; }
  const p = { W, H, R, G, B, Y }; luma(p); return p;
}

export function luma(p){ for(let i = 0; i < p.Y.length; i++) p.Y[i] = 0.2126 * p.R[i] + 0.7152 * p.G[i] + 0.0722 * p.B[i]; return p; }

/** Escribe los planos en `rgba` (el alfa no se toca) con un tramado determinista. */
export function fromPlanes(p, rgba){
  const { W, H } = p;
  for(let y = 0, i = 0; y < H; y++) for(let x = 0; x < W; x++, i++){
    rgba[i * 4] = enc(p.R[i]) + ditherAt(x, y, 0);
    rgba[i * 4 + 1] = enc(p.G[i]) + ditherAt(x, y, 1);
    rgba[i * 4 + 2] = enc(p.B[i]) + ditherAt(x, y, 2);
  }
}

export const sqrtPlane = Y => { const o = new Float32Array(Y.length); for(let i = 0; i < o.length; i++) o[i] = Math.sqrt(Math.max(0, Y[i])); return o; };
export const channels = p => [p.R, p.G, p.B];
