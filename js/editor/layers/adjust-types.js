/* ═══════════════════════════════════════════════════════════════
   CAPAS DE AJUSTE · QUÉ HACE CADA TIPO
   Los tipos de capa de ajuste (brillo, niveles, curvas…), sus parámetros por defecto, cómo pasan de parámetros a
   píxeles y la comprobación «¿esto es una capa de ajuste?». Es la parte que también necesitan el árbol de capas
   (layertree.js), el compositor, la exportación de alta precisión y el compositor en coma flotante; el panel de
   edición y la creación de capas siguen en adjustlayers.js, que reexporta todo esto.

   Separado de adjustlayers.js para que layertree.js ↔ adjustlayers.js dejen de importarse el uno al otro.
   ═══════════════════════════════════════════════════════════════ */

import { applyLut } from "../adjust/adjust.js";
import { hslPremium } from "../adjust/hslpremium.js";
import { applyBC, BC_DEFAULTS, buildLevels, buildWB, hslShift } from "../adjust/adjustments.js";
import { curveLut } from "../adjust/curves.js";
import { buildBandTables, applyColorBands } from "../adjust/colorbands.js";

function grayscaleApply(data){
  for(let i = 0; i < data.length; i += 4){
    const l = data[i]*0.2126 + data[i+1]*0.7152 + data[i+2]*0.0722;
    data[i] = data[i+1] = data[i+2] = l;
  }
}
function invertApply(data){
  for(let i = 0; i < data.length; i += 4){
    data[i] = 255 - data[i]; data[i+1] = 255 - data[i+1]; data[i+2] = 255 - data[i+2];
  }
}
function defaultBands(){
  const o = {};
  for(const k of ["red","yellow","green","cyan","blue","magenta"]) o[k] = { hue:0, sat:0, light:0 };
  o.master = { bright:0, sat:0, light:0 };
  return o;
}

/* Cada tipo declara sus parámetros por defecto y cómo pasar de esos
   parámetros a píxeles. `apply` muta `data` in place: quien llama ya
   ha decidido si eso va a un `putImageData` directo o a una mezcla
   parcial por opacidad o máscara. */
export const ADJUST_TYPES = {
  bc: {
    name: "Brillo y contraste",
    defaults: () => ({ ...BC_DEFAULTS }),
    apply(data, w, h, p){ applyBC(data, p); }
  },
  levels: {
    name: "Niveles",
    defaults: () => ({ inLow:0, inHigh:255, gamma:1, outLow:0, outHigh:255, channel:"rgb" }),
    apply(data, w, h, p){ applyLut(data, buildLevels(p)); }
  },
  curves: {
    name: "Curvas",
    defaults: () => ({ points: [[0,0],[255,255]] }),
    apply(data, w, h, p){
      const t = curveLut(p.points && p.points.length >= 2 ? p.points : [[0,0],[255,255]]);
      applyLut(data, { r:t, g:t, b:t });
    }
  },
  wb: {
    name: "Balance de blancos",
    defaults: () => ({ temp: 0, tint: 0 }),
    apply(data, w, h, p){ applyLut(data, buildWB(p)); }
  },
  hsl: {
    name: "Tono y saturación",
    defaults: () => ({ hue: 0, sat: 0, light: 0, colorize: false }),
    apply(data, w, h, p){ if(p.premium) hslPremium(data, p); else hslShift(data, p); }
  },
  /* Exposición en pasos (EV), en luz lineal como en una cámara: +1 EV
     duplica la luz. La usa también «Aplicar esta edición a otras
     fotos» (plugins/batch/) para igualar la exposición de cada foto. */
  exposure: {
    name: "Exposición",
    defaults: () => ({ ev: 0 }),
    apply(data, w, h, p){
      if(!(p.ev || 0)) return;
      const f = exposureFunction(p), t = new Uint8ClampedArray(256);
      for(let i = 0; i < 256; i++) t[i] = Math.round(f(i));
      applyLut(data, { r: t, g: t, b: t });
    }
  },
  gray: {
    name: "Blanco y negro",
    defaults: () => ({}),
    apply(data){ grayscaleApply(data); }
  },
  invert: {
    name: "Invertir",
    defaults: () => ({}),
    apply(data){ invertApply(data); }
  },
  bands: {
    name: "Color por canales",
    defaults: () => defaultBands(),
    apply(data, w, h, p){
      const t = buildBandTables(p);
      if(!t.anyBand && !t.anyMaster) return;
      for(let i = 0; i < data.length; i += 4){
        const [r, g, b] = applyColorBands(data[i], data[i+1], data[i+2], p, t);
        data[i] = r; data[i+1] = g; data[i+2] = b;
      }
    }
  }
};

/* Exposición como función continua de 0..255 (admite decimales): la
   usan la tabla de arriba y la exportación de alta precisión. */
export function exposureFunction(p){
  const k = Math.pow(2, p.ev || 0);
  return i => {
    let v = i / 255; v = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    v = Math.min(1, v * k);
    return (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255;
  };
}

export const adjustTypeIds = () => Object.keys(ADJUST_TYPES);
export const adjustTypeName = id => (ADJUST_TYPES[id] && ADJUST_TYPES[id].name) || id;

/* Aplica el efecto de una capa de ajuste sobre un `ImageData` que ya
   trae compuesto lo que hay debajo. Devuelve los mismos datos
   mutados: no hay copia adicional aquí, la hace quien llama si la
   necesita para poder comparar antes/después (la mezcla por opacidad
   o máscara, más abajo). */
export function applyAdjustLayer(layer, data, w, h){
  const t = ADJUST_TYPES[layer.adjustType];
  if(!t) return data;
  t.apply(data, w, h, layer.adjustParams || t.defaults());
  return data;
}

export const isAdjustLayer = l => !!(l && l.type === "adjust");
