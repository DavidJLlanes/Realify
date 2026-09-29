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

const DEC = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; DEC[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
/* Codificación sRGB por tabla con interpolación (4096 tramos, más
   finos cerca del negro, donde la curva es más empinada): error muy por
   debajo de 1/255 y sin el Math.pow por canal, que era lo más lento. */
const ENC_N = 4096, ENC = new Float32Array(ENC_N + 2);
for(let i = 0; i <= ENC_N + 1; i++){ const v = Math.min(1, (i / ENC_N) ** 2); ENC[i] = (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255; }
const enc01 = v => v <= 0 ? 0 : v >= 1 ? 255 : enc255(v);
const enc255 = v => { const t = Math.sqrt(v) * ENC_N, i = t | 0, f = t - i; return ENC[i] + (ENC[i + 1] - ENC[i]) * f; };

function toLab(r, g, b, out){
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  out[0] = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  out[1] = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  out[2] = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
}
function toRgb(L, a, b, out){
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
}

/* Ruido triangular determinista (±1 LSB) para el tramado */
const tri = i => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return ((h & 255) + ((h >>> 8) & 255)) / 256 - 1;
};

/* `fast`: para la vista previa en vivo. En vez de calcular cada color,
   se calcula una tabla de 33×33×33 colores y se interpola (trilineal):
   la diferencia es de décimas de nivel y cada fotograma tarda una
   fracción. El resultado final se calcula SIEMPRE color a color. */
export function hslPremium(data, p, { fast = false } = {}){
  const dh = (p.hue || 0) * Math.PI / 180, cosH = Math.cos(dh), sinH = Math.sin(dh);
  const sat = (p.sat || 0) / 100, lf = (p.light || 0) / 100;
  const colorize = !!p.colorize, cHue = (p.hue || 0) * Math.PI / 180;
  // Colorear: croma objetivo de 0 a ~0,2 (muy saturado en sRGB)
  const cTarget = Math.max(0, Math.min(1, (sat + 1) / 2)) * 0.2;
  const satK = 1 + sat;
  if(!dh && !sat && !lf && !colorize) return;   // sin cambios: la imagen, intacta
  const lab = [0, 0, 0], rgb = [0, 0, 0];
  /* Las fotos repiten mucho los mismos colores (cielos, fondos): el
     resultado LINEAL de cada color de 24 bits se guarda (hasta 256 k
     entradas) y sólo se vuelve a tramar. */
  if(fast){
    /* La tabla guarda la parte SUAVE de la transformación (color lineal
       sin ajustar a la gama y su gris de igual luminosidad) y la
       interpolación se hace en luz lineal; el ajuste a la gama se aplica
       después, píxel a píxel, igual que en el cálculo exacto. */
    const N = 33, S = (N - 1) / 255, C = 4, T = new Float32Array(N * N * N * C);
    for(let r = 0, o = 0; r < N; r++) for(let g = 0; g < N; g++) for(let b = 0; b < N; b++, o += C){
      const gray = mapRaw(Math.round(r / S), Math.round(g / S), Math.round(b / S));
      T[o] = rgb[0]; T[o + 1] = rgb[1]; T[o + 2] = rgb[2]; T[o + 3] = gray;
    }
    const N2 = N * N, v = [0, 0, 0, 0];
    for(let i = 0, px = 0; i < data.length; i += 4, px++){
      const fr = data[i] * S, fg = data[i + 1] * S, fb = data[i + 2] * S;
      const r0 = Math.min(N - 2, fr | 0), g0 = Math.min(N - 2, fg | 0), b0 = Math.min(N - 2, fb | 0);
      const tr = fr - r0, tg = fg - g0, tb = fb - b0;
      const o = (r0 * N2 + g0 * N + b0) * C, oG = N * C, oR = N2 * C;
      for(let k = 0; k < C; k++){
        const c00 = T[o + k] + (T[o + C + k] - T[o + k]) * tb;
        const c01 = T[o + oG + k] + (T[o + oG + C + k] - T[o + oG + k]) * tb;
        const c10 = T[o + oR + k] + (T[o + oR + C + k] - T[o + oR + k]) * tb;
        const c11 = T[o + oR + oG + k] + (T[o + oR + oG + C + k] - T[o + oR + oG + k]) * tb;
        const c0 = c00 + (c01 - c00) * tg, c1 = c10 + (c11 - c10) * tg;
        v[k] = c0 + (c1 - c0) * tr;
      }
      rgb[0] = v[0]; rgb[1] = v[1]; rgb[2] = v[2];
      toGamut(v[3]);
      const d = tri(px) * 0.5;
      for(let k = 0; k < 3; k++) data[i + k] = Math.round(enc01(rgb[k]) + d);
    }
    return;
  }
  const memo = new Map(), MAX = 262144;
  for(let i = 0, px = 0; i < data.length; i += 4, px++){
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let hit = memo.get(key);
    if(hit === undefined){
      hit = mapColor(data[i], data[i + 1], data[i + 2]);
      if(memo.size < MAX) memo.set(key, hit);
    }
    const d = tri(px) * 0.5;
    data[i] = Math.round(hit[0] + d); data[i + 1] = Math.round(hit[1] + d); data[i + 2] = Math.round(hit[2] + d);
  }
  function mapColor(R, G, B){
    toGamut(mapRaw(R, G, B));
    const out = new Float32Array(3);
    for(let k = 0; k < 3; k++) out[k] = enc01(rgb[k]);
    return out;   // 0-255 sin redondear: el tramado se suma después
  }
  /* Mapeo de gama: si algún canal sale de 0-1, el color se mezcla en luz
     lineal con el gris de su misma luminosidad OKLab justo lo necesario
     para que quepa. Mezclar con un neutro en luz lineal conserva la
     cromaticidad dominante (el tono) y la luminosidad apenas se mueve:
     se pierde croma, no se tuerce el color como al recortar un canal. */
  function toGamut(gray){
    let t = 1;
    for(let k = 0; k < 3; k++){
      const c = rgb[k];
      if(c > 1) t = Math.min(t, (1 - gray) / (c - gray));
      else if(c < 0) t = Math.min(t, gray / (gray - c));
    }
    if(t < 1){ t = Math.max(0, t); for(let k = 0; k < 3; k++) rgb[k] = gray + (rgb[k] - gray) * t; }
  }
  /* Deja en `rgb` el color transformado en luz lineal, SIN ajustar a la
     gama, y devuelve el gris lineal de su misma luminosidad. */
  function mapRaw(R, G, B){
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
  }
}
