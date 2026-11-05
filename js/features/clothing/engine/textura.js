/* ═══════════════════════════════════════════════════════════════
   ROPA · TEXTURA DEL TEJIDO (puro, sin DOM)
   La trama es la parte de alta frecuencia de la luminancia. «Trama» la realza o la apaga; «Rellenar» detecta las zonas que quedaron
   demasiado lisas (tras planchar o suavizar) y les presta la trama de otro punto de la MISMA prenda (desplazada), con la energía de las
   zonas bien texturadas, para que no parezcan plástico. Entradas: planos (se modifican), máscara 0-1, valores { trama -100..100, rellenar 0-100 }.
   Salida: nada.
   ═══════════════════════════════════════════════════════════════ */
import { gaussMasked, smoothstep } from "../../portrait/shared/blur.js";
import { tamano } from "../shared/mascara.js";

export const hayTextura = v => !!((v.trama || 0) || (v.rellenar || 0));

export function texturar(p, mask, v){
  const { W, H, R, G, B, Y } = p, n = W * H, F = tamano(mask), g = (v.trama || 0) / 100, rel = (v.rellenar || 0) / 100;
  const ly = new Float32Array(n); for(let i = 0; i < n; i++) ly[i] = Math.log(Math.max(Y[i], 1e-4));
  const mid = gaussMasked(ly, mask, W, H, Math.max(0.9, F * 0.006)), res = new Float32Array(n), e2 = new Float32Array(n);
  for(let i = 0; i < n; i++){ res[i] = (ly[i] - mid[i]) * (mask[i] > 0 ? 1 : 0); e2[i] = res[i] * res[i]; }
  const en = gaussMasked(e2, mask, W, H, Math.max(2, F * 0.03));
  /* energía objetivo: media de la mitad más texturada de la prenda */
  const lista = []; for(let i = 0; i < n; i += 3) if(mask[i] > 0.5) lista.push(en[i]); lista.sort((a, b) => a - b);
  let objetivo = 0; const mitad = lista.length >> 1; for(let i = mitad; i < lista.length; i++) objetivo += lista[i]; objetivo /= Math.max(1, lista.length - mitad);
  const dx = Math.max(3, Math.round(F * 0.25)), dy = Math.max(2, Math.round(F * 0.17)), offs = [[dx, dy], [-dx, dy], [dx, -dy], [-dx, -dy], [dx * 2, 0], [-dx * 2, 0]];
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const i = y * W + x, m = mask[i]; if(m <= 0.001) continue;
    let d = g > 0 ? g * 1.5 * res[i] : g * res[i];
    if(rel > 0 && objetivo > 1e-9){
      const w = (1 - smoothstep(0.25 * objetivo, 0.8 * objetivo, en[i])) * rel;
      if(w > 0.01) for(const [ox, oy] of offs){
        const xx = x + ox, yy = y + oy; if(xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if(mask[j] < 0.9) continue;
        const k = Math.min(2, Math.sqrt(objetivo / Math.max(en[j], 1e-9))); d += w * res[j] * k; break;
      }
    }
    const f = Math.min(1.6, Math.max(0.6, Math.exp(d))), k = 1 + m * (f - 1);
    R[i] *= k; G[i] *= k; B[i] *= k;
  }
  for(let i = 0; i < n; i++) Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
}
