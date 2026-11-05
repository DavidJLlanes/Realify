/* ═══════════════════════════════════════════════════════════════
   BUSCAR FOTOS · COLORES DOMINANTES (motor puro, sin DOM)
   Reparte los píxeles de una miniatura en 13 nombres de color en español (HSV) y devuelve la fracción de cada uno.
   Entradas: RGBA, ancho, alto. Salida: { colores: [[nombre, fracción]…] (≥ 6 %, de mayor a menor), brillo, sat }.
   Límites: nombres básicos; un gris azulado cuenta como gris, no como azul.
   ═══════════════════════════════════════════════════════════════ */
export const NOMBRES = ["rojo", "naranja", "amarillo", "verde", "turquesa", "azul", "morado", "rosa", "marron", "gris", "blanco", "negro"];

export function nombreDeColor(r, g, b){
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, d = mx - mn, s = mx ? d / mx : 0;
  if(v < 0.16) return "negro";
  if(s < 0.14) return v > 0.82 ? "blanco" : "gris";
  let h = d === 0 ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if((h < 40 || h >= 330) && v < 0.55 && s < 0.9 && h >= 10 && h < 40) return "marron";
  if(h >= 330 || h < 12) return v > 0.7 && s < 0.5 ? "rosa" : "rojo";
  if(h < 40) return v < 0.62 ? "marron" : "naranja";
  if(h < 68) return "amarillo";
  if(h < 165) return "verde";
  if(h < 200) return "turquesa";
  if(h < 255) return "azul";
  if(h < 290) return "morado";
  return "rosa";
}

export function coloresDominantes(rgba, w, h){
  const cuenta = new Map(); let n = 0, sumL = 0, sumS = 0;
  for(let i = 0; i < rgba.length; i += 4){
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const k = nombreDeColor(r, g, b); cuenta.set(k, (cuenta.get(k) || 0) + 1); n++;
    sumL += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; sumS += mx ? (mx - mn) / mx : 0;
  }
  const colores = [...cuenta.entries()].map(([k, c]) => [k, +(c / n).toFixed(3)]).filter(([, f]) => f >= 0.06).sort((a, b) => b[1] - a[1]);
  return { colores, brillo: +(sumL / n).toFixed(3), sat: +(sumS / n).toFixed(3) };
}
