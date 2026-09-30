/* ═══════════════════════════════════════════════════════════════
   MEJORA AUTOMÁTICA DE UN TOQUE
   El botón «Automático» del cajón de móvil. No es un algoritmo nuevo:
   es «Tono / Color automático» (advanced-color.js) en modo color, con
   neutros equilibrados y sus valores de fábrica, aplicado sin abrir
   el diálogo. Queda como una capa de filtro normal con el id
   «auto-tone-color», así que el doble clic en su «fx» reabre ese
   mismo diálogo con estos valores para afinarlo, y se deshace como
   cualquier otro paso.
   ═══════════════════════════════════════════════════════════════ */

import { activeLayer } from "../core/doc.js";
import { applyDirect } from "./adjust.js";
import { autoToneColor } from "./advanced-color.js";
import { toast } from "../ui/toast.js";

const PARAMS = { mode:"color", clip:.5, neutral:true, mid:0 };

export async function autoEnhance(){
  const layer = activeLayer();
  if(!layer || !layer.canvas){ toast("No hay capa activa"); return; }
  if(layer.locked){ toast("La capa está bloqueada"); return; }
  // El cálculo en sí es el del modo sin diálogo del filtro original
  // (asíncrono); applyDirect se encarga después de la selección, la
  // capa de filtro y el historial exactamente igual que en el resto.
  const out = await autoToneColor({ init:{ ...PARAMS }, render:{ src:layer.canvas, isFinal:true } });
  const result = out.getContext("2d").getImageData(0, 0, out.width, out.height).data;
  return applyDirect("Mejora automática", data => data.set(result),
    { asLayer:true, filterId:"auto-tone-color", filterParams:{ ...PARAMS } });
}

/* ═══════════════════════════════════════════════════════════════
   MEJORA AUTOMÁTICA PREMIUM 👑
   Un toque, con los motores Premium en vez de «Tono / Color automático»:

     1. Balance de blancos en luz lineal: se estima el gris de la escena
        con los píxeles casi neutros (croma OKLab bajo, sin quemar ni
        negros); si hay pocos, con «shades of gray» (media de potencia
        6). Se corrige sólo el 75 % (en escala logarítmica) y con topes,
        para no borrar una luz cálida que forma parte de la foto.
     2. Color: el croma sube más cuanto más apagado está el color y nada
        en los que ya son intensos (como Vibrance), en OKLab, con mapeo
        de gama y tramado (premiumcolor.js).
     3. Luz: Brillo y contraste Premium (curva sobre la base, textura
        conservada) con brillo y contraste calculados de los percentiles
        de L*: la mediana hacia L* 48 y el rango hasta ~0,86 si la foto
        está plana.
   Los valores medidos se guardan en la capa de filtro («auto-premium»):
   volver a calcularla (aplicación parcial, cambios debajo) da siempre
   el mismo resultado; el doble clic en su «fx» vuelve a medir.
   ═══════════════════════════════════════════════════════════════ */
import { applyColorMap, toLab, toRgb, DEC } from "./premiumcolor.js";
import { applyBCPremium } from "./adjustments.js";

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const yToLs = y => y <= 216 / 24389 ? y * (24389 / 27) / 100 : (116 * Math.cbrt(y) - 16) / 100;

