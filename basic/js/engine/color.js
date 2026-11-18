/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · PASO DE COLOR (Premium)
   Un solo paso para todo lo que depende del color de cada píxel: punto negro, temperatura, tinte, exposición, saturación e
   intensidad. Va en luz LINEAL y coma flotante; la saturación y la intensidad en OKLab; lo que se sale de gama se acerca al gris
   de su misma luminosidad (no se recorta un canal) y al volver a 8 bits se trama. Reutiliza applyColorMap de Realify.
   Entradas: pasoColor(data, ajustes, { rapido }) — data = RGBA de 8 bits (se modifica) · ajustes = { id: -100..100 }.
   Salidas: nada (modifica data). rapido = tabla de 33³ colores para la vista previa; sin rapido, exacto color a color.
   Límites: sin DOM. ±2 EV de exposición, hasta 40/255 de punto negro, ±24 % de temperatura y tinte en los extremos.
   ═══════════════════════════════════════════════════════════════ */
import { applyColorMap } from "../../../js/editor/adjust/premiumcolor.js";
import { saturaOKLab } from "../../../js/editor/adjust/vibrance-engine.js";
import { wbGains } from "../../../js/editor/adjust/adjustments/white-balance.js";

const EV_MAX = 2, NEGRO_MAX = 40, LEVANTA_MAX = 30, WB_ESCALA = 0.6, VIB_MAX = 0.45;
const CLAVES = ["exposicion", "negro", "saturacion", "intensidad", "temperatura", "tinte"];

const aLineal = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/* Tabla (1 entrada por unidad de 0 a 319): valor codificado → luz lineal. Con el punto negro bajado (negros levantados) la tabla ya lo
   incluye, canal a canal. Con el punto negro SUBIDO no se resta canal a canal (en una zona oscura de tono azulado quedaría sólo el canal
   azul y salen motas azules): se resta a la luminancia y los tres canales se escalan juntos, así el tono no cambia. */
function tablaNegro(v) {
  const t = new Float32Array(320), levanta = v < 0 ? -v / 100 * LEVANTA_MAX : 0;
  for (let i = 0; i < 320; i++) t[i] = aLineal((levanta ? levanta + i * (255 - levanta) / 255 : i) / 255);
  return t;
}
const lin = (T, x) => { const i = x | 0, f = x - i; return i >= 319 ? T[319] : T[i] + (T[i + 1] - T[i]) * f; };

export const hayColor = a => CLAVES.some(k => a[k]);

export function pasoColor(data, a, { rapido = false } = {}) {
  if (!hayColor(a)) return;
  const T = tablaNegro(a.negro || 0), sube = a.negro > 0 ? a.negro / 100 * NEGRO_MAX : 0, ancho = 255 - sube;
  const g = wbGains({ temp: (a.temperatura || 0) * WB_ESCALA, tint: (a.tinte || 0) * WB_ESCALA });
  const mul = 2 ** ((a.exposicion || 0) / 100 * EV_MAX), gr = g.r * mul, gg = g.g * mul, gb = g.b * mul;
  const sat = 1 + (a.saturacion || 0) / 100, vib = (a.intensidad || 0) / 100 * VIB_MAX, lab = [0, 0, 0];
  applyColorMap(data, (R, G, B, rgb) => {
    let kn = 1;
    if (sube) { const Ye = 0.2126 * R + 0.7152 * G + 0.0722 * B; kn = Ye > 0 ? Math.max(0, (Ye - sube) / ancho * 255) / Ye : 0; }
    const r = lin(T, Math.min(319, R * kn)) * gr, gv = lin(T, Math.min(319, G * kn)) * gg, b = lin(T, Math.min(319, B * kn)) * gb;
    if (sat === 1 && !vib) { rgb[0] = r; rgb[1] = gv; rgb[2] = b; }
    else {
      saturaOKLab(r, gv, b, sat, vib, lab, rgb);               // saturación y vibrance: motor compartido con Vibrance Premium de Pro
    }
    const Y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return Y < 0 ? 0 : Y > 1 ? 1 : Y;
  }, { fast: rapido });
}
