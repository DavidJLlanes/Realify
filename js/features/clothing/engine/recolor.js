/* ═══════════════════════════════════════════════════════════════
   ROPA · CAMBIAR COLOR (puro, sin DOM)
   Gira el tono y cambia la saturación en OKLab (un espacio perceptual) conservando la luminosidad de cada píxel, así los pliegues, las
   sombras y los brillos del tejido siguen donde estaban. Una prenda blanca, gris o negra no tiene tono que girar: con «Tinte» recibe color
   del tono elegido (más débil en sombras y brillos, para que no se vea una pintura). Si el color se sale de la gama sRGB, se baja la
   saturación de ese píxel lo justo (no se recorta canal a canal, que cambiaría el tono). Entradas: planos (se modifican), máscara 0-1,
   valores { tono -180..180, saturacion -100..100, luminosidad -100..100, tinte 0-100 }. Salida: nada.
   ═══════════════════════════════════════════════════════════════ */
import { oklab, linear } from "../../ai-kit/oklab.js";
import { smoothstep } from "../../portrait/shared/blur.js";

export const hayRecolor = v => !!((v.tono || 0) || (v.saturacion || 0) || (v.luminosidad || 0) || (v.tinte || 0));
const dentro = o => o[0] >= -0.0005 && o[1] >= -0.0005 && o[2] >= -0.0005 && o[0] <= 1.0005 && o[1] <= 1.0005 && o[2] <= 1.0005;

export function recolorear(p, mask, v){
  const { R, G, B } = p, n = R.length, lab = new Float32Array(3), rgb = new Float32Array(3);
  const giro = (v.tono || 0) * Math.PI / 180, sat = 1 + (v.saturacion || 0) / 100, lum = (v.luminosidad || 0) / 150, tinte = (v.tinte || 0) / 100;
  const h0 = ((v.tono || 0) + 360) % 360 * Math.PI / 180;
  for(let i = 0; i < n; i++){
    const m = mask[i]; if(m <= 0.001) continue;
    oklab(R[i], G[i], B[i], lab);
    const L = lab[0], C = Math.hypot(lab[1], lab[2]), neutral = 1 - smoothstep(0.01, 0.05, C);
    let h = Math.atan2(lab[2], lab[1]) + giro;
    if(tinte > 0) h = h * (1 - neutral * tinte) + h0 * neutral * tinte;
    let c = C * Math.max(0, sat);
    if(tinte > 0) c = Math.max(c, tinte * 0.11 * Math.min(1, L * 3, (1 - L) * 3) * neutral);
    const L2 = Math.min(1, Math.max(0, Math.pow(Math.max(L, 1e-4), 1 - lum)));
    let k = 1; linear(L2, c * Math.cos(h), c * Math.sin(h), rgb);
    for(let t = 0; t < 6 && !dentro(rgb); t++){ k *= 0.7; linear(L2, c * k * Math.cos(h), c * k * Math.sin(h), rgb); }
    R[i] += m * (Math.min(1, Math.max(0, rgb[0])) - R[i]); G[i] += m * (Math.min(1, Math.max(0, rgb[1])) - G[i]); B[i] += m * (Math.min(1, Math.max(0, rgb[2])) - B[i]);
  }
  for(let i = 0; i < n; i++) p.Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
}
