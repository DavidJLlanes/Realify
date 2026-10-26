/* ═══════════════════════════════════════════════════════════════
   LOS AJUSTES
   Cada uno construye su tabla y deja que el esqueleto de adjust.js
   se ocupe de la vista previa, el historial y el cancelar.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../../core/doc.js";
import "../../ui/kit/wbpick.js";
import "../../core/view.js";
import "../../core/toast.js";
import { isMobile } from "../../core/device.js";
import { premiumSwitch, premiumPref } from "../../ui/kit/premium.js";
import { hslPremium } from "./hslpremium.js";
import { applyLevelsPremium, autoLevelsState, autoContrastState, levelsLuts } from "./tonepremium.js";
import { runAdjust, applyDirect, applyLut, slider, pickerGroup } from "./adjust.js";
import { CURVE_PRESETS } from "./curves.js";
import "./curvesfs.js";
import "./bwrecipes.js";
export { brightnessContrast, BC_DEFAULTS, bcControls, bcCurve, bcPivot, applyBC, applyBCPremium, applyShadowsHighlightsPremium, buildBC } from "./adjustments/brightness-contrast.js";
export { levels, levelFunction, levelsFunctions, buildLevels } from "./adjustments/levels.js";
export { curves } from "./adjustments/curves.js";
export { whiteBalance, sampleCanvas, wbEyedropper, wbGains, buildWB } from "./adjustments/white-balance.js";
export { grayscale } from "./adjustments/grayscale.js";

export { CURVE_PRESETS };

/* ── niveles automáticos ──────────────────────────────────────────
   Distinto del contraste automático: éste corrige también el color.
   Diagnóstico (autoanalysis.js › tonepremium.js › autoLevelsState):
   negro y blanco de cada canal con los colores más oscuros y más claros
   de verdad —sólo si son casi neutros; una lámpara amarilla o un mar
   azul profundo no se «corrigen»—, gamma de cada canal para que los
   medios neutros queden grises (con la confianza de la dominante
   detectada) y gamma maestra para la exposición. Sin estirar lo ya
   quemado y con la ganancia limitada. El normal lo aplica con tablas
   de 8 bits; el Premium, con el motor Premium. */
export function autoLevels(opts = {}){
  return applyDirect("Niveles automáticos", (data, w, h) => {
    const [r, g, b] = levelsLuts(autoLevelsState(data, w, h));
    applyLut(data, { r, g, b });
  }, { asLayer: true, filterId: "autoLevels", float: "delta" }, opts);
}

/* Niveles automáticos Premium 👑: mide la foto (tonepremium.js), aplica
   Niveles con el motor Premium y lo deja como una capa de filtro
   «Niveles» normal, así que el doble clic en su «fx» abre Niveles con
   esos valores para afinarlos. */
export function autoLevelsPremium(opts = {}){
  let state = null;
  const params = {};
  return applyDirect("Niveles automáticos Premium", (data, w, h) => {
    state = autoLevelsState(data, w, h);
    Object.assign(params, state);
    applyLevelsPremium(data, state);
  }, { asLayer: true, filterId: "levels", filterParams: params, float: "delta" }, opts);
}

