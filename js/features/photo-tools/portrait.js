/* ═══════════════════════════════════════════════════════════════
   photo-tools · portrait
   Parte de js/features/photo-tools.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { COARSE, isMobile } from "../../core/device.js";
import { emit } from "../../core/bus.js";
import { hiFullCover, applyDeltaFromBase, attachFloatResult } from "../../editor/render/floatfilter.js";
import { commitFilter, filterBase } from "../../editor/layers/filterlayer.js";
import { toast, status } from "../../core/toast.js";
import { dialog } from "../../ui/kit/dialog.js";
import { rasterLayer, wireCommon, sliderRow } from "./common.js";
import { clamp255 as clamp } from "../../core/util/math.js";
export { clamp };

/* Igual que PREVIEW_LIMIT en editor/adjust/adjust.js, pero más estricto: las
   tres funciones que pasan por `liveDialog` —corrección de lente,
   enfoque selectivo, retrato— son notablemente más caras por píxel
   que un simple recorrido de LUT (bilinear ×4, convolución 3×3, dos
   pasadas de desenfoque de caja de hasta 40 px), así que el límite
   general de 1,2 MP ya se nota en ellas, y en `pointer:coarse` se
   recorta más todavía. */
const LIVE_PREVIEW_LIMIT = COARSE ? 4e5 : 1.2e6;

export function canvasCopy(src){
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  c.getContext("2d", { colorSpace:"srgb" }).drawImage(src, 0, 0); return c;
}

export function restore(layer, canvas){
  layer.ctx.save(); layer.ctx.globalCompositeOperation = "copy";
  layer.ctx.drawImage(canvas, 0, 0); layer.ctx.restore();
  layer.thumbDirty = true; emit("doc:structure"); emit("doc:change");
}

/* El efecto se calcula sobre la capa activa para poder verlo, pero al
   confirmar se devuelve la capa a como estaba y el resultado se lleva
   a una capa nueva encima. Ver editor/layers/filterlayer.js. */
/* `float: "delta"` (fase 12, editor/render/floatfilter.js): el efecto es local y su cambio se suma a los 16 bits de
   la capa de origen si los trae (`source` = el lienzo de 8 bits del que salió). */
export async function commitEffect(layer, before, label, params = {}, base = layer, edit = null, { float = false, source = null } = {}){
  let after = canvasCopy(layer.canvas), fres = null;
  restore(layer, before);
  if(float === "delta" && source && hiFullCover(base)){
    try{ fres = await applyDeltaFromBase(base, source, after); if(fres) after = fres.canvas; }
    catch(err){ console.warn("[coma flotante]", err); fres = null; }
  }
  const made = commitFilter({ base, edit, result: after, title: label, filter: label, params });
  if(fres) attachFloatResult(made, base, fres);
  toast(label + (edit ? " · actualizado" : " · capa nueva") + (fres ? " · 16 bits conservados" : ""), "ok");
}

/* Diálogo con vista previa en vivo: cada deslizador recalcula sobre el
   ORIGINAL —nunca sobre el resultado del fotograma anterior, que
   acumularía error de redondeo— y escribe el resultado en la capa al
   momento, igual que runFilter/runAdjust. Cancelar devuelve la capa a
   como estaba; Aplicar lleva el resultado a una capa nueva (ver
   editor/layers/filterlayer.js), en vez de sobrescribir la capa de origen.

   Por encima de `LIVE_PREVIEW_LIMIT`, `compute` se ejecuta sobre una
   copia REDUCIDA mientras se arrastra —igual que editor/adjust/adjust.js—, y
   el resultado se escala sobre la capa real con un único `drawImage`.
   Al aceptar se recalcula UNA VEZ MÁS a resolución completa: lo que
   se ve durante el arrastre es una aproximación, lo que se guarda no
   debe serlo. `compute(src, w, h, host, scale)` recibe los píxeles
   ORIGINALES (nunca los muta), el propio `host` para leer los
   controles, y `scale` (1 en resolución completa, <1 en el proxy) por
   si algún parámetro está en píxeles ABSOLUTOS y necesita reescalarse
   para que el aspecto de la vista previa no cambie con el tamaño del
   proxy —el mismo contrato que ya tenían `correctLensPixels`,
   `selectiveSharpenPixels` y `portraitPixels`, que ignoran `scale` si
   no les hace falta—. */
