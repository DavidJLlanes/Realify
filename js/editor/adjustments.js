/* ═══════════════════════════════════════════════════════════════
   LOS AJUSTES
   Cada uno construye su tabla y deja que el esqueleto de adjust.js
   se ocupe de la vista previa, el historial y el cancelar.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../core/doc.js";
import { runAdjust, applyDirect, applyLut, identityLut,
         drawHistogram, slider, histogram, pickerGroup } from "./adjust.js";
import { curveEditor, curveLut } from "./curves.js";
import { BW_RECIPES, applyBWRecipe } from "./bwrecipes.js";

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

/* ── brillo y contraste ───────────────────────────────────────── */
export function brightnessContrast(opts = {}){
  const p = { brightness: 0, contrast: 0, useLegacy: false, ...opts.init };

  return runAdjust({
    title: "Brillo y contraste",
    asLayer: true, filterId: "bc", filterParams: p, dlgCls: "dlg-compact",
    compute(data){
      const lut = buildBC(p);
      applyLut(data, { r: lut, g: lut, b: lut });
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.appendChild(pickerGroup([
        { label: "Brillo", node: slider("Brillo", -100, 100, p.brightness, v => { p.brightness = v; preview(); }) },
        { label: "Contraste", node: slider("Contraste", -100, 100, p.contrast, v => { p.contrast = v; preview(); }) }
      ]));
      const note = document.createElement("p");
      note.className = "hint";
      note.style.marginTop = "10px";
      note.textContent = "El contraste pivota sobre el gris medio, así que sube las " +
        "luces y baja las sombras a la vez sin desplazar el punto medio.";
      box.appendChild(note);
      return box;
    }
  }, opts);
}

