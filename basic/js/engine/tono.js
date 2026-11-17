/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · PASOS DE TONO (Premium)
   Luces altas, sombras y brillantez (motor Premium de «Sombras/Iluminaciones», con su entorno relativo al tamaño de la foto) y
   contraste y brillo (motor Premium de «Brillo y contraste»). Los dos conservan el tono y no sobresaturan.
   Entradas: pasoLuces(data, w, h, ajustes) · pasoContraste(data, w, h, ajustes). Salidas: nada (modifica data).
   Límites: sin DOM. «Luces altas» en negativo recupera (como en Fotos); «Brillantez» abre sombras y contiene luces a la vez.
   ═══════════════════════════════════════════════════════════════ */
import { applyBCPremium, applyShadowsHighlightsPremium } from "../../../js/editor/adjust/adjustments/brightness-contrast.js";

const tope = v => Math.max(-100, Math.min(100, v));

export const hayLuces = a => !!(a.sombras || a.luces || a.brillantez);
export const hayContraste = a => !!(a.contraste || a.brillo);

export function pasoLuces(data, w, h, a) {
  if (!hayLuces(a)) return;
  const b = a.brillantez || 0;
  applyShadowsHighlightsPremium(data, w, h, {
    shadows: tope((a.sombras || 0) + 0.6 * b),
    highlights: tope(-(a.luces || 0) + 0.4 * b),        // en el motor, positivo = oscurecer luces
    radius: Math.max(6, 0.035 * Math.max(w, h)), tone: 50,
  }, 1);
}

export function pasoContraste(data, w, h, a) {
  if (!hayContraste(a)) return;
  applyBCPremium(data, w, h, { brightness: a.brillo || 0, contrast: a.contraste || 0, protect: 100, pivot: "auto" });
}
