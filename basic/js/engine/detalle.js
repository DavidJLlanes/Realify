/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · PASOS DE DETALLE (Premium)
   Reducir ruido, definición (contraste local sin halos, filtro guiado) y nitidez (máscara de enfoque con protección de bordes y
   de halos, la misma del modo Premium de Realify). Los radios salen del tamaño de la foto, así que la vista previa reducida y el
   resultado final se ven igual.
   Entradas: pasoRuido / pasoDefinicion / pasoNitidez(data, w, h, ajustes). Salidas: nada (modifica data).
   Límites: sin DOM. Nitidez y ruido van de 0 a 100; definición de −100 (suaviza) a 100.
   ═══════════════════════════════════════════════════════════════ */
import { claridadPixeles } from "../../../js/filters/library/basic/local-contrast-engine.js";
import { sharpenRGBA } from "../../../js/filters/library/sharpen-engine.js";
import { denoisePixels } from "../../../js/features/photo-tools.js";

export const hayRuido = a => (a.ruido || 0) > 0;
export const hayDefinicion = a => !!a.definicion;
export const hayNitidez = a => (a.nitidez || 0) > 0;

export function pasoRuido(data, w, h, a) {
  if (!hayRuido(a)) return;
  data.set(denoisePixels(data, w, h, a.ruido, Math.min(100, a.ruido * 1.3)));
}

export function pasoDefinicion(data, w, h, a) {
  const v = a.definicion || 0;
  if (!v) return;
  claridadPixeles(data, w, h, { structure: v * 0.5, detail: v });     // mismo motor que «Detalle y estructura» de Pro (estructura a mitad de fuerza)
}

/* Dos escalas sobre la luminancia: detalle fino (pelo, texturas) y acutancia media (contornos). Más cantidad que antes, pero con
   más control de halos y umbral para no subir el ruido. Con 50 la mejora de detalle ya supera a la antigua con 100. */
export function pasoNitidez(data, w, h, a) {
  if (!hayNitidez(a)) return;
  const k = a.nitidez / 100, r = Math.max(0.7, Math.max(w, h) / 3000);
  sharpenRGBA(data, w, h, { mode: "dual", amount: k * 280, radius: r, threshold: 3 }, 1);     // receta de dos escalas compartida con el enfoque Premium de Pro
}
