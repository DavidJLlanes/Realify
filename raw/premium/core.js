/* ═══════════════════════════════════════════════════════════════
   REVELADO PREMIUM · núcleo compartido
   Constantes, matrices y parámetros que usan por igual la GPU (vista
   previa, raw/premium/gpu.js) y la CPU (resultado final y 16 bits,
   raw/premium/cpu.js). Todo lo numérico vive aquí para que las dos
   rutas no puedan divergir: los shaders reciben estas mismas cifras.

   Flujo «de escena», en coma flotante y luz lineal, espacio de trabajo
   Rec.2020 (el que entrega LibRaw con outputColor 8):
     1. Datos de LibRaw → luz lineal (se deshace la curva BT.709 que el
        motor aplica siempre) × margen de altas luces.
     2. Balance de blancos, corrección de viñeteado de lente, CA.
     3. Ruido de luminosidad (filtro guiado fino, r = 2) y de color
        (filtro guiado sobre las proporciones R/Y y B/Y).
     4. Exposición en pasos reales (×2^EV, sin techo).
     5. Neblina: velo estimado con un filtro guiado del canal mínimo.
     6. Tono local sin halos: base = filtro guiado RÁPIDO (He y Sun,
        2015) de log2(Y) calculado a baja resolución —mapas de 512 px
        idénticos para la vista previa y el resultado final—; sombras y
        altas luces mueven la base, claridad amplía el detalle respecto
        a ella, textura y enfoque actúan sobre el detalle fino.
     7. Escena → pantalla con una curva fílmica en escala logarítmica:
        recta de pendiente «contraste» anclada en el gris medio 0,18 y un
        hombro suave (softplus) que lleva el blanco del sensor a ~0,89 y
        1 EV por encima a ~0,997: las luces llegan al blanco sin recorte
        duro y sin quedarse grises.
     8. Color en OKLab (saturación, intensidad, tono) y ajuste de gama
        a sRGB reduciendo sólo el croma, con luminosidad y tono fijos.
     9. Viñeteado creativo, OETF sRGB, grano y tramado (8 bits) o
        salida directa a 16 bits.
   ═══════════════════════════════════════════════════════════════ */

export const Y2020 = [0.2627, 0.6780, 0.0593];
export const MID = Math.log2(0.18);             // gris medio en EV

// Mapas de baja resolución (tono local, neblina, ruido de color)
export const MAP_LONG = 512;                    // lado largo de los mapas
export const R_COARSE = 8;                      // radio del filtro guiado de la base (px de mapa)
export const R_CHROMA = 3;                      // radio del ruido de color (px de mapa)
export const EPS_COARSE = 0.03;                 // en log2: bordes de ~0,2 EV o más se respetan
export const EPS_HAZE = 0.0004;
// Filtro fino a resolución completa
export const R_FINE = 2;
export const HALO = 6;
export const SHOULDER = 4;                      // dureza del hombro de la curva fílmica                          // filas extra por franja (5×5 dos veces + 3×3)

export const epsChroma = colorNoise => (0.01 + 0.3 * colorNoise / 100) ** 2;
export const epsFine = noise => (0.015 + 0.4 * noise / 100) ** 2;

import { rgbMatrix } from "../../js/core/icc.js";

/* ── matrices (lineales) ─────────────────────────────────────── */
export const SRGB_TO_2020 = [
  [0.6274040, 0.3292820, 0.0433136],
  [0.0690970, 0.9195400, 0.0113612],
  [0.0163916, 0.0880132, 0.8955950]];
export const REC2020_TO_SRGB = invert3(SRGB_TO_2020);
// OKLab (Ottosson): sRGB lineal → LMS, LMS' → Lab y sus inversas
const OK_M1 = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005]];
export const OK_M2 = [
  [0.2104542553, 0.7936177850, -0.0040720468],
  [1.9779984951, -2.4285922050, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.8086757660]];
export const OK_M2_INV = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.2914855480]];
export const OK_M1_INV_SRGB = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.7076147010]];
export const OK_M1_2020 = mul3(OK_M1, REC2020_TO_SRGB);   // Rec.2020 lineal → LMS

/* Espacio de SALIDA del revelado: sRGB (por defecto) o Display P3. Sólo cambian la matriz de Rec.2020 a la pantalla y la de OKLab a la pantalla
   (el mapeo de gama reduce el croma hasta caber en ESA gama); la curva de transferencia de P3 es la de sRGB. */
const SRGB_TO_P3 = rgbMatrix("srgb", "display-p3"), P3_TO_SRGB = rgbMatrix("display-p3", "srgb");
export const OUT_SPACES = {
  srgb: { T: REC2020_TO_SRGB, M1i: OK_M1_INV_SRGB },
  "display-p3": { T: mul3(SRGB_TO_P3, REC2020_TO_SRGB), M1i: invert3(mul3(OK_M1, P3_TO_SRGB)) }
};
export const outSpaceOf = s => (s && s.space === "display-p3") ? "display-p3" : "srgb";