/* `fill(host, p)` deja los controles con los valores de `p`, `read(host)`
   los lee, y `compute(src, w, h, p, scale)` calcula con un objeto de
   parámetros en vez de mirar el DOM: así el registro de filtros puede
   pedir el mismo cálculo sin diálogo (`opts.render`) y reabrir el
   panel con los valores guardados en la capa (`opts.init`, `opts.edit`). */
export async function liveDialog(title, html, { compute, label, read, fill, defaults, float = false }, opts = {}){
  const p0 = { ...defaults, ...opts.init };
  if(opts.render){
    const src = opts.render.src, w = src.width, h = src.height;
    const data = src.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, w, h).data;
    const out = compute(data, w, h, p0, 1);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);
    return c;
  }

  const edit = opts.edit || null;
  const layer = edit || rasterLayer(); if(!layer) return false;
  const base = edit ? filterBase(edit) : layer;
  if(!base){ toast("La capa de filtro no tiene ninguna capa debajo", "err"); return false; }
  const before = canvasCopy(layer.canvas);
  const source = edit ? canvasCopy(base.canvas) : before;
  const w = source.width, h = source.height;
  const fullData = source.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, w, h).data;

  const big = w * h > LIVE_PREVIEW_LIMIT;
  let smallCanvas = null, smallData = null, sw = w, sh = h, scale = 1;
  if(big){
    scale = Math.sqrt(LIVE_PREVIEW_LIMIT / (w * h));
    sw = Math.max(1, Math.round(w * scale)); sh = Math.max(1, Math.round(h * scale));
    smallCanvas = document.createElement("canvas");
    smallCanvas.width = sw; smallCanvas.height = sh;
    const sx = smallCanvas.getContext("2d", { willReadFrequently: true });
    sx.drawImage(source, 0, 0, sw, sh);
    smallData = sx.getImageData(0, 0, sw, sh).data;
  }

  let host, queued = false;
  const redraw = () => {
    if(queued || !host) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const p = read(host);
      if(big){
        const out = compute(smallData, sw, sh, p, scale);
        smallCanvas.getContext("2d").putImageData(new ImageData(out, sw, sh), 0, 0);
        const x = layer.ctx;
        x.save(); x.globalCompositeOperation = "copy"; x.imageSmoothingQuality = "high";
        x.drawImage(smallCanvas, 0, 0, w, h); x.restore();
      } else {
        const out = compute(fullData, w, h, p, 1);
        layer.ctx.putImageData(new ImageData(out, w, h), 0, 0);
      }
      layer.thumbDirty = true; emit("doc:change");
    });
  };

  const body = document.createElement("div"); body.innerHTML = html;
  const result = await dialog({ title, body,
    cls: isMobile() ? "dlg-compact" : "",
    buttons:[{ label:"Cancelar", value:null }, { label: edit ? "Guardar cambios" : "Aplicar", primary:true, value:"go" }],
    onOpen: h => {
      host = h;
      wireCommon(host);
      if(opts.init) fill(host, p0);
      host.addEventListener("input", redraw);
      redraw();
    }
  });

  if(result !== "go"){ restore(layer, before); return false; }
  const p = read(host);
  if(big){
    // Recalculado a resolución completa, aunque la vista previa
    // trabajara sobre el proxy reducido: lo aplicado no puede ser una
    // aproximación.
    status("Aplicando…");
    const out = compute(fullData, w, h, p, 1);
    layer.ctx.putImageData(new ImageData(out, w, h), 0, 0);
    status("");
  }
  await commitEffect(layer, before, label, p, base, edit, { float, source });
  return true;
}

/* Rellena deslizadores y casillas a partir de un mapa id → valor y
   refresca la etiqueta numérica de cada uno. */
