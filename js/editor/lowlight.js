/* ═══════════════════════════════════════════════════════════════
   ILUMINAR FOTO OSCURA
   Ajustes › Automáticos y pestaña «Automáticos» del cajón. Método
   clásico de mapa de iluminación (tipo LIME/Retinex), sin modelos: se
   estima cuánta luz llega a cada zona —el canal más brillante,
   suavizado— y se levanta cada zona según su propia luz, así las
   sombras se abren y lo que ya estaba bien iluminado apenas cambia.
   Automático: la cantidad se calcula para que la luz media de la foto
   llegue a un nivel natural; «Intensidad» la gradúa (60 = automático).

   Premium 👑 («el bueno y el mejor»):
     · Bueno: en luz lineal y conservando la proporción entre canales
       (el tono y la saturación no se desplazan al aclarar), con el
       mapa de luz afinado por un filtro guiado: ni halos en los bordes
       ni zonas planas.
     · Mejor: el ruido de color que aparece al levantar sombras se
       limpia en proporción a lo que se ha aclarado cada punto, y la
       salida se trama para que los degradados no hagan escalones.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, slider, pickerGroup } from "./adjust.js";
import { premiumSwitch, premiumPref } from "../ui/premium.js";
import { isMobile } from "../core/device.js";
import { boxBlurFloat, guidedFilterAlpha } from "./refineedge-math.js";

const DEC = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; DEC[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
const enc = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
const hash = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

/* Exponente de la curva de luz: el automático lleva la mediana del mapa
   de luz (en valores codificados) a ≈ 0,42; `amount` lo gradúa */
function exponent(T, amount){
  const s = [];
  for(let i = 0; i < T.length; i += 5) s.push(T[i]);
  s.sort((a, b) => a - b);
  const med = Math.min(0.9, Math.max(0.02, s[s.length >> 1]));
  const auto = med >= 0.42 ? 1 : Math.log(0.42) / Math.log(med);   // < 1 aclara
  return Math.max(0.2, Math.min(1, 1 - (1 - auto) * amount / 60));
}

/* Básico: en valores codificados, mapa de luz con desenfoque de caja */
function basic(d, w, h, p){
  const n = w * h, T = new Float32Array(n);
  for(let i = 0, j = 0; i < n; i++, j += 4) T[i] = Math.max(d[j], d[j + 1], d[j + 2]) / 255;
  const r = Math.max(2, Math.round(Math.max(w, h) / 80));
  const L = boxBlurFloat(boxBlurFloat(T, w, h, r), w, h, r);
  const e = exponent(L, p.amount);
  if(e >= 0.999) return;
  for(let i = 0, j = 0; i < n; i++, j += 4){
    const t = Math.max(0.03, L[i]), g = Math.min(6, Math.pow(t, e) / t);
    d[j] = Math.min(255, d[j] * g); d[j + 1] = Math.min(255, d[j + 1] * g); d[j + 2] = Math.min(255, d[j + 2] * g);
  }
}

