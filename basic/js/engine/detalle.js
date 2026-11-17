/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · PASOS DE DETALLE (Premium)
   Reducir ruido, definición (contraste local sin halos, filtro guiado) y nitidez (máscara de enfoque con protección de bordes y
   de halos, la misma del modo Premium de Realify). Los radios salen del tamaño de la foto, así que la vista previa reducida y el
   resultado final se ven igual.
   Entradas: pasoRuido / pasoDefinicion / pasoNitidez(data, w, h, ajustes). Salidas: nada (modifica data).
   Límites: sin DOM. Nitidez y ruido van de 0 a 100; definición de −100 (suaviza) a 100.
   ═══════════════════════════════════════════════════════════════ */
import { guidedBase } from "../../../js/filters/library/basic/clarity.js";
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
  const n = w * h, L = new Float32Array(n), lado = Math.min(w, h);
  for (let i = 0, j = 0; j < n; i += 4, j++) L[j] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  const fuera = Float32Array.from(L);
  const estructura = guidedBase(L, w, h, Math.max(2, Math.round(lado * 0.02)), 0.006), detalle = guidedBase(L, w, h, Math.max(1, Math.round(lado * 0.0018)), 0.0015);
  const ke = (v > 0 ? v / 100 * 1.6 : v / 100) * 0.5, kd = v > 0 ? v / 100 * 2 : v / 100;
  for (let j = 0; j < n; j++) fuera[j] += (L[j] - estructura[j]) * ke + (L[j] - detalle[j]) * kd;
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    const l = L[j], delta = (fuera[j] - l) * (1 - (2 * l - 1) ** 4) * 255;     // peso de medios tonos: no quema luces ni empasta sombras
    if (!delta) continue;
    for (let c = 0; c < 3; c++) { const x = data[i + c] + delta; data[i + c] = x < 0 ? 0 : x > 255 ? 255 : x; }
  }
}

/* Dos escalas sobre la luminancia: detalle fino (pelo, texturas) y acutancia media (contornos). Más cantidad que antes, pero con
   más control de halos y umbral para no subir el ruido. Con 50 la mejora de detalle ya supera a la antigua con 100. */
export function pasoNitidez(data, w, h, a) {
  if (!hayNitidez(a)) return;
  const k = a.nitidez / 100, r = Math.max(0.7, Math.max(w, h) / 3000);
  sharpenRGBA(data, w, h, { mode: "unsharp", amount: k * 280, radius: r, threshold: 3, edge: 20, halo: 55 }, 1);
  sharpenRGBA(data, w, h, { mode: "unsharp", amount: k * 80, radius: r * 3, threshold: 2, edge: 35, halo: 60 }, 1);
}
