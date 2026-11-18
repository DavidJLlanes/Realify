/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · VIÑETA (Premium)
   Oscurece (positivo) o aclara (negativo) los bordes. El cálculo es el motor COMPARTIDO con Realify Pro
   (js/filters/library/basic/vignette-engine.js): aquí sólo se traduce el mando único de Basic a sus parámetros.
   Entradas: pasoVineta(data, w, h, ajustes) con ajustes.vineta de −100 a 100. Salidas: nada (modifica data).
   Límites: elipse con la proporción de la foto; empieza a un 25 % del radio y llega al 100 % en las esquinas; con 100 las esquinas quedan casi negras (≈ −2,3 pasos)
   y con 50 ya se nota claramente (la fuerza crece más deprisa que el mando).
   ═══════════════════════════════════════════════════════════════ */
import { vineteaPixeles } from "../../../js/filters/library/basic/vignette-engine.js";

const INICIO = 0.25, OSCURO = 0.97, CLARO = 0.85;

export const hayVineta = a => !!a.vineta;

export function pasoVineta(data, w, h, a) {
  const v = (a.vineta || 0) / 100;
  if (!v) return;
  const fuerza = Math.abs(v) ** 0.8;
  if (v > 0) vineteaPixeles(data, w, h, { modo: "oscuro", alfa: OSCURO * fuerza, inicio: INICIO });
  else vineteaPixeles(data, w, h, { modo: "mezcla", alfa: CLARO * fuerza, color: [255, 255, 255], inicio: INICIO });
}
