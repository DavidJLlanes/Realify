/* ═══════════════════════════════════════════════════════════════
   adjustments · levels
   Parte de js/editor/adjust/adjustments.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { premiumPref, premiumSwitch } from "../../../ui/kit/premium.js";
import { runAdjust, applyLut, drawHistogram, slider, identityLut } from "../adjust.js";
import { applyLevelsPremium, autoLevelsState } from "../tonepremium.js";
import { doc } from "../../../core/doc.js";
import { isMobile } from "../../../core/device.js";
import { clamp255 } from "./common.js";

/* ── niveles ──────────────────────────────────────────────────── */
/* Un estado POR CANAL —como en Curvas—, no uno compartido: si no, al
   cambiar de canal en el desplegable los mandos siguen mostrando y
   editando los valores del canal anterior, porque no hay dónde
   guardar los del que se acaba de dejar. Ajustar Rojo y pasar a Verde
   parecía "arrastrar" el ajuste de Rojo a Verde, y en realidad era
   sencillamente que nunca había habido dos ajustes distintos que
   guardar. El maestro (RGB) se compone POR ENCIMA de cada canal, en
   el mismo orden que ya usa Curvas y que es el de Photoshop. */
const mkLevelState = () => ({ inLow:0, inHigh:255, gamma:1, outLow:0, outHigh:255 });