/* ── tono y saturación ────────────────────────────────────────── */
export function hueSaturation(opts = {}){
  // Una capa ya hecha conserva su motor (sin `premium` guardado = normal);
  // un ajuste nuevo empieza con la última elección.
  const p = { hue: 0, sat: 0, light: 0, colorize: false, premium: opts.init ? false : premiumPref.get("hsl"), ...opts.init };

  return runAdjust({
    title: "Tono y saturación",
    asLayer: true, filterId: "hsl", filterParams: p,
    float: () => !p.premium,
    // Premium 👑: mismo ajuste en OKLCh, coma flotante, gama y tramado
    // (vista previa reducida → tabla interpolada; resultado final → exacto)
    previewLimit: 6e5,
    compute(data, w, h){ if(p.premium) hslPremium(data, p, { fast: w * h < doc.w * doc.h * 0.98 }); else hslShift(data, p); },
    buildBody({ preview }){
      const box = document.createElement("div");
      const sw = premiumSwitch({ checked: p.premium, title: "Tono y saturación de alta calidad: OKLCh, luz lineal, mapeo de gama y tramado (función Premium)",
        onChange: on => { p.premium = on; premiumPref.set("hsl", on); preview(); } });
      sw.classList.add("adj-premium");
      // Móvil: en la barra de Cancelar/Aplicar, a la izquierda (sin fila
      // propia: la imagen manda). Escritorio: encima de los mandos.
      if(isMobile()){ sw.classList.add("ps-docked"); box.footStart = sw; } else box.appendChild(sw);
      box.appendChild(pickerGroup([
        { label: "Tono", node: slider("Tono", -180, 180, p.hue, v => { p.hue = v; preview(); }, "°") },
        { label: "Saturación", node: slider("Saturación", -100, 100, p.sat, v => { p.sat = v; preview(); }) },
        { label: "Luminosidad", node: slider("Luminosidad", -100, 100, p.light, v => { p.light = v; preview(); }) }
      ]));
      const c = document.createElement("label");
      c.className = "chk";
      c.innerHTML = `<input type="checkbox"${p.colorize ? " checked" : ""}> Colorear (teñir toda la imagen de un tono)`;
      c.querySelector("input").addEventListener("change", e => {
        p.colorize = e.target.checked; preview();
      });
      box.appendChild(c);
      return box;
    }
  }, opts);
}

export function hslShift(data, p){
  const hueShift = p.hue / 360;
  const satF = 1 + p.sat / 100;
  const liF = p.light / 100;
  for(let i = 0; i < data.length; i += 4){
    let [h, s, l] = rgbToHsl(data[i], data[i+1], data[i+2]);
    if(p.colorize){ h = (p.hue + 360) / 360 % 1; s = Math.max(0, Math.min(1, (p.sat + 100) / 200)); }
    else { h = (h + hueShift + 1) % 1; s = Math.max(0, Math.min(1, s * satF)); }
    // Aclarar hacia el blanco y oscurecer hacia el negro, no sumando
    // sin más: sumar aplasta las luces contra el techo.
    l = liF >= 0 ? l + (1 - l) * liF : l * (1 + liF);
    const [r, g, b] = hslToRgb(h, s, Math.max(0, Math.min(1, l)));
    data[i] = r; data[i+1] = g; data[i+2] = b;
  }
}

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

/* ── de un solo paso ──────────────────────────────────────────── */
export function invert(opts = {}){
  return applyDirect("Invertir", data => {
    for(let i = 0; i < data.length; i += 4){
      data[i] = 255 - data[i];
      data[i+1] = 255 - data[i+1];
      data[i+2] = 255 - data[i+2];
    }
  }, { asLayer: true, filterId: "invert", float: true }, opts);
}

/* Contraste automático: sólo la luminancia, los tres canales por igual
   (no toca el balance de color). Diagnóstico en autoanalysis.js: negro y
   blanco por percentiles sin estirar lo que ya está quemado ni contar
   los brillos aislados (sol, reflejos), ganancia limitada para no
   amplificar el ruido y medios hacia el gris medio con la mitad de
   fuerza (respetando la clave baja). */
export function autoContrast(opts = {}){
  return applyDirect("Contraste automático", (data, w, h) => {
    const [t] = levelsLuts(autoContrastState(data, w, h));
    applyLut(data, { r:t, g:t, b:t });
  }, { asLayer: true, filterId: "autoContrast", float: "delta" }, opts);
}

/* Contraste automático Premium 👑: el mismo recorte de la luminancia,
   aplicado como Niveles maestros Premium (tonepremium.js): estira la
   intensidad de cada color sin cambiar su tono ni su saturación. Queda
   como capa de filtro «Niveles» reeditable. */
export function autoContrastPremium(opts = {}){
  const params = {};
  return applyDirect("Contraste automático Premium", (data, w, h) => {
    const state = autoContrastState(data, w, h);
    Object.assign(params, state);
    applyLevelsPremium(data, state);
  }, { asLayer: true, filterId: "levels", filterParams: params, float: "delta" }, opts);
}
