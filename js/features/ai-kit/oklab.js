/* ═══════════════════════════════════════════════════════════════
   AI-KIT · OKLab (puro, sin DOM)
   Conversión entre luz lineal sRGB (0-1) y OKLab (Björn Ottosson), un espacio perceptual: cambiar el tono o la saturación de
   una zona (pelo, iris, labios) sin tocar su luminosidad. Entradas: r, g, b lineales y un Float32Array(3) de salida.
   Salidas: oklab(r,g,b,out) → [L,a,b] y linear(L,a,b,out) → [r,g,b] (sin recortar: quien lo usa decide).
   ═══════════════════════════════════════════════════════════════ */

export function oklab(r, g, b, o){
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  o[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  o[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  o[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return o;
}

export function linear(L, a, b, o){
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return o;
}