export function fillFields(host, map){
  for(const [id, v] of Object.entries(map)){
    const el = host.querySelector("#" + id);
    if(!el) continue;
    if(el.type === "checkbox") el.checked = !!v;
    else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: false }));
  }
}

/* ── Retrato ──────────────────────────────────────────────────
   La versión anterior tenía dos problemas de fondo, no de matiz:

   1. `skinLike` era un SÍ/NO binario. En el propio límite del umbral,
      variaciones de color naturales de la piel (una sombra suave, un
      poro algo más rojo) hacen que un píxel entre y el vecino salga,
      así que el suavizado se aplicaba a parches con un borde visible
      en vez de a una zona continua: el clásico aspecto «de plástico a
      trozos» del retoque de piel mal hecho.

   2. El radio de muestreo era SIEMPRE de 1 píxel (una media de 3×3),
      sin relación con el tamaño de la imagen ni con el deslizador de
      cantidad. En una foto de varios megapíxeles, difuminar un solo
      píxel de radio no toca ni los poros más finos: subir «Suavizado»
      al máximo apenas cambiaba nada visible, que es justo el «no
      funciona bien» que se reportó.

   Esta versión sustituye el umbral por un peso continuo (0 a 1, sin
   escalón), liga el radio de suavizado al tamaño real del documento y
   al deslizador, y protege los bordes de verdad: sólo se difumina
   donde la imagen YA es plana alrededor —piel lisa—, no donde hay
   contraste local fuerte —el borde de un ojo, una ceja, el contorno
   de los labios—, comparando la imagen con una versión de referencia
   desenfocada a un radio pequeño y fijo. */

const smoothstep = (lo, hi, x) => { const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo))); return t * t * (3 - 2 * t); };

/* Peso de "parece piel", continuo en vez de todo-o-nada. Mismas
   condiciones que el umbral original, cada una convertida en una
   rampa suave alrededor de su mismo punto de corte. */
function skinWeight(r, g, b){
  return smoothstep(60, 90, r) *
         smoothstep(0.95, 1.15, r / Math.max(1, g)) *
         smoothstep(0.80, 1.00, g / Math.max(1, b)) *
         smoothstep(5, 25, r - b);
}

/* Desenfoque de caja separable con ventana deslizante: el coste no
   depende del radio, sólo del número de píxeles. Hace falta porque
   aquí el radio escala con el documento y puede ser de varias decenas
   de píxeles —una caja ingenua de radio 30 recorriendo cada píxel
   sería, en una foto de varios megapíxeles, órdenes de magnitud más
   lenta que esto—. */
function boxBlur(src, w, h, radius){
  if(radius <= 0) return Float32Array.from(src);
  const clampi = (v, hi) => v < 0 ? 0 : v > hi ? hi : v;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  const size = radius * 2 + 1;
  for(let y = 0; y < h; y++){
    const row = y * w;
    for(let c = 0; c < 4; c++){
      let sum = 0;
      for(let x = -radius; x <= radius; x++) sum += src[(row + clampi(x, w - 1)) * 4 + c];
      for(let x = 0; x < w; x++){
        tmp[(row + x) * 4 + c] = sum / size;
        sum += src[(row + clampi(x + radius + 1, w - 1)) * 4 + c] -
               src[(row + clampi(x - radius, w - 1)) * 4 + c];
      }
    }
  }
  for(let x = 0; x < w; x++){
    for(let c = 0; c < 4; c++){
      let sum = 0;
      for(let y = -radius; y <= radius; y++) sum += tmp[(clampi(y, h - 1) * w + x) * 4 + c];
      for(let y = 0; y < h; y++){
        out[(y * w + x) * 4 + c] = sum / size;
        sum += tmp[(clampi(y + radius + 1, h - 1) * w + x) * 4 + c] -
               tmp[(clampi(y - radius, h - 1) * w + x) * 4 + c];
      }
    }
  }
  return out;
}

