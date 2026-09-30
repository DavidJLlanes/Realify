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

     Diagnóstico común (autoanalysis.js) y, en este orden:
     1. Balance de blancos en luz lineal con la dominante estimada
        (gray-edge + grises iterativos, con confianza; el cálido y los
        colores dominantes de la escena se respetan en parte).
     2. Color: el croma sube más cuanto más apagado está el color y nada
        en los que ya son intensos (como Vibrance), menos si hay piel,
        en OKLab, con mapeo de gama y tramado (premiumcolor.js).
     3. Negro y blanco (Niveles maestros Premium), sin estirar lo ya
        quemado y con la ganancia limitada.
     4. Sombras / Iluminaciones Premium si hace falta: contraluz o mucha
        foto en negro; luces claras CON detalle (el blanco puro de un
        fondo no se «recupera»).
     5. Brillo y contraste Premium: exposición sólo fuera de la franja
        correcta (L* 36-64 en la mediana; la clave alta no se oscurece y
        la baja se aclara menos) y contraste sólo si la foto está plana.
   Los valores medidos se guardan en la capa de filtro («auto-premium»):
   volver a calcularla (aplicación parcial, cambios debajo) da siempre
   el mismo resultado; el doble clic en su «fx» vuelve a medir.
   ═══════════════════════════════════════════════════════════════ */
import { applyColorMap, toLab, toRgb, DEC } from "./premiumcolor.js";
import { applyBCPremium, applyShadowsHighlightsPremium } from "./adjustments.js";
import { sampleImage, estimateCast, lstar, toneStats, tonePlan, encF, decF } from "./autoanalysis.js";
import { applyLevelsPremium } from "./tonepremium.js";

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

/* Diagnóstico (autoanalysis.js) y valores de cada paso */
export function measurePremium(data, w, h){
  const S = sampleImage(data, w, h, 200000), cast = estimateCast(S), gains = cast.gains;
  // Punto negro y blanco (sin tocar lo ya quemado; ganancia limitada)
  const TP = tonePlan(toneStats(S, gains), { clip: 0.1, mid: 0 });
  const bk = TP.black, wt = TP.white, stretch = Y => decF(clampN((encF(Y) - bk) / Math.max(1e-3, wt - bk), 0, 1));
  const lab = [0, 0, 0], Ls = [];
  let cSum = 0, cN = 0, skin = 0, dark = 0, bright = 0, tot = 0;
  for(let i = 0; i < S.n; i++){
    if(!S.ok[i]) continue;
    let r = Math.min(1, S.R[i] * gains[0]), g = Math.min(1, S.G[i] * gains[1]), b = Math.min(1, S.B[i] * gains[2]);
    const Y0 = 0.2126 * r + 0.7152 * g + 0.0722 * b, Y = stretch(Y0), m = Y0 > 0 ? Y / Y0 : 1;
    r = Math.min(1, r * m); g = Math.min(1, g * m); b = Math.min(1, b * m);
    const L = lstar(Y);
    Ls.push(L); tot++;
    if(L < 0.2) dark++;
    if(L > 0.85 && L < 0.97 && !S.hi[i]) bright++;   // luces con detalle (no el blanco puro)
    if(i % 2) continue;
    toLab(r, g, b, lab);
    const C = Math.hypot(lab[1], lab[2]);
    if(lab[0] > 0.25 && lab[0] < 0.9){ cSum += C; cN++; }
    // Piel (cualquier tono de piel cae en esta franja de tono de OKLab)
    const hue = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
    if(hue > 20 && hue < 80 && C > 0.03 && C < 0.16 && lab[0] > 0.4 && lab[0] < 0.88) skin++;
  }
  Ls.sort((a, b) => a - b);
  const q = f => Ls.length ? Ls[Math.min(Ls.length - 1, Math.floor(f * Ls.length))] : 0.5;
  const p1 = q(0.01), p50 = q(0.5), p99 = q(0.99), spread = p99 - p1;
  tot = Math.max(1, tot);
  const darkFrac = dark / tot, brightFrac = bright / tot, clipFrac = S.hi.reduce((a, v) => a + v, 0) / S.valid;
  const skinFrac = skin / Math.max(1, tot / 2);
  // Exposición: sólo si está claramente mal (fuera de L* 36-64 en la
  // mediana), acercándola al borde de esa franja. Clave baja con luces
  // propias (noche, contraluz): aclarar menos y abrir sombras. Clave
  // alta (fondo blanco, nieve, producto): no se oscurece.
  const lowKey = p50 < 0.36 && (brightFrac + clipFrac) > 0.04;
  const highKey = p50 > 0.64 && (clipFrac > 0.01 || q(0.25) > 0.6);
  let brightness = 0;
  if(p50 < 0.36) brightness = clampN((0.42 - p50) / 0.3 * 100, 0, 55) * (lowKey ? 0.45 : 1);
  else if(p50 > 0.64 && !highKey) brightness = -clampN((p50 - 0.58) / 0.3 * 100, 0, 30);
  // Sombras: mucha foto en negro con algo de luz (contraluz, interiores)
  let shadows = darkFrac > 0.15 && p99 > 0.6 ? clampN((darkFrac - 0.15) / 0.35 * 50, 0, 40) : 0;
  if(lowKey) shadows = Math.max(shadows, 18);
  if(brightness > 20) shadows *= 0.6;
  // Luces: sólo si hay bastante zona clara CON detalle y la foto no es de clave alta
  const highlights = !highKey && brightFrac > 0.08 ? clampN((brightFrac - 0.08) / 0.25 * 45, 0, 35) : 0;
  // Contraste: sólo si la foto está plana (rango de tonos corto)
  let contrast = spread < 0.78 ? clampN((0.8 - spread) / 0.8 * 100, 0, 35) : 0;
  if(shadows || highlights) contrast = Math.min(35, contrast + (shadows + highlights) * 0.1);   // devolver el contraste local que se pierde
  const cMean = cN ? cSum / cN : 0.06;
  let vib = clampN((0.07 - cMean) / 0.07 * 0.45, 0, 0.3);
  vib *= 1 - clampN((skinFrac - 0.05) * 3, 0, 0.6);           // la piel no se satura
  return { gains, black: +(bk * 255).toFixed(1), white: +(wt * 255).toFixed(1), brightness: Math.round(brightness), contrast: Math.round(contrast), vib: +vib.toFixed(3),
           shadows: Math.round(shadows), highlights: Math.round(highlights) };
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
  // Punto negro y blanco (Niveles maestros Premium: sobre la intensidad de cada color)
  if(P.black > 0 || (P.white && P.white < 255)){
    const id = { inLow: 0, inHigh: 255, gamma: 1, outLow: 0, outHigh: 255 };
    applyLevelsPremium(data, { ch: { rgb: { ...id, inLow: P.black || 0, inHigh: P.white || 255 }, r: id, g: id, b: id } }, { fast });
  }
  // Sombras / Iluminaciones Premium con un entorno relativo al tamaño de la foto
  if(P.shadows || P.highlights)
    applyShadowsHighlightsPremium(data, w, h, { shadows: P.shadows || 0, highlights: P.highlights || 0, radius: Math.max(6, 0.035 * Math.max(w, h)), tone: 50 }, 1);
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
