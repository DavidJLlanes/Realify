/* ═══════════════════════════════════════════════════════════════
   REALISMO · GRANO SOLO DONDE FALTA (puro, sin DOM)
   Suma ruido de sensor (luminancia con un poco de crominancia) multiplicado por el mapa de zonas lisas y por la raíz de la señal
   (ruido de disparo: más en las luces que en las sombras). Donde la foto ya tiene textura no se toca.
   Entradas: planos { W, H, R, G, B, Y }, mapa liso 0-1 y { fuerza 0-100, tam 0-100, semilla }. Salida: modifica R, G, B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { ruido } from "../../portrait/shared/ruido.js";

export function anadirGrano(p, liso, { fuerza = 60, tam = 30, semilla = 7 } = {}){
  const { W, H, R, G, B, Y } = p, s = 0.45 + tam / 100 * 1.8, g = ruido(W, H, s, semilla), c = ruido(W, H, s * 1.5, semilla + 1);
  /* El ruido se mide en valores de pantalla (gamma) —un 2,5 % como mucho— y se pasa a luz lineal con la pendiente de la curva de cada
     canal; así no revienta las sombras (antes, un ruido lineal fijo sumaba muchísimo sobre los negros) ni sale igual en todo el tono. */
  const amp = fuerza / 100 * 0.025, pend = v => 2.2 * Math.pow(Math.max(v, 0.0005), 0.5455);
  for(let i = 0; i < W * H; i++){
    const m = liso[i]; if(m < 0.01) continue;
    const t = Math.pow(Math.min(1, Math.max(0, Y[i])), 0.4545), peso = Math.min(1, 0.35 + 3 * t * (1 - t)), a = amp * m * peso;
    R[i] = Math.max(0, R[i] + a * pend(R[i]) * (g[i] + 0.3 * c[i]));
    G[i] = Math.max(0, G[i] + a * pend(G[i]) * g[i]);
    B[i] = Math.max(0, B[i] + a * pend(B[i]) * (g[i] - 0.3 * c[i]));
  }
}