export function portraitPixels(src, w, h, { smooth = 25, shine = 20, redEye = 60 } = {}){
  const out = new Uint8ClampedArray(src);
  const n = src.length;

  // Radio de suavizado: proporcional al deslizador Y al tamaño real
  // del documento (2 % del lado menor en el máximo), para que el
  // efecto se note igual de bien en una miniatura que en una foto de
  // 24 MP. Tope de 40 px por rendimiento en documentos enormes.
  const smoothT = smooth / 100;
  const radius = Math.round(smoothT * Math.min(40, Math.max(2, Math.min(w, h) * 0.02)));
  // Referencia de contraste local: un radio pequeño y FIJO, no ligado
  // al deslizador, así que sigue distinguiendo piel de bordes sea cual
  // sea la cantidad de suavizado pedida.
  const EDGE_R = 2;

  const smoothed = radius > 0 ? boxBlur(src, w, h, radius) : null;
  const edgeRef  = boxBlur(src, w, h, EDGE_R);

  for(let p = 0, i = 0; p < w * h; p++, i += 4){
    const r = src[i], g = src[i + 1], b = src[i + 2];

    let rr = r, gg = g, bb = b;

    if(redEye && r > g * 1.4 && r > b * 1.4 && r > 70){
      const t = smoothstep(1.4, 1.9, Math.min(r / Math.max(1, g), r / Math.max(1, b))) *
                smoothstep(70, 110, r) * (redEye / 100);
      const avg = (g + b) / 2;
      rr = r + (avg - r) * t;
    }

    if(smoothed && smoothT > 0){
      const sw = skinWeight(r, g, b);
      if(sw > 0.001){
        // Cuánto se protege este píxel de tocarse: alto si hay un
        // borde de verdad cerca (el color local cambia deprisa), bajo
        // en piel lisa. Se mide sobre el canal ROJO, el más estable
        // entre piel e iluminación.
        const localContrast = Math.abs(r - edgeRef[i]) + Math.abs(g - edgeRef[i+1]) + Math.abs(b - edgeRef[i+2]);
        const edgeProtect = 1 - smoothstep(10, 45, localContrast);
        const blend = sw * smoothT * edgeProtect;
        if(blend > 0.001){
          rr = rr + (smoothed[i]   - rr) * blend;
          gg = gg + (smoothed[i+1] - gg) * blend;
          bb = bb + (smoothed[i+2] - bb) * blend;
        }
      }
    }

    if(shine > 0){
      // Los brillos se miden sobre la versión YA local-suavizada
      // (edgeRef), no sobre el píxel crudo: así el punto de corte no
      // depende del ruido de un solo píxel, que es lo que antes daba
      // un moteado en vez de una reducción de brillo continua.
      const lLocal = (edgeRef[i] + edgeRef[i+1] + edgeRef[i+2]) / 3;
      const t = smoothstep(165, 220, lLocal) * (shine / 100) * 55;
      if(t > 0){ rr -= t; gg -= t; bb -= t; }
    }

    out[i] = clamp(rr); out[i+1] = clamp(gg); out[i+2] = clamp(bb);
  }
  return out;
}

export async function portraitRetouch(opts = {}){
  return liveDialog("Retoque de retrato", `
    ${sliderRow("portraitSmooth","Suavizado de piel",0,100,25,"%")}${sliderRow("portraitShine","Reducir brillos",0,100,20,"%")}${sliderRow("portraitEye","Corregir ojos rojos",0,100,70,"%")}
    <p class="hint">Trabaja sólo sobre colores compatibles con piel y píxeles rojos intensos, protegiendo
      ojos, cejas y demás bordes reales para que la piel no quede de plástico.</p>`, {
    label: "Retoque de retrato", float: "delta",
    defaults: { smooth: 25, shine: 20, redEye: 70 },
    compute: (src, w, h, p) => portraitPixels(src, w, h, p),
    read: host => ({
      smooth: +host.querySelector("#portraitSmooth").value,
      shine: +host.querySelector("#portraitShine").value,
      redEye: +host.querySelector("#portraitEye").value
    }),
    fill: (host, p) => fillFields(host, { portraitSmooth: p.smooth, portraitShine: p.shine, portraitEye: p.redEye })
  }, opts);
}
