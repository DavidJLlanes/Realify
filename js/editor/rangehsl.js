/* ═══════════════════════════════════════════════════════════════
   TONO, SATURACIÓN Y LUMINANCIA POR RANGOS · motores
   Ocho rangos de color (rojos … magentas). Cada píxel pesa en un rango según la distancia de su tono al centro y según su CROMA: los grises, los blancos y
   los negros no tienen color y no los toca ningún rango (antes un gris contaba como «rojo», porque su tono vale 0, y aclarar los rojos aclaraba toda la
   imagen). Cada rango tiene:
     · centro e INTERVALO (anchura, en grados de tono): qué colores abarca;
     · DIFUSIÓN (0–100 %): cuánto de ese intervalo es una caída suave. Al 100 % toda la anchura cae en coseno (como siempre, así que las capas hechas antes
       se ven igual); al 0 % el rango es de borde duro.
   Básico: HSL sobre valores codificados. Premium 👑: OKLCh en luz lineal y coma flotante (girar el tono conserva la luminosidad percibida; la saturación
   actúa sobre el croma; la luminosidad sobre L perceptual, apagando el croma hacia el blanco y el negro), mapeo de gama y tramado (premiumcolor.js).
   ═══════════════════════════════════════════════════════════════ */
import { applyColorMap, toLab, toRgb, DEC } from "./premiumcolor.js";

export const clamp = (v, a = 0, b = 255) => v < a ? a : v > b ? b : v;
export const hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
export function rgbHsl(r, g, b){ r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2; let h = 0, s = 0;
  if(d){ s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? 60 * ((g - b) / d % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); } return [(h + 360) % 360, s, l]; }
export function hslRgb(h, s, l){ h = (h % 360 + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1); const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h / 60 % 2 - 1)), m = l - c / 2;
  const q = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return q.map(v => (v + m) * 255); }

export const BANDS = [["red", "Rojos", 0, 32], ["orange", "Naranjas", 30, 30], ["yellow", "Amarillos", 60, 32], ["green", "Verdes", 120, 55], ["aqua", "Aguamarinas", 180, 50], ["blue", "Azules", 225, 45], ["purple", "Púrpuras", 270, 42], ["magenta", "Magentas", 315, 42]];
export const defaultRanges = () => Object.fromEntries(BANDS.map(([k, , h, w]) => [k, { center: h, width: w, feather: 100, hue: 0, sat: 0, light: 0 }]));
export const nearestBand = h => BANDS.reduce((best, b) => hueDist(h, b[2]) < hueDist(h, best[2]) ? b : best, BANDS[0])[0];
/** Rangos con algún cambio (los demás no cuestan nada). */
export const activeRanges = p => Object.values(p.ranges || {}).filter(q => q.hue || q.sat || q.light);

/** Peso (0–1) de un rango a una distancia de tono: 1 en el núcleo, caída en coseno en la zona de difusión. */
export function bandWeight(dist, q){
  const w = q.width, f = q.feather === undefined ? 1 : clamp(q.feather / 100, 0, 1), core = w * (1 - f);
  if(dist >= w) return 0;
  if(dist <= core) return 1;
  return 0.5 * (1 + Math.cos(Math.PI * (dist - core) / (w - core)));
}
/** Peso por croma: los grises no pertenecen a ningún rango. */
const chromaWeight = (r, g, b) => { const c = (Math.max(r, g, b) - Math.min(r, g, b)) / 255; return c < .02 ? 0 : c >= .2 ? 1 : (c - .02) / .18; };

/** Resultado de todos los rangos para un color: cambios acumulados de tono (°), saturación y luminancia (−1…1) y peso total. */
function effect(on, h, cw, out){
  let dh = 0, ds = 0, dl = 0, tw = 0;
  for(const q of on){ const dist = hueDist(h, q.center); if(dist >= q.width) continue; const w = bandWeight(dist, q) * cw; if(!w) continue;
    dh += q.hue * .6 * w; ds += q.sat / 100 * w; dl += q.light / 100 * w; tw += w; }
  out[0] = dh; out[1] = ds; out[2] = dl; out[3] = tw;
}

/** Motor básico (HSL). */
export function rangeHslBasic(d, p){
  const on = activeRanges(p); if(!on.length) return;
  const e = [0, 0, 0, 0];
  for(let i = 0; i < d.length; i += 4){
    const r = d[i], g = d[i + 1], b = d[i + 2], cw = chromaWeight(r, g, b); if(!cw) continue;
    let [h, s, l] = rgbHsl(r, g, b); effect(on, h, cw, e); if(!e[3]) continue;
    h += e[0]; s = clamp(e[1] < 0 ? s * (1 + e[1]) : s + (1 - s) * e[1] * .85, 0, 1); l = clamp(e[2] < 0 ? l * (1 + e[2] * .75) : l + (1 - l) * e[2] * .75, 0, 1);
    [d[i], d[i + 1], d[i + 2]] = hslRgb(h, s, l);
  }
}

/** Motor Premium 👑: mismos rangos y pesos, cambio en OKLCh sobre luz lineal. `fast`: vista previa en vivo (tabla interpolada). */
export function rangeHslPremium(d, p, { fast = false } = {}){
  const on = activeRanges(p); if(!on.length) return;
  const e = [0, 0, 0, 0], lab = [0, 0, 0];
  applyColorMap(d, (R, G, B, rgb) => {
    const cw = chromaWeight(R, G, B);
    toLab(DEC[R], DEC[G], DEC[B], lab);
    let L = lab[0], a = lab[1], b = lab[2];
    if(cw){
      effect(on, rgbHsl(R, G, B)[0], cw, e);
      if(e[3]){
        const ang = e[0] * Math.PI / 180, ds = e[1], dl = e[2];
        if(ang){ const c = Math.cos(ang), s = Math.sin(ang), na = a * c - b * s; b = a * s + b * c; a = na; }
        const k = ds < 0 ? 1 + ds : 1 + ds * .9; a *= k; b *= k;
        if(dl){
          const L2 = dl > 0 ? L + (1 - L) * dl * .75 : L * (1 + dl * .75), kc = dl > 0 ? (L < 1 ? (1 - L2) / (1 - L) : 0) : (L > 0 ? L2 / L : 0);
          a *= kc; b *= kc; L = L2;
        }
      }
    }
    toRgb(L, a, b, rgb);
    const Lc = L < 0 ? 0 : L > 1 ? 1 : L; return Lc * Lc * Lc;
  }, { fast });
}
