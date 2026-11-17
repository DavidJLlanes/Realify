/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · PASO DE COLOR (Premium)
   Un solo paso para todo lo que depende del color de cada píxel: punto negro, temperatura, tinte, exposición, saturación e
   intensidad. Va en luz LINEAL y coma flotante; la saturación y la intensidad en OKLab; lo que se sale de gama se acerca al gris
   de su misma luminosidad (no se recorta un canal) y al volver a 8 bits se trama. Reutiliza applyColorMap de Realify.
   Entradas: pasoColor(data, ajustes, { rapido }) — data = RGBA de 8 bits (se modifica) · ajustes = { id: -100..100 }.
   Salidas: nada (modifica data). rapido = tabla de 33³ colores para la vista previa; sin rapido, exacto color a color.
   Límites: sin DOM. ±2 EV de exposición, hasta 40/255 de punto negro, ±24 % de temperatura y tinte en los extremos.
   ═══════════════════════════════════════════════════════════════ */
import { applyColorMap, toLab, toRgb } from "../../../js/editor/adjust/premiumcolor.js";
import { wbGains } from "../../../js/editor/adjust/adjustments/white-balance.js";

const EV_MAX = 2, NEGRO_MAX = 40, LEVANTA_MAX = 30, WB_ESCALA = 0.6, CROMA_REF = 0.18, VIB_MAX = 0.45;
const CLAVES = ["exposicion", "negro", "saturacion", "intensidad", "temperatura", "tinte"];

const aLineal = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/* Tabla de 256 entradas: valor codificado → luz lineal, ya con el punto negro (sube) o el levantamiento de negros (baja). */
function tablaNegro(v) {
  const t = new Float32Array(256), sube = v > 0 ? v / 100 * NEGRO_MAX : 0, levanta = v < 0 ? -v / 100 * LEVANTA_MAX : 0;
  for (let i = 0; i < 256; i++) {
    const x = sube ? Math.max(0, (i - sube) / (255 - sube)) * 255 : levanta ? levanta + i * (255 - levanta) / 255 : i;
    t[i] = aLineal(x / 255);
  }
  return t;
}

export const hayColor = a => CLAVES.some(k => a[k]);

export function pasoColor(data, a, { rapido = false } = {}) {
  if (!hayColor(a)) return;
  const T = tablaNegro(a.negro || 0);
  const g = wbGains({ temp: (a.temperatura || 0) * WB_ESCALA, tint: (a.tinte || 0) * WB_ESCALA });
  const mul = 2 ** ((a.exposicion || 0) / 100 * EV_MAX), gr = g.r * mul, gg = g.g * mul, gb = g.b * mul;
  const sat = 1 + (a.saturacion || 0) / 100, vib = (a.intensidad || 0) / 100 * VIB_MAX, lab = [0, 0, 0];
  applyColorMap(data, (R, G, B, rgb) => {
    const r = T[R] * gr, gv = T[G] * gg, b = T[B] * gb;
    if (sat === 1 && !vib) { rgb[0] = r; rgb[1] = gv; rgb[2] = b; }
    else {
      toLab(Math.max(0, r), Math.max(0, gv), Math.max(0, b), lab);
      const C = Math.hypot(lab[1], lab[2]), hue = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
      const piel = hue > 20 && hue < 80 && C > 0.03 && C < 0.16 ? 0.5 : 1;     // la piel se protege
      const peso = vib > 0 ? Math.max(0, 1 - C / CROMA_REF) : 0.5 + 0.5 * Math.min(1, C / CROMA_REF);
      const k = sat * (1 + vib * peso * piel);
      toRgb(lab[0], lab[1] * k, lab[2] * k, rgb);
    }
    const Y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return Y < 0 ? 0 : Y > 1 ? 1 : Y;
  }, { fast: rapido });
}
