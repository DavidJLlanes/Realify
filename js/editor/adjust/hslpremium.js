/* ═══════════════════════════════════════════════════════════════
   TONO Y SATURACIÓN · MODO PREMIUM 👑
   Mismos mandos (Tono, Saturación, Luminosidad, Colorear), otro motor:

     · Espacio perceptual OKLab/OKLCh en luz lineal y coma flotante, en
       vez de HSL sobre valores codificados. Girar el tono conserva la
       luminosidad percibida (en HSL un amarillo girado a azul se
       oscurecía de golpe y un azul a amarillo se volvía fluorescente) y
       el croma, así que no aparecen saltos ni colores sucios.
     · Saturación sobre el croma: 0 es un gris con la MISMA luminosidad
       que el color, no el gris «medio» del HSL.
     · Luminosidad sobre L perceptual; al aclarar hacia el blanco o
       oscurecer hacia el negro el croma se reduce en proporción, como
       en la luz real, sin colores lavados ni sombras teñidas.
     · Colorear: tono y croma nuevos conservando la luminosidad de cada
       píxel (el retrato no se aplana).
     · Mapeo de gama: si un color sale del sRGB se reduce su croma (a
       igual luminosidad y tono) hasta que cabe, en vez de recortar un
       canal y cambiarle el tono.
     · Tramado al volver a 8 bits: sin bandas en cielos y degradados.
   ═══════════════════════════════════════════════════════════════ */

import { applyColorMap, toLab, toRgb, DEC } from "./premiumcolor.js";

/* `fast`: vista previa en vivo (tabla interpolada); el resultado final
   se calcula SIEMPRE color a color (ver premiumcolor.js). */
export function hslPremium(data, p, { fast = false } = {}){
  const dh = (p.hue || 0) * Math.PI / 180, cosH = Math.cos(dh), sinH = Math.sin(dh);
  const sat = (p.sat || 0) / 100, lf = (p.light || 0) / 100;
  const colorize = !!p.colorize, cHue = (p.hue || 0) * Math.PI / 180;
  // Colorear: croma objetivo de 0 a ~0,2 (muy saturado en sRGB)
  const cTarget = Math.max(0, Math.min(1, (sat + 1) / 2)) * 0.2;
  const satK = 1 + sat;
  if(!dh && !sat && !lf && !colorize) return;   // sin cambios: la imagen, intacta
  const lab = [0, 0, 0];
  applyColorMap(data, (R, G, B, rgb) => {
    toLab(DEC[R], DEC[G], DEC[B], lab);
    let L = lab[0], a = lab[1], b = lab[2];
    if(colorize){
      a = cTarget * Math.cos(cHue); b = cTarget * Math.sin(cHue);
    } else {
      if(dh){ const na = a * cosH - b * sinH; b = a * sinH + b * cosH; a = na; }
      if(sat){ a *= satK; b *= satK; }
    }
    if(lf){
      const L2 = lf > 0 ? L + (1 - L) * lf : L * (1 + lf);
      // El croma acompaña: hacia el blanco o el negro se apaga
      const k = lf > 0 ? (L < 1 ? (1 - L2) / (1 - L) : 0) : (L > 0 ? L2 / L : 0);
      a *= k; b *= k; L = L2;
    }
    toRgb(L, a, b, rgb);
    const Lc = L < 0 ? 0 : L > 1 ? 1 : L;
    return Lc * Lc * Lc;
  }, { fast });
}