/* Mide sobre una copia de ≤ 600 px */
function measurePremium(data, w, h){
  const step = Math.max(1, Math.round(Math.sqrt(w * h / 360000)));
  const lab = [0, 0, 0];
  let nr = 0, ng = 0, nb = 0, nn = 0, pr = 0, pg = 0, pb = 0, pn = 0;
  for(let y = 0; y < h; y += step) for(let x = 0; x < w; x += step){
    const i = (y * w + x) * 4; if(data[i + 3] < 128) continue;
    const r = DEC[data[i]], g = DEC[data[i + 1]], b = DEC[data[i + 2]];
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, mx = Math.max(data[i], data[i + 1], data[i + 2]);
    if(Y < 0.02 || mx > 245) continue;
    pr += r ** 6; pg += g ** 6; pb += b ** 6; pn++;
    toLab(r, g, b, lab);
    if(Math.hypot(lab[1], lab[2]) < 0.04){ nr += r; ng += g; nb += b; nn++; }
  }
  let est = nn > pn * 0.02 && nn > 50 ? [nr / nn, ng / nn, nb / nn]
          : pn ? [(pr / pn) ** (1 / 6), (pg / pn) ** (1 / 6), (pb / pn) ** (1 / 6)] : [1, 1, 1];
  const m = (est[0] + est[1] + est[2]) / 3 || 1;
  let gains = est.map(v => clampN(Math.pow(m / Math.max(v, 1e-6), 0.75), 0.8, 1.25));
  const k = 0.2126 * gains[0] + 0.7152 * gains[1] + 0.0722 * gains[2];
  gains = gains.map(v => +(v / k).toFixed(4));
  // Tras el balance: L* y croma
  const Ls = [], Cs = [];
  for(let y = 0; y < h; y += step) for(let x = 0; x < w; x += step){
    const i = (y * w + x) * 4; if(data[i + 3] < 128) continue;
    const r = DEC[data[i]] * gains[0], g = DEC[data[i + 1]] * gains[1], b = DEC[data[i + 2]] * gains[2];
    Ls.push(yToLs(Math.min(1, 0.2126 * r + 0.7152 * g + 0.0722 * b)));
    toLab(Math.min(1, r), Math.min(1, g), Math.min(1, b), lab);
    if(lab[0] > 0.25 && lab[0] < 0.9) Cs.push(Math.hypot(lab[1], lab[2]));
  }
  Ls.sort((a, b) => a - b);
  const q = f => Ls.length ? Ls[Math.min(Ls.length - 1, Math.floor(f * Ls.length))] : 0.5;
  const p1 = q(0.01), p50 = q(0.5), p99 = q(0.99), spread = p99 - p1;
  const brightness = Math.round(clampN((0.48 - p50) / 0.3 * 100 * 0.8, -40, 40));
  const contrast = Math.round(spread < 0.86 ? clampN((0.86 - spread) / 0.86 * 120, 0, 45) : 0);
  const cMean = Cs.length ? Cs.reduce((a, b) => a + b, 0) / Cs.length : 0.06;
  const vib = +clampN((0.07 - cMean) / 0.07 * 0.45, 0, 0.3).toFixed(3);
  return { gains, brightness, contrast, vib };
}

function applyPremiumAuto(data, w, h, P, fast = false){
  const [gr, gg, gb] = P.gains || [1, 1, 1], vib = P.vib || 0;
  const lab = [0, 0, 0];
  if(gr !== 1 || gg !== 1 || gb !== 1 || vib){
    applyColorMap(data, (R, G, B, rgb) => {
      const r = DEC[R] * gr, g = DEC[G] * gg, b = DEC[B] * gb;
      if(!vib){ rgb[0] = r; rgb[1] = g; rgb[2] = b; }
      else {
        toLab(Math.max(0, r), Math.max(0, g), Math.max(0, b), lab);
        const C = Math.hypot(lab[1], lab[2]), k = 1 + vib * Math.max(0, 1 - C / 0.18);
        toRgb(lab[0], lab[1] * k, lab[2] * k, rgb);
      }
      const Y = Math.max(0, Math.min(1, 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]));
      return Y;
    }, { fast });
  }
  if(P.brightness || P.contrast) applyBCPremium(data, w, h, { brightness: P.brightness, contrast: P.contrast, protect: 100, pivot: "auto" });
}

export async function autoEnhancePremium(opts = {}){
  const hasP = p => p && Array.isArray(p.gains);
  if(opts.render){
    const src = opts.render.src, w = src.width, h = src.height;
    const d = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h);
    const P = hasP(opts.init) ? opts.init : measurePremium(d.data, w, h);
    applyPremiumAuto(d.data, w, h, P);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").putImageData(d, 0, 0);
    return c;
  }
  const layer = opts.edit || activeLayer();
  if(!layer || !layer.canvas){ toast("No hay capa activa"); return; }
  if(layer.locked){ toast("La capa está bloqueada"); return; }
  const params = {};
  return applyDirect("Mejora automática Premium", (data, w, h) => {
    Object.assign(params, measurePremium(data, w, h));
    applyPremiumAuto(data, w, h, params);
  }, { asLayer: true, filterId: "auto-premium", filterParams: params }, opts.edit ? { edit: opts.edit } : {});
}