export function levels(opts = {}){
  // Una capa ya hecha conserva su motor; un ajuste nuevo, la última elección
  const state = { channel:"rgb", premium: opts.init ? !!opts.init.premium : premiumPref.get("levels"),
                  ch: { rgb:mkLevelState(), r:mkLevelState(), g:mkLevelState(), b:mkLevelState() } };
  if(opts.init?.ch) for(const k of ["rgb","r","g","b"]) Object.assign(state.ch[k], opts.init.ch[k] || {});

  return runAdjust({
    title: "Niveles",
    wide: true,
    asLayer: true, filterId: "levels", filterParams: state,
    float: () => !state.premium,
    compute(data, w, h){
      if(state.premium){ applyLevelsPremium(data, state, { fast: w * h < doc.w * doc.h * 0.98 }); return; }
      const lut = buildLevelsByChannel(state);
      applyLut(data, lut);
    },
    buildBody({ hist, preview, source }){
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="field"><label>Canal</label>
          <select class="grow" id="lvCh">
            <option value="rgb">RGB</option>
            <option value="r">Rojo</option>
            <option value="g">Verde</option>
            <option value="b">Azul</option>
          </select></div>
        <canvas id="lvHist" width="512" height="110"
          style="width:100%;border:1px solid var(--line-soft);border-radius:var(--r);
                 display:block;margin:4px 0 8px"></canvas>
        <div class="section-label">Entrada</div>
        <div id="lvIn"></div>
        <div class="section-label">Salida</div>
        <div id="lvOut"></div>
        <button id="lvAuto" class="wide" style="margin-top:8px">Automático</button>`;

      const cv = box.querySelector("#lvHist");
      const paint = () => drawHistogram(cv, hist, state.channel === "rgb" ? "rgb" : state.channel);
      paint();

      const inBox = box.querySelector("#lvIn");
      const sLow  = slider("Negro", 0, 254, 0, v => {
        const p = state.ch[state.channel];
        p.inLow = Math.min(v, p.inHigh - 1); preview(); });
      const sGam  = slider("Gamma", 10, 300, 100, v => {
        state.ch[state.channel].gamma = v / 100; preview(); }, "%");
      const sHigh = slider("Blanco", 1, 255, 255, v => {
        const p = state.ch[state.channel];
        p.inHigh = Math.max(v, p.inLow + 1); preview(); });
      inBox.append(sLow, sGam, sHigh);

      const outBox = box.querySelector("#lvOut");
      const sOutLow  = slider("Negro", 0, 254, 0, v => { state.ch[state.channel].outLow = v; preview(); });
      const sOutHigh = slider("Blanco", 1, 255, 255, v => { state.ch[state.channel].outHigh = v; preview(); });
      outBox.append(sOutLow, sOutHigh);

      // Al cambiar de canal, los cinco mandos pasan a mostrar y editar
      // los valores YA GUARDADOS de ese canal — nunca los del anterior.
      const syncControls = () => {
        const p = state.ch[state.channel];
        sLow.setValue(p.inLow);
        sGam.setValue(Math.round(p.gamma * 100));
        sHigh.setValue(p.inHigh);
        sOutLow.setValue(p.outLow);
        sOutHigh.setValue(p.outHigh);
        paint();
      };

      box.querySelector("#lvCh").addEventListener("change", e => {
        state.channel = e.target.value; syncControls();
      });
      syncControls();

      /* Automático: recorta el 0,1 % de cada extremo y estira, sobre
         el histograma DEL CANAL ACTIVO (antes siempre era la
         luminancia general, incluso ajustando Rojo o Azul). Sin ese
         recorte, un solo píxel perdido a negro o a blanco anula el
         ajuste entero. */
      /* Premium: el automático mide los colores más oscuros y más claros
         de la foto y ajusta los tres canales y los medios de una vez
         (tonepremium.js › autoLevelsState). */
      box.querySelector("#lvAuto").addEventListener("click", () => {
        if(state.premium && source){
          const k = Math.min(1, 800 / Math.max(source.width, source.height)), c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(source.width * k)); c.height = Math.max(1, Math.round(source.height * k));
          const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(source, 0, 0, c.width, c.height);
          const auto = autoLevelsState(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
          for(const ch of ["rgb", "r", "g", "b"]) Object.assign(state.ch[ch], auto.ch[ch]);
          syncControls(); preview();
          return;
        }
        const arr = state.channel === "rgb" ? hist.l : hist[state.channel];
        let total = 0;
        for(let i = 0; i < 256; i++) total += arr[i];
        const cut = total * 0.001;
        let acc = 0, lo = 0, hi = 255;
        for(let i = 0; i < 256; i++){ acc += arr[i]; if(acc > cut){ lo = i; break; } }
        acc = 0;
        for(let i = 255; i >= 0; i--){ acc += arr[i]; if(acc > cut){ hi = i; break; } }
        const p = state.ch[state.channel];
        p.inLow = lo; p.inHigh = Math.max(lo + 1, hi); p.gamma = 1;
        syncControls();
        preview();
      });

      const sw = premiumSwitch({ checked: state.premium, title: "Niveles de alta calidad: coma flotante sin bandas, maestro sin cambiar el tono, automático que neutraliza dominantes (función Premium)",
        onChange: on => { state.premium = on; premiumPref.set("levels", on); preview(); } });
      sw.classList.add("adj-premium");
      if(isMobile()){ sw.classList.add("ps-docked"); box.footStart = sw; } else box.prepend(sw);
      return box;
    }
  }, opts);
}

/* Tabla de 256 entradas para un único canal (negro/blanco de entrada
   y salida, gamma). */
function levelLut(p){
  const f = levelFunction(p), t = new Uint8ClampedArray(256);
  for(let i = 0; i < 256; i++) t[i] = clamp255(f(i));
  return t;
}

/* Niveles como función continua de 0..255 (admite decimales): la tabla
   de arriba la muestrea en los enteros; la exportación de alta precisión
   (io/precision/precision-stack.js) la evalúa sin redondear. */
export function levelFunction(p){
  const span = Math.max(1, p.inHigh - p.inLow);
  const inv = 1 / p.gamma;
  return i => {
    let v = (i - p.inLow) / span;
    v = v <= 0 ? 0 : v >= 1 ? 1 : Math.pow(v, inv);
    return p.outLow + v * (p.outHigh - p.outLow);
  };
}

/* { r, g, b } en coma flotante, con la misma regla de canal que buildLevels */
export function levelsFunctions(p){
  const f = levelFunction(p), id = v => v;
  if(p.channel === "rgb") return { r:f, g:f, b:f };
  return { r: p.channel === "r" ? f : id, g: p.channel === "g" ? f : id, b: p.channel === "b" ? f : id };
}

/* Versión con memoria por canal, usada sólo por el diálogo «Niveles…»
   de arriba. El maestro (RGB) se compone ENCIMA de cada canal — mismo
   orden que Curvas y el que espera quien ya sabe usar niveles en
   Photoshop. */
function buildLevelsByChannel(state){
  const master = levelLut(state.ch.rgb);
  const lr = levelLut(state.ch.r), lg = levelLut(state.ch.g), lb = levelLut(state.ch.b);
  const r = new Uint8ClampedArray(256), g = new Uint8ClampedArray(256), b = new Uint8ClampedArray(256);
  for(let i = 0; i < 256; i++){
    r[i] = master[lr[i]]; g[i] = master[lg[i]]; b[i] = master[lb[i]];
  }
  return { r, g, b };
}

/* Versión de un solo canal ACTIVO a la vez (sin memoria de los
   demás), con la firma plana `{inLow,inHigh,gamma,outLow,outHigh,
   channel}`: la usan las capas de ajuste no destructivas
   (adjustlayers.js), cuyo panel simplificado ni siquiera tiene
   selector de canal — ahí "channel" es siempre "rgb" y no hace falta
   nada más que esto. No confundir con `buildLevelsByChannel`, que es
   la del diálogo completo del menú Ajustes. */
export function buildLevels(p){
  const t = levelLut(p);
  const id = identityLut();
  if(p.channel === "rgb") return { r:t, g:t, b:t };
  return { r: p.channel === "r" ? t : id,
           g: p.channel === "g" ? t : id,
           b: p.channel === "b" ? t : id };
}
