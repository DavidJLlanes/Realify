/* ═══════════════════════════════════════════════════════════════
   REALISMO · GRANO SOLO DONDE FALTA (puro, sin DOM)
   Suma ruido de sensor (luminancia con un poco de crominancia) multiplicado por el mapa de zonas lisas y por la raíz de la señal
   (ruido de disparo: más en las luces que en las sombras). Donde la foto ya tiene textura no se toca.
   Entradas: planos { W, H, R, G, B, Y }, mapa liso 0-1 y { fuerza 0-100, tam 0-100, semilla }. Salida: modifica R, G, B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { ruido } from "../../portrait/shared/ruido.js";

export function anadirGrano(p, liso, { fuerza = 60, tam = 30, semilla = 7 } = {}){
  const { W, H, R, G, B, Y } = p, s = 0.45 + tam / 100 * 1.8, g = ruido(W, H, s, semilla), c = ruido(W, H, s * 1.5, semilla + 1), amp = fuerza / 100 * 0.03;
  for(let i = 0; i < W * H; i++){
    const m = liso[i]; if(m < 0.01) continue;
    const a = amp * m * Math.sqrt(Y[i] + 0.02);
    R[i] = Math.max(0, R[i] + a * (g[i] + 0.3 * c[i])); G[i] = Math.max(0, G[i] + a * g[i]); B[i] = Math.max(0, B[i] + a * (g[i] - 0.3 * c[i]));
  }
}
