/* ═══════════════════════════════════════════════════════════════
   ESCENA · REALZAR POR TIPO (puro, sin DOM)
   Cada tipo (agua, follaje, cielo, edificios, piel) tiene su receta sobre su máscara: saturación (y un empujón de tono en el follaje, que se
   va hacia el verde vivo), y «Detalle» = contraste local (en log, sin halos) para dar relieve a la hierba, el agua y las fachadas. La piel sube
   la saturación mucho menos y nunca cambia el tono. La cantidad puede ser negativa (apagar). Entradas: planos (se modifican), máscara 0-1,
   tipo, cantidad -100..100, detalle 0-100. Salida: nada.
   ═══════════════════════════════════════════════════════════════ */
import { gauss } from "../../portrait/shared/blur.js";
import { recolorear } from "../../clothing/engine/recolor.js";

export const TIPOS = ["agua", "follaje", "cielo", "edificios", "piel"];
const RECETA = { agua: { sat: 0.7, tono: 0, det: 0.8 }, follaje: { sat: 0.8, tono: 0.06, det: 1.0 }, cielo: { sat: 0.7, tono: 0, det: 0.3 }, edificios: { sat: 0.25, tono: 0, det: 1.2 }, piel: { sat: 0.2, tono: 0, det: 0 } };

export const hayTipo = v => !!((v.cantidad || 0) || (v.detalle || 0));

export function realzarTipo(p, mascara, tipo, cantidad, detalle){
  const r = RECETA[tipo] || RECETA.agua, { W, H, R, G, B, Y } = p, n = W * H;
  if(cantidad) recolorear(p, mascara, { saturacion: cantidad * r.sat, tono: cantidad * r.tono });
  const det = (detalle || 0) / 100 * r.det;
  if(det > 0){
    const ly = new Float32Array(n); for(let i = 0; i < n; i++) ly[i] = Math.log(Math.max(Y[i], 1e-4));
    const low = gauss(ly, W, H, Math.max(3, Math.sqrt(n) * 0.012));
    for(let i = 0; i < n; i++){ const m = mascara[i]; if(m <= 0.01) continue; const f = Math.min(1.5, Math.max(0.65, Math.exp(det * 0.7 * (ly[i] - low[i])))), k = 1 + m * (f - 1); R[i] = Math.min(1, R[i] * k); G[i] = Math.min(1, G[i] * k); B[i] = Math.min(1, B[i] * k); }
    for(let i = 0; i < n; i++) Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
  }
}