/* Premium: luz lineal, mapa guiado, ruido de color y tramado */
function premium(d, w, h, p){
  const n = w * h, R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n);
  const T = new Float32Array(n), Y = new Float32Array(n);
  for(let i = 0, j = 0; i < n; i++, j += 4){
    R[i] = DEC[d[j]]; G[i] = DEC[d[j + 1]]; B[i] = DEC[d[j + 2]];
    // El mapa, en valores codificados (perceptual) para que el suavizado
    // y la curva se repartan bien en las sombras
    T[i] = Math.max(d[j], d[j + 1], d[j + 2]) / 255;
    Y[i] = (0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]) / 255;
  }
  const r = Math.max(2, Math.round(Math.max(w, h) / 80));
  const coarse = boxBlurFloat(boxBlurFloat(T, w, h, r), w, h, r);
  // Filtro guiado: la luz sigue los bordes de la foto (sin halos)
  const L = guidedFilterAlpha(Y, coarse, w, h, r, 0.004);
  const e = exponent(L, p.amount);
  if(e >= 0.999) return;
  const gain = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const t = Math.min(1, Math.max(0.02, L[i])), tc = Math.pow(t, e);
    // Ganancia en luz lineal equivalente a subir la luz de t a t^e
    gain[i] = Math.min(24, DEC[Math.round(tc * 255)] / Math.max(1e-4, DEC[Math.round(t * 255)]));
  }
  for(let i = 0; i < n; i++){
    let rr = R[i] * gain[i], gg = G[i] * gain[i], bb = B[i] * gain[i];
    // Si un canal se sale, se escala el trío entero (sin virar el color)
    const m = Math.max(rr, gg, bb);
    if(m > 1){ const k = 1 / m, soft = (m - 1) / m; rr = rr * k + (1 - rr * k) * soft * 0.35; gg = gg * k + (1 - gg * k) * soft * 0.35; bb = bb * k + (1 - bb * k) * soft * 0.35; }
    R[i] = rr; G[i] = gg; B[i] = bb;
  }
  // Punto negro: al levantar las sombras el negro se vuelve gris; se
  // devuelve al nivel que tenía la foto (contraste sin lavar)
  const p0 = [], p1 = [];
  for(let i = 0, j = 0; i < n; i += 7, j += 28){ p0.push(0.2126 * DEC[d[j]] + 0.7152 * DEC[d[j + 1]] + 0.0722 * DEC[d[j + 2]]); p1.push(0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i]); }
  p0.sort((a, b) => a - b); p1.sort((a, b) => a - b);
  const q = Math.max(0, (p0.length * 0.005) | 0), bl = Math.max(0, p1[q] - p0[q]);
  if(bl > 0) for(let i = 0; i < n; i++){ R[i] = Math.max(0, (R[i] - bl) / (1 - bl)); G[i] = Math.max(0, (G[i] - bl) / (1 - bl)); B[i] = Math.max(0, (B[i] - bl) / (1 - bl)); }
  // Ruido de color en las sombras levantadas: se suaviza la crominancia
  // según lo que se ha aclarado cada punto (la luminancia no se toca)
  const cr = Math.max(1, Math.round(Math.max(w, h) / 600));
  const Yl = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n);
  for(let i = 0; i < n; i++){ Yl[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i]; Cb[i] = B[i] - Yl[i]; Cr[i] = R[i] - Yl[i]; }
  let sCb = Cb, sCr = Cr;
  for(let t = 0; t < 2; t++){ sCb = boxBlurFloat(sCb, w, h, cr); sCr = boxBlurFloat(sCr, w, h, cr); }
  for(let i = 0, j = 0; i < n; i++, j += 4){
    const a = Math.min(1, Math.max(0, (gain[i] - 1.3) / 3));
    // …y se le devuelve algo de viveza (una sombra aclarada se ve apagada)
    const v = 1 + 0.25 * Math.min(1, Math.max(0, (gain[i] - 1) / 3));
    const cb = (Cb[i] + (sCb[i] - Cb[i]) * a) * v, crr = (Cr[i] + (sCr[i] - Cr[i]) * a) * v;
    const rr = Yl[i] + crr, bb = Yl[i] + cb, gg = (Yl[i] - 0.2126 * rr - 0.0722 * bb) / 0.7152;
    const nz = (hash(i) - 0.5) * 0.9;
    d[j] = enc(rr) + nz; d[j + 1] = enc(gg) + nz; d[j + 2] = enc(bb) + nz;
  }
}

export function lowLight(opts = {}){
  const p = { amount: 60, premium: opts.premium !== undefined ? !!opts.premium : opts.init ? false : premiumPref.get("lowLight"), ...opts.init };
  return runAdjust({
    title: "Iluminar foto oscura", asLayer: true, filterId: "low-light", filterParams: p, previewLimit: 4e5,
    compute: (d, w, h) => (p.premium ? premium : basic)(d, w, h, p),
    buildBody: ({ preview }) => {
      const b = document.createElement("div");
      b.appendChild(pickerGroup([{ label: "Intensidad", node: slider("Intensidad", 0, 100, p.amount, v => { p.amount = v; preview(); }, "%") }]));
      const sw = premiumSwitch({ checked: p.premium, title: "Iluminar de alta calidad: luz lineal sin virar los colores, sin halos, limpieza del ruido de color de las sombras y tramado (función Premium)",
        onChange: on => { p.premium = on; premiumPref.set("lowLight", on); preview(); } });
      sw.classList.add("adj-premium");
      if(isMobile()){ sw.classList.add("ps-docked"); b.footStart = sw; } else b.prepend(sw);
      preview();
      return b;
    }
  }, opts);
}
/* Entrada «Premium 👑» del menú y del cajón: el mismo diálogo, con el interruptor ya encendido */
export const lowLightPremium = (opts = {}) => lowLight({ ...opts, premium: true });
