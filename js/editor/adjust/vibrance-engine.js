/* ═══════════════════════════════════════════════════════════════
   VIBRANCE PREMIUM · motor (sin DOM)
   Saturación y vibrance en OKLab, COMPARTIDOS por «Vibrance» de Realify Pro (modo Premium 👑) y por el paso de color de Realify Basic.
   · Saturación: multiplica el croma por igual en todos los colores.
   · Vibrance: sube más el croma de los colores apagados (peso = 1 − croma/0,18) y protege la piel (matiz 20–80°, croma 0,03–0,16).
     En negativo apaga más los colores vivos que los apagados.
   Entradas: factorCroma(lab, sat, vib) → multiplicador del croma · vibrancePremium(data, { vibrance, saturation }, { fast, escala }).
   Salidas: vibrancePremium modifica data RGBA de 8 bits (luz lineal, mapeo de gama y tramado de applyColorMap).
   Límites: `escala` = fuerza de vibrance a 100 (Basic 0,45; Pro 0,9).
   ═══════════════════════════════════════════════════════════════ */
import { applyColorMap, toLab, toRgb, DEC } from "./premiumcolor.js";

export const CROMA_REF = 0.18;

/** Multiplicador del croma (a, b de OKLab) para saturación `sat` (1 = igual) y vibrance `vib` (ya escalado, −1..1 aprox.). */
export function factorCroma(lab, sat, vib){
  const C = Math.hypot(lab[1], lab[2]), hue = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
  const piel = hue > 20 && hue < 80 && C > 0.03 && C < 0.16 ? 0.5 : 1;     // la piel se protege
  const peso = vib > 0 ? Math.max(0, 1 - C / CROMA_REF) : 0.5 + 0.5 * Math.min(1, C / CROMA_REF);
  return sat * (1 + vib * peso * piel);
}

/** Aplica saturación y vibrance (−100..100 ambas) a una luz lineal r, g, b; escribe el resultado lineal en `rgb`. */
export function saturaOKLab(r, g, b, sat, vib, lab, rgb){
  toLab(Math.max(0, r), Math.max(0, g), Math.max(0, b), lab);
  const k = factorCroma(lab, sat, vib);
  toRgb(lab[0], lab[1] * k, lab[2] * k, rgb);
}

export function vibrancePremium(data, p, { fast = false, escala = 0.9 } = {}){
  const sat = 1 + (p.saturation || 0) / 100, vib = (p.vibrance || 0) / 100 * escala, lab = [0, 0, 0];
  if(sat === 1 && !vib) return;
  applyColorMap(data, (R, G, B, rgb) => {
    saturaOKLab(DEC[R], DEC[G], DEC[B], sat, vib, lab, rgb);
    const Y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return Y < 0 ? 0 : Y > 1 ? 1 : Y;
  }, { fast });
}
