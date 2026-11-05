/* ═══════════════════════════════════════════════════════════════
   ESCENA · MEJORAR CIELO (puro, sin DOM)
   Tres pasos sobre los planos en luz lineal y la máscara del cielo: (1) «Rellenar»: un cielo apagado o gris recibe un degradado azul
   (más oscuro arriba, claro en el horizonte) que conserva el detalle de las nubes; (2) «Realce»: contraste y saturación del cielo en OKLab;
   (3) «Primer plano»: ajuste de luz de lo que NO es cielo, para que la foto no quede con un cielo fuerte y un suelo apagado.
   Entradas: planos { W,H,R,G,B,Y } (se modifican), cielo 0-1 (Float32), valores { realce 0-100, relleno 0-100, primerPlano -100..100 }.
   Salida: nada.
   ═══════════════════════════════════════════════════════════════ */
import { gauss, gaussMasked, smoothstep } from "../../portrait/shared/blur.js";
import { oklab } from "../../ai-kit/oklab.js";
import { recolorear } from "../../clothing/engine/recolor.js";

export const haySky = v => !!((v.realce || 0) || (v.relleno || 0) || (v.primerPlano || 0));
const Y3 = (R, G, B, i) => 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];

export function mejorarCielo(p, cielo, v){
  const { W, H, R, G, B, Y } = p, n = W * H, sky = gauss(cielo, W, H, 1.5), lab = new Float32Array(3);
  let filaMax = 0; for(let y = 0; y < H; y++) for(let x = 0; x < W; x += 4) if(sky[y * W + x] > 0.5){ filaMax = y; break; }
  const rel = Math.min(100, Math.max(0, v.relleno || 0)) / 100, real = Math.min(100, Math.max(0, v.realce || 0)) / 100, luz = (v.primerPlano || 0) / 100;
  if(rel > 0 && filaMax > 4){
    const F = Math.sqrt(n), medio = gaussMasked(Y, sky, W, H, Math.max(4, F * 0.05));
    for(let y = 0; y < H; y++){
      const t = Math.min(1, y / filaMax), top = [0.04, 0.17, 0.62], hor = [0.34, 0.56, 0.92];
      for(let x = 0; x < W; x++){
        const i = y * W + x, s = sky[i]; if(s <= 0.01) continue;
        oklab(R[i], G[i], B[i], lab);
        const apagado = 1 - smoothstep(0.04, 0.14, Math.hypot(lab[1], lab[2])), w = s * rel * apagado; if(w <= 0.002) continue;
        const D = Math.min(1.6, Math.max(0.45, Y[i] / Math.max(medio[i], 1e-3)));            // detalle de las nubes
        const k = (c) => top[c] + (hor[c] - top[c]) * t;
        R[i] += w * (Math.min(1, k(0) * D) - R[i]); G[i] += w * (Math.min(1, k(1) * D) - G[i]); B[i] += w * (Math.min(1, k(2) * D) - B[i]);
      }
    }
  }
  for(let i = 0; i < n; i++) Y[i] = Y3(R, G, B, i);
  if(real > 0){
    const lista = []; for(let i = 0; i < n; i += 5) if(sky[i] > 0.5) lista.push(Y[i]); lista.sort((a, b) => a - b);
    const med = lista.length ? lista[lista.length >> 1] : 0.3, c = 0.35 * real;
    for(let i = 0; i < n; i++){ const s = sky[i]; if(s <= 0.01) continue; const f = Math.min(1.8, Math.max(0.55, Math.pow(Math.max(Y[i], 1e-4) / Math.max(med, 1e-4), c))), k = 1 + s * (f - 1); R[i] *= k; G[i] *= k; B[i] *= k; }
    for(let i = 0; i < n; i++) Y[i] = Y3(R, G, B, i);
    recolorear(p, sky, { saturacion: 60 * real });
  }
  if(luz !== 0){
    const g = Math.pow(2, luz * 0.8);
    for(let i = 0; i < n; i++){ const f = 1 - sky[i]; if(f <= 0.01) continue; const k = 1 + f * (g - 1); R[i] = Math.min(1, R[i] * k); G[i] = Math.min(1, G[i] * k); B[i] = Math.min(1, B[i] * k); }
    for(let i = 0; i < n; i++) Y[i] = Y3(R, G, B, i);
  }
}