export function mul3(a, b){
  return a.map((row, i) => [0, 1, 2].map(j => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
}
export function invert3(m){
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
          [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
          [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
// Para GLSL (mat3 va por columnas)
export const glMat3 = m => new Float32Array([m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]]);

/* ── curva de LibRaw ─────────────────────────────────────────────
   LibRaw-Wasm ignora `gamm` y entrega SIEMPRE la curva BT.709 de dcraw
   (potencia 0,45, pendiente 4,5): 0,18 lineal sale como 0,409. Se
   reproduce aquí `gamma_curve()` de dcraw para invertirla exactamente. */
function dcrawGamma(pwr = 0.45, ts = 4.5){
  const g = [pwr, ts, 0, 0, 0];
  const bnd = [0, 0]; bnd[g[1] >= 1 ? 1 : 0] = 1;
  if(g[1] && (g[1] - 1) * (g[0] - 1) <= 0){
    for(let i = 0; i < 48; i++){
      g[2] = (bnd[0] + bnd[1]) / 2;
      bnd[((g[2] / g[1]) ** -g[0] - 1) / g[0] - 1 / g[2] > -1 ? 1 : 0] = g[2];
    }
    g[3] = g[2] / g[1];
    g[4] = g[2] * (1 / g[0] - 1);
  }
  return g;
}
const G709 = dcrawGamma();
export const bt709Decode = v => v < G709[2] ? v / G709[1] : ((v + G709[4]) / (1 + G709[4])) ** (1 / G709[0]);
export const bt709Encode = r => r < G709[3] ? r * G709[1] : r ** G709[0] * (1 + G709[4]) - G709[4];
let _decode16 = null;
/* Tabla de 16 bits → lineal. LibRaw escribe 0x10000·f(r) (con tope
   0xFFFF), así que el valor codificado es n/65536. */
export function decodeLut16(){
  if(!_decode16){
    _decode16 = new Float32Array(65536);
    for(let n = 0; n < 65536; n++) _decode16[n] = bt709Decode(n / 65536);
  }
  return _decode16;
}
export const srgbDecode = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
export const srgbEncode = v => v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;

/* ── parámetros derivados de los ajustes ─────────────────────── */
/* `wb` son las ganancias relativas de siempre (tone.js › wbGains),
   renormalizadas con la luminancia de Rec.2020 para que el balance no
   cambie el brillo. */
export function premiumParams(s, wb){
  const norm = Y2020[0] * wb[0] + Y2020[1] * wb[1] + Y2020[2] * wb[2];
  const space = outSpaceOf(s);
  return {
    space, out: OUT_SPACES[space],
    wb: wb.map(v => v / norm),
    exposure: 2 ** (s.exposure || 0),
    noise: (s.noise || 0) / 100, colorNoise: (s.colorNoise || 0) / 100,
    epsFine: epsFine(s.noise || 0), epsChroma: epsChroma(s.colorNoise || 0),
    dehaze: (s.dehaze || 0) / 100,
    shadows: (s.shadows || 0) / 100, highlights: (s.highlights || 0) / 100,
    clarity: (s.clarity || 0) / 100, texture: (s.texture || 0) / 100, sharpen: (s.sharpen || 0) / 100,
    contrast: 1.1 * 2 ** ((s.contrast || 0) / 100 * 0.8),
    white: (s.whites || 0) / 100 * 0.6,           // desplazamiento del punto blanco, en EV
    blacks: (s.blacks || 0) / 100 * 0.04,
    saturation: 1 + (s.saturation || 0) / 100, vibrance: (s.vibrance || 0) / 100,
    hue: (s.hue || 0) * Math.PI / 180,
    lensVignette: (s.lensVignette || 0) / 100, vignette: (s.vignette || 0) / 100,
    ca: (s.ca || 0) * 0.000015, grain: (s.grain || 0) / 100
  };
}

/* Tamaño de los mapas para una imagen de W×H (el ORIGINAL, no la vista
   previa: así la vista previa y el resultado usan la misma rejilla). */
export function mapSize(W, H){
  const m = Math.max(W, H);
  if(m <= MAP_LONG) return [W, H];
  return [Math.max(1, Math.round(W * MAP_LONG / m)), Math.max(1, Math.round(H * MAP_LONG / m))];
}

/* Clave de lo que obliga a recalcular los mapas. */
export const mapsKey = s => [s.wb, s.temperature, s.tint, s.lensVignette, s.colorNoise, (s.autoWb || []).join(":")].join(",");

/* Ajustes del motor LibRaw para Premium: Rec.2020 (sin recortar los
   colores fuera de sRGB), demosaico DHT (el mejor de los incluidos en
   las pruebas: +7 dB en bordes de color frente a AHD) y un paso de
   margen para las altas luces reconstruidas, que el revelado recupera
   multiplicando por 2. Si el usuario ha cambiado a mano la calidad de
   interpolación o la exposición del motor, se respeta su elección. */
export const PREMIUM_OUTPUT_COLOR = 8;
/* Exposición base de los RAW (+0,3 EV, como el «baseline» de las
   cámaras y de Lightroom), en los dos modos: el gris medio 0,18 de la
   escena sale hacia 130/255 y no a 117, que se percibe apagado. No se
   aplica a las fotos normales (Revelado fotográfico), que ya vienen
   expuestas. */
export const RAW_BASE_EV = 0.3;
export function premiumEngine(settings){
  const o = { outputColor: PREMIUM_OUTPUT_COLOR };
  if(settings.userQual === 3) o.userQual = 11;
  if(!settings.expCorrec && settings.expShift === 1){ o.expCorrec = true; o.expShift = 0.5; o.expPreser = 0; }
  return o;
}
