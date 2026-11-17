/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · AUTO
   Mide la foto con el diagnóstico de «Mejora automática Premium» de Realify y lo traduce a los deslizadores de Basic: el usuario
   ve y puede afinar cada valor (no es una caja negra).
   Entradas: medirAuto(imageData). Salidas: { ajustes } con exposición, punto negro, temperatura, tinte, sombras, luces altas,
   contraste, brillo e intensidad. Límites: sin DOM; mide una muestra (≤ 200 000 píxeles), así que es rápido en fotos grandes.
   ═══════════════════════════════════════════════════════════════ */
import { measurePremium } from "../../../js/editor/adjust/autoenhance.js";

const tope = v => Math.max(-100, Math.min(100, Math.round(v)));

export function medirAuto(img) {
  const P = measurePremium(img.data, img.width, img.height), [gr, gg, gb] = P.gains || [1, 1, 1];
  const media = (gr + gb) / 2;
  /* Inverso de wbGains: r = 1 + 0,4·t, b = 1 − 0,4·t, g = 1 − 0,25·k (las ganancias del diagnóstico se normalizan al azul-rojo). */
  const t = (gr - gb) / (0.4 * (gr + gb)), k = (1 - gg / media) / 0.25;
  return { ajustes: {
    temperatura: tope(t / 0.6 * 100), tinte: tope(k / 0.6 * 100),
    negro: tope(P.black / 40 * 100), sombras: tope(P.shadows), luces: tope(-P.highlights),
    contraste: tope(P.contrast), brillo: tope(P.brightness), intensidad: tope(P.vib / 0.45 * 100),
  } };
}
