/* ═══════════════════════════════════════════════════════════════
   UTIL · COLOR HSL
   Conversión entre RGB (0–255) y HSL (h, s, l en 0–1), sin DOM. La usan los ajustes de color y los estilos (también Realify Basic).
   Entradas: rgbToHsl(r, g, b) · hslToRgb(h, s, l). Salidas: [h, s, l] · [r, g, b] enteros.
   Límites: sin gestión de color: es la conversión simple de HSL, no un espacio perceptual.
   ═══════════════════════════════════════════════════════════════ */

export function rgbToHsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if(mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if(mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if(mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

export function hslToRgb(h, s, l){
  if(s === 0){ const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = t => {
    if(t < 0) t += 1;
    if(t > 1) t -= 1;
    if(t < 1/6) return p + (q - p) * 6 * t;
    if(t < 1/2) return q;
    if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [Math.round(hue(h + 1/3) * 255),
          Math.round(hue(h) * 255),
          Math.round(hue(h - 1/3) * 255)];
}