export function buildBC({ brightness, contrast }){
  const t = new Uint8ClampedArray(256);
  const b = brightness * 1.28;                 // -128..128
  const c = contrast;
  /* Dos ramas, porque las dos direcciones piden cosas distintas.
     Subiendo, la fórmula clásica: crece de forma no lineal para que
     el extremo del deslizador siga siendo útil en vez de saturarlo
     todo a mitad de recorrido.
     Bajando, un factor lineal hasta cero, de modo que -100 deje la
     imagen realmente plana en gris medio. La fórmula clásica aplicada
     a la baja se queda en un factor 0.44 —un rango de 72 a 184— y el
     final del recorrido no hace lo que uno espera que haga. */
  const f = c >= 0
    ? (259 * (c + 255)) / (255 * (259 - c))
    : 1 + c / 100;
  for(let i = 0; i < 256; i++){
    // El brillo se suma DESPUÉS del contraste, no dentro de la misma
    // multiplicación: si no, subir el contraste amplifica también el
    // brillo ya aplicado —o lo aplasta si el contraste baja—, y dos
    // deslizadores que deberían ser independientes quedan acoplados.
    // Con contraste +100 y brillo +50, la versión acoplada llevaba el
    // gris medio directamente a blanco puro; así se queda en un
    // desplazamiento de brillo razonable, sea cual sea el contraste.
    t[i] = clamp255(f * (i - 128) + 128 + b);
  }
  return t;
}

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
  const state = { channel:"rgb", ch: { rgb:mkLevelState(), r:mkLevelState(), g:mkLevelState(), b:mkLevelState() } };
  if(opts.init?.ch) for(const k of ["rgb","r","g","b"]) Object.assign(state.ch[k], opts.init.ch[k] || {});

  return runAdjust({
    title: "Niveles",
    wide: true,
    asLayer: true, filterId: "levels", filterParams: state,
    compute(data){
      const lut = buildLevelsByChannel(state);
      applyLut(data, lut);
    },
    buildBody({ hist, preview }){
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
      box.querySelector("#lvAuto").addEventListener("click", () => {
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

      return box;
    }
  }, opts);
}

/* Tabla de 256 entradas para un único canal (negro/blanco de entrada
   y salida, gamma). */
function levelLut(p){
  const t = new Uint8ClampedArray(256);
  const span = Math.max(1, p.inHigh - p.inLow);
  const inv = 1 / p.gamma;
  for(let i = 0; i < 256; i++){
    let v = (i - p.inLow) / span;
    v = v <= 0 ? 0 : v >= 1 ? 1 : Math.pow(v, inv);
    t[i] = clamp255(p.outLow + v * (p.outHigh - p.outLow));
  }
  return t;
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

/* ── curvas ───────────────────────────────────────────────────── */
export function curves(opts = {}){
  const state = {
    channel: "rgb",
    points: { rgb:[[0,0],[255,255]], r:[[0,0],[255,255]],
              g:[[0,0],[255,255]], b:[[0,0],[255,255]] }
  };
  if(opts.init?.points) for(const k of ["rgb","r","g","b"])
    if(Array.isArray(opts.init.points[k])) state.points[k] = opts.init.points[k].map(pt => [pt[0], pt[1]]);

  return runAdjust({
    title: "Curvas",
    wide: true,
    asLayer: true, filterId: "curves", filterParams: state,
    compute(data){
      const master = curveLut(state.points.rgb);
      const lr = curveLut(state.points.r);
      const lg = curveLut(state.points.g);
      const lb = curveLut(state.points.b);
      // El maestro se aplica encima del canal, que es el orden de
      // Photoshop y el que espera quien ya sabe usar curvas.
      const r = new Uint8ClampedArray(256), g = new Uint8ClampedArray(256),
            b = new Uint8ClampedArray(256);
      for(let i = 0; i < 256; i++){
        r[i] = master[lr[i]]; g[i] = master[lg[i]]; b[i] = master[lb[i]];
      }
      applyLut(data, { r, g, b });
    },
    buildBody({ hist, preview }){
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="field"><label>Canal</label>
          <select class="grow" id="cvCh">
            <option value="rgb">RGB</option>
            <option value="r">Rojo</option>
            <option value="g">Verde</option>
            <option value="b">Azul</option>
          </select></div>`;
      const ed = curveEditor({
        getPoints: () => state.points[state.channel],
        setPoints: pts => { state.points[state.channel] = pts; preview(); },
        hist,
        channel: () => state.channel
      });
      box.appendChild(ed.el);

      const row = document.createElement("div");
      row.className = "seg";
      row.style.marginTop = "8px";
      row.innerHTML = `<button data-p="reset">Restablecer</button>
                       <button data-p="scurve">Curva en S</button>
                       <button data-p="fade">Desvanecido</button>`;
      row.addEventListener("click", e => {
        const b = e.target.closest("[data-p]");
        if(!b) return;
        const k = b.dataset.p;
        state.points[state.channel] =
          k === "scurve" ? [[0,0],[64,48],[192,208],[255,255]]
        : k === "fade"   ? [[0,24],[255,235]]
        :                  [[0,0],[255,255]];
        ed.refresh(); preview();
      });
      box.appendChild(row);

      const note = document.createElement("p");
      note.className = "hint";
      note.style.marginTop = "10px";
      note.textContent = "Clic para añadir un punto, arrastrar para moverlo, " +
        "clic derecho o doble clic para quitarlo.";
      box.appendChild(note);

      box.querySelector("#cvCh").addEventListener("change", e => {
        state.channel = e.target.value;
        ed.refresh();
      });
      return box;
    }
  }, opts);
}

/* ── balance de blancos ───────────────────────────────────────── */
export function whiteBalance(opts = {}){
  const p = { temp: 0, tint: 0, ...opts.init };

  return runAdjust({
    title: "Balance de blancos",
    asLayer: true, filterId: "whiteBalance", filterParams: p,
    compute(data){
      const lut = buildWB(p);
      applyLut(data, lut);
    },
    buildBody({ preview, source }){
      const box = document.createElement("div");
      const l = source ? { canvas: source } : activeLayer();

      /* Dos miniaturas del mismo tamaño y en la misma posición:

         - `srcThumb` guarda la imagen ORIGINAL y no se dibuja nunca.
           Es de donde lee el cuentagotas, porque el punto que el
           usuario señala como gris lo señala sobre la foto tal cual
           está, no sobre una ya corregida (si no, cada clic corregiría
           sobre lo ya corregido y el ajuste se dispararía).

         - `thumb` es la que se ve, y se repinta con el balance puesto
           cada vez que cambia algo. Antes era una copia fija del
           original: se quedaba congelada mientras se movían los
           deslizadores, y como el diálogo tapa el lienzo, la
           sensación era que la vista previa no funcionaba. */
      const thumbW = 300;
      const thumbH = Math.max(1, Math.round(thumbW * doc.h / doc.w));

      const srcThumb = document.createElement("canvas");
      srcThumb.width = thumbW; srcThumb.height = thumbH;
      const stx = srcThumb.getContext("2d", { willReadFrequently: true });
      if(l) stx.drawImage(l.canvas, 0, 0, thumbW, thumbH);
      const srcData = stx.getImageData(0, 0, thumbW, thumbH);

      const thumb = document.createElement("canvas");
      thumb.width = thumbW; thumb.height = thumbH;
      thumb.style.cssText =
        "width:100%;border-radius:var(--r);cursor:crosshair;display:block;margin-bottom:9px";
      const tx = thumb.getContext("2d");
      const shown = new ImageData(new Uint8ClampedArray(srcData.data.length), thumbW, thumbH);

      const paintThumb = () => {
        shown.data.set(srcData.data);
        applyLut(shown.data, buildWB(p));
        tx.putImageData(shown, 0, 0);
      };
      paintThumb();
      box.appendChild(thumb);
      box.onPreview = paintThumb;

      const hint = document.createElement("p");
      hint.className = "hint";
      hint.style.margin = "0 0 10px";
      hint.textContent = "Toca una zona que debería ser gris o blanca neutros " +
        "(una pared, una camisa blanca) para calcular el balance a partir de ahí.";
      box.appendChild(hint);

      const sTemp = slider("Temperatura", -100, 100, p.temp, v => { p.temp = v; preview(); });
      const sTint = slider("Tinte", -100, 100, p.tint, v => { p.tint = v; preview(); });
      box.appendChild(pickerGroup([
        { label: "Temperatura", node: sTemp },
        { label: "Tinte", node: sTint }
      ]));

      thumb.addEventListener("click", e => {
        const r = thumb.getBoundingClientRect();
        const x = Math.max(0, Math.min(thumbW - 1, Math.round((e.clientX - r.left) / r.width * thumbW)));
        const y = Math.max(0, Math.min(thumbH - 1, Math.round((e.clientY - r.top) / r.height * thumbH)));
        const i = (y * thumbW + x) * 4;
        const d = srcData.data;
        const { temp, tint } = grayPointToWB(d[i], d[i+1], d[i+2]);
        p.temp = temp; p.tint = tint;
        sTemp.setValue(temp); sTint.setValue(tint);
        preview();
        paintThumb();
      });

      return box;
    }
  }, opts);
}

/* Modelo multiplicativo sencillo: la temperatura mueve rojo y azul en
   direcciones opuestas, el tinte mueve el verde frente a los otros
   dos. No es la adaptación cromática completa de un revelador de RAW,
   pero para corregir un tono dominante es más que suficiente y es
   trivialmente invertible, que es lo que hace falta para el
   cuentagotas de abajo. */
export function buildWB({ temp, tint }){
  const t = temp / 100, g = tint / 100;
  const rGain = 1 + t * 0.4;
  const bGain = 1 - t * 0.4;
  const gGain = 1 - g * 0.25;
  const mk = gain => { const a = new Uint8ClampedArray(256);
    for(let i = 0; i < 256; i++) a[i] = clamp255(i * gain); return a; };
  return { r: mk(rGain), g: mk(gGain), b: mk(bGain) };
}

/* Deshace el modelo anterior: a partir de un píxel que debería ser
   gris, calcula qué temperatura/tinte lo dejarían neutro respecto a
   su propio brillo (para no aclarar ni oscurecer la imagen, sólo
   corregir el tono). */
function grayPointToWB(r, g, b){
  const l = (r + g + b) / 3 || 1;
  // rGain = 1+t·0.4 = l/r  →  t = (l/r − 1)/0.4
  // bGain = 1−t·0.4 = l/b  →  t = (1 − l/b)/0.4
  // Las dos estimaciones de t no tienen por qué coincidir si el punto
  // elegido no era perfectamente neutro; se promedian para repartir
  // el error entre los dos canales en vez de fiarlo todo a uno.
  const tFromR = ((l / Math.max(1, r)) - 1) / 0.4;
  const tFromB = (1 - (l / Math.max(1, b))) / 0.4;
  const tAvg = (tFromR + tFromB) / 2;
  const gFromG = (1 - (l / Math.max(1, g))) / 0.25;
  return {
    temp: Math.round(clamp1(tAvg) * 100),
    tint: Math.round(clamp1(gFromG) * 100)
  };
}
const clamp1 = v => Math.max(-1, Math.min(1, v));

/* ── niveles automáticos ──────────────────────────────────────────
   Distinto del contraste automático: éste estira cada canal R, G y B
   por separado. Si la imagen tiene una dominante de color, esto la
   neutraliza sola; el contraste automático (más arriba) sólo mira el
   brillo y por diseño no toca el balance de color. */
export function autoLevels(opts = {}){
  return applyDirect("Niveles automáticos", (data, w, h) => {
    const cut = w * h * 0.005;
    const stretchOf = ch => {
      const hist = new Uint32Array(256);
      for(let i = ch; i < data.length; i += 4) hist[data[i]]++;
      let acc = 0, lo = 0, hi = 255;
      for(let i = 0; i < 256; i++){ acc += hist[i]; if(acc > cut){ lo = i; break; } }
      acc = 0;
      for(let i = 255; i >= 0; i--){ acc += hist[i]; if(acc > cut){ hi = i; break; } }
      // Mismo criterio que en autoContrast: sólo rendirse si el canal
      // es de verdad plano (hi===lo), no simplemente estrecho.
      if(hi <= lo) return identityLut();
      const span = 255 / (hi - lo);
      const t = new Uint8ClampedArray(256);
      for(let i = 0; i < 256; i++) t[i] = clamp255((i - lo) * span);
      return t;
    };
    applyLut(data, { r: stretchOf(0), g: stretchOf(1), b: stretchOf(2) });
  }, { asLayer: true, filterId: "autoLevels" }, opts);
}

/* ── tono y saturación ────────────────────────────────────────── */
export function hueSaturation(opts = {}){
  const p = { hue: 0, sat: 0, light: 0, colorize: false, ...opts.init };

  return runAdjust({
    title: "Tono y saturación",
    asLayer: true, filterId: "hsl", filterParams: p,
    compute(data){ hslShift(data, p); },
    buildBody({ preview }){
      const box = document.createElement("div");
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

/* ── blanco y negro ───────────────────────────────────────────── */
export function grayscale(opts = {}){
  const p = { mode: "manual", r: 30, g: 59, b: 11, recipe: null, ...opts.init };
  if(p.recipe && p.recipe.name) p.recipe = BW_RECIPES.find(r => r.name === p.recipe.name) || p.recipe;

  return runAdjust({
    title: "Blanco y negro",
    wide: true,
    asLayer: true, filterId: "bw", filterParams: p,
    compute(data, w, h){
      if(p.mode === "auto"){
        applyBWRecipe(data, w, h, p.recipe || BW_RECIPES[0]);
        return;
      }
      // Los pesos se normalizan siempre: si suman más de 100 la
      // imagen se quema, y ese no es el trabajo de este ajuste.
      const t = p.r + p.g + p.b || 1;
      const wr = p.r / t, wg = p.g / t, wb = p.b / t;
      for(let i = 0; i < data.length; i += 4){
        const v = clamp255(data[i]*wr + data[i+1]*wg + data[i+2]*wb);
        data[i] = data[i+1] = data[i+2] = v;
      }
    },
    buildBody({ preview, source }){
      const layer = source ? { canvas: source } : activeLayer();
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="seg" id="bwMode" style="margin-bottom:10px">
          <button data-m="manual" class="on">Manual</button>
          <button data-m="auto">Automático</button>
        </div>
        <div id="bwManual"></div>
        <div id="bwAuto" hidden>
          <p class="hint" style="margin-top:0">Dieciocho conversiones inspiradas en otras tantas maneras
            de revelar en blanco y negro: cada una mezcla los canales, el contraste y el grano de
            forma distinta. Elige la que más se ajuste a esta foto.</p>
          <div id="bwGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px"></div>
          <p class="hint mono" id="bwNote" style="margin-top:8px"></p>
        </div>`;

      const manualBox = box.querySelector("#bwManual");
      const note = document.createElement("p");
      note.className = "hint";
      note.style.marginTop = "0";
      note.textContent = "Cuánto aporta cada color al gris. Bajar el azul oscurece " +
        "el cielo; subir el rojo aclara la piel. Es lo que hacían los filtros de " +
        "color sobre película en blanco y negro.";
      manualBox.appendChild(note);
      const sr = slider("Rojo", 0, 100, p.r, v => { p.r = v; preview(); }, "%");
      const sg = slider("Verde", 0, 100, p.g, v => { p.g = v; preview(); }, "%");
      const sb = slider("Azul", 0, 100, p.b, v => { p.b = v; preview(); }, "%");
      manualBox.append(sr, sg, sb);

      const presets = document.createElement("div");
      presets.className = "seg";
      presets.style.marginTop = "8px";
      presets.innerHTML = `<button data-v="30,59,11">Luminancia</button>
                           <button data-v="33,34,33">Plano</button>
                           <button data-v="60,28,12">Filtro rojo</button>
                           <button data-v="10,25,65">Filtro azul</button>`;
      presets.addEventListener("click", e => {
        const b = e.target.closest("[data-v]");
        if(!b) return;
        const [r, g, bl] = b.dataset.v.split(",").map(Number);
        p.r = r; p.g = g; p.b = bl;
        sr.setValue(r); sg.setValue(g); sb.setValue(bl);
        preview();
      });
      manualBox.appendChild(presets);

      // ── modo automático: rejilla de miniaturas ──────────────────
      const grid = box.querySelector("#bwGrid");
      const noteEl = box.querySelector("#bwNote");
      const S = 110;
      const thumb = document.createElement("canvas");
      thumb.width = S; thumb.height = S;
      const tx = thumb.getContext("2d", { willReadFrequently: true });
      const side = Math.min(doc.w, doc.h);
      tx.drawImage(layer.canvas, (doc.w - side) / 2, (doc.h - side) / 2, side, side, 0, 0, S, S);
      const baseData = tx.getImageData(0, 0, S, S);

      const cells = [];
      BW_RECIPES.forEach(recipe => {
        const cell = document.createElement("button");
        cell.style.cssText = "padding:0;display:flex;flex-direction:column;gap:4px;background:transparent;border:0";
        const cv = document.createElement("canvas");
        cv.width = S; cv.height = S;
        cv.style.cssText = "width:100%;border-radius:var(--r);border:2px solid var(--line);display:block";
        const cx = cv.getContext("2d");
        const img = new ImageData(new Uint8ClampedArray(baseData.data), S, S);
        applyBWRecipe(img.data, S, S, recipe);
        cx.putImageData(img, 0, 0);
        const label = document.createElement("span");
        label.textContent = recipe.name;
        label.style.cssText = "font-size:var(--fs-xs);color:var(--tx-dim);text-align:center";
        cell.append(cv, label);
        cell.addEventListener("click", () => {
          p.recipe = recipe;
          cells.forEach(c => c.style.borderColor = "var(--line)");
          cv.style.borderColor = "var(--ac)";
          noteEl.textContent = recipe.note;
          preview();
        });
        cell.cv = cv;
        cells.push(cell);
        grid.appendChild(cell);
      });

      box.querySelector("#bwMode").addEventListener("click", e => {
        const b = e.target.closest("[data-m]");
        if(!b) return;
        p.mode = b.dataset.m;
        box.querySelectorAll("#bwMode button").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        manualBox.hidden = p.mode !== "manual";
        box.querySelector("#bwAuto").hidden = p.mode !== "auto";
        if(p.mode === "auto" && !p.recipe){
          p.recipe = BW_RECIPES[0];
          cells[0].cv.style.borderColor = "var(--ac)";
          noteEl.textContent = BW_RECIPES[0].note;
        }
        preview();
      });

      // Estado de partida al reabrir: modo y receta ya elegidos
      if(p.mode === "auto"){
        const btn = box.querySelector('#bwMode [data-m="auto"]');
        box.querySelectorAll("#bwMode button").forEach(x => x.classList.remove("on"));
        btn.classList.add("on");
        manualBox.hidden = true;
        box.querySelector("#bwAuto").hidden = false;
        const idx = Math.max(0, BW_RECIPES.indexOf(p.recipe));
        p.recipe = BW_RECIPES[idx];
        cells[idx].cv.style.borderColor = "var(--ac)";
        noteEl.textContent = BW_RECIPES[idx].note;
      }

      return box;
    }
  }, opts);
}

/* ── de un solo paso ──────────────────────────────────────────── */
export function invert(opts = {}){
  return applyDirect("Invertir", data => {
    for(let i = 0; i < data.length; i += 4){
      data[i] = 255 - data[i];
      data[i+1] = 255 - data[i+1];
      data[i+2] = 255 - data[i+2];
    }
  }, { asLayer: true, filterId: "invert" }, opts);
}

export function autoContrast(opts = {}){
  return applyDirect("Contraste automático", (data, w, h) => {
    const hist = new Uint32Array(256);
    for(let i = 0; i < data.length; i += 4)
      hist[(data[i]*0.2126 + data[i+1]*0.7152 + data[i+2]*0.0722) | 0]++;
    const total = w * h;
    const cut = total * 0.002;
    let acc = 0, lo = 0, hi = 255;
    for(let i = 0; i < 256; i++){ acc += hist[i]; if(acc > cut){ lo = i; break; } }
    acc = 0;
    for(let i = 255; i >= 0; i--){ acc += hist[i]; if(acc > cut){ hi = i; break; } }
    /* Ojo con la lectura de este corte: un hi-lo PEQUEÑO es justo lo
       contrario de "ya ocupa todo el rango" —significa que casi todos
       los píxeles están apretados en una banda estrecha de luminancia,
       el caso típico de una foto plana o con neblina, que es EXACTAMENTE
       para lo que se usa este ajuste—. Sólo hace falta rendirse cuando
       hi===lo de verdad (un tono totalmente plano, sin nada que
       estirar); cualquier otra cosa, por estrecha que sea la banda,
       tiene contraste real que recuperar. Un umbral más alto aquí
       dejaba el ajuste sin hacer nada justo en las fotos que más lo
       necesitaban. */
    if(hi <= lo) return;
    const span = 255 / (hi - lo);
    const t = new Uint8ClampedArray(256);
    for(let i = 0; i < 256; i++) t[i] = clamp255((i - lo) * span);
    applyLut(data, { r:t, g:t, b:t });
  }, { asLayer: true, filterId: "autoContrast" }, opts);
}
