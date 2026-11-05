/* ═══════════════════════════════════════════════════════════════
   IA · WORKER · TENSORES
   Conversión entre píxeles RGBA, planos normalizados y tensores float32 o float16.
   Entradas: píxeles, tipo de entrada del modelo, dimensiones. Salidas: tensores o Float32Array.
   Sin acceso al DOM: sólo cálculo.
   ═══════════════════════════════════════════════════════════════ */

import * as ort from "../../vendor/ort/ort.webgpu.min.js";

/* ── float16 ↔ float32 ─────────────────────────────────────────── */
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);

function toHalf(v){
  f32[0] = v; const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  let exp = ((x >>> 23) & 0xff) - 112, mant = x & 0x7fffff;
  if(exp <= 0){
    if(exp < -10) return sign;
    mant = (mant | 0x800000) >> (1 - exp);
    return sign | ((mant + 0x1000) >> 13);
  }
  if(exp >= 31) return sign | 0x7c00;
  const h = sign | (exp << 10) | ((mant + 0x1000) >> 13);
  return h;
}

function fromHalf(h){
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if(e === 0) return s * m * 5.960464477539063e-8;
  if(e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * Math.pow(2, e - 15);
}

export function makeTensor(type, data, dims){
  if(type === "float16"){
    const h = new Uint16Array(data.length);
    for(let i = 0; i < data.length; i++) h[i] = toHalf(data[i]);
    return new ort.Tensor("float16", h, dims);
  }
  return new ort.Tensor("float32", data, dims);
}

export function readFloats(t){
  const d = t.data;
  if(t.type === "float16"){
    if(d instanceof Uint16Array){
      const out = new Float32Array(d.length);
      for(let i = 0; i < d.length; i++) out[i] = fromHalf(d[i]);
      return out;
    }
    return Float32Array.from(d);   // Float16Array nativo
  }
  return d instanceof Float32Array ? d : Float32Array.from(d);
}

export function inputType(session, name){
  const meta = session.inputMetadata?.find?.(m => m.name === name);
  return meta?.type === "float16" ? "float16" : "float32";
}

/* ── Utilidades de píxeles ─────────────────────────────────────── */
/* `norm` = [media, desviación] por si el modelo no lleva la
   normalización dentro del grafo (MODNet espera -1…1). */
export function rgbaToPlanar(rgba, n, norm){
  const out = new Float32Array(3 * n);
  const [mean, std] = norm || [0, 1];
  for(let p = 0, i = 0; p < n; p++, i += 4){
    out[p]         = (rgba[i]     / 255 - mean) / std;
    out[n + p]     = (rgba[i + 1] / 255 - mean) / std;
    out[2 * n + p] = (rgba[i + 2] / 255 - mean) / std;
  }
  return out;
}
