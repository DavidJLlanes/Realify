/* ═══════════════════════════════════════════════════════════════
   EXPORTACIÓN EN ALTA PRECISIÓN (fase 1 de PENDIENTE.md)

   El compositor normal (editor/layertree.js) trabaja en lienzos de
   8 bits: cada capa de ajuste lee los píxeles, aplica su efecto y los
   vuelve a escribir redondeados a 8 bits, y la siguiente parte de ese
   resultado ya cuantizado. Con varias capas de ajuste apiladas los
   redondeos se acumulan y aparecen bandas en cielos y degradados.

   Aquí se recompone el mismo árbol de capas en coma flotante (Float32),
   por franjas de filas para no agotar la memoria:
     · las capas de ajuste se evalúan en coma flotante interpolando sus
       propias tablas (las mismas funciones que el compositor normal:
       exactas en los valores enteros, continuas entre ellos);
     · los 28 modos de fusión, la opacidad, las máscaras y el recorte se
       calculan con las mismas fórmulas que el lienzo, sin redondear.
   El resultado se guarda en 16 bits por canal (sRGB codificado y alfa)
   y de ahí se remuestrea en luz lineal (media por áreas al reducir,
   bilineal al ampliar) y se codifica en 8 bits con tramado opcional o
   en 16 bits para PNG/TIFF.

   Si el documento usa algo que aquí aún no se reproduce exactamente
   (estilos de capa, «Fusionar si»), se parte del aplanado normal de
   8 bits: el remuestreo y la salida siguen siendo de alta precisión.
   Se carga sólo al exportar (import dinámico): un fallo aquí nunca
   impide que el editor arranque.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "./doc.js";
import { buildLayerTree, flatten } from "../editor/layertree.js";
import { ADJUST_TYPES, exposureFunction } from "../editor/adjustlayers.js";
import { levelsFunctions, wbGains } from "../editor/adjustments.js";
import { curveFunction } from "../editor/curves.js";
import { hasEnabledStyle } from "../editor/layerstyles.js";
import { isBlendIfActive } from "../editor/blendif.js";

/* ── límites de memoria ─────────────────────────────────────────
   El almacén ocupa 8 bytes por píxel (RGBA de 16 bits). */
export function precisionMaxPixels(){
  const mem = navigator.deviceMemory || 8;
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  return (coarse || mem <= 4) ? 16e6 : 32e6;
}
const BAND_PIXELS = 1e6;   // filas por franja ≈ 1 MP (16 MB por búfer Float32)
/* Entre franja y franja se cede el control al navegador: la interfaz
   (y el aviso «Exportando…») sigue viva durante los segundos que tarda
   una foto grande. */
const breathe = () => new Promise(r => setTimeout(r, 0));

/* ── sRGB ↔ lineal ─────────────────────────────────────────────── */
const toLinear = v => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
const toSrgb = v => v <= 0 ? 0 : v >= 1 ? 1 : v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055;
let LIN16 = null;            // código sRGB de 16 bits → lineal
function lin16(){
  if(!LIN16){ LIN16 = new Float32Array(65536); for(let i = 0; i < 65536; i++) LIN16[i] = toLinear(i / 65535); }
  return LIN16;
}
/* Lineal → sRGB con tabla indexada por raíz (densa en las sombras) */
const ENC_N = 16384;
let ENC = null;
function encodeLinear(l){
  if(!ENC){ ENC = new Float32Array(ENC_N + 2); for(let i = 0; i <= ENC_N + 1; i++){ const q = Math.min(1, i / ENC_N); ENC[i] = toSrgb(q * q); } }
  if(l <= 0) return 0;
  if(l >= 1) return 1;
  const f = Math.sqrt(l) * ENC_N, k = f | 0;
  return ENC[k] + (ENC[k + 1] - ENC[k]) * (f - k);
}

/* Tramado determinista en [-0.5, 0.5) (igual que high-precision-next.js) */
function ditherNoise(x, y, c){
  let n = (Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca77) ^ Math.imul(c + 1, 0xc2b2ae35)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296 - 0.5;
}

/* ── capas de ajuste en coma flotante ─────────────────────────────
   Valores 0..255 con decimales, sin redondear entre capas:
     · Niveles, Curvas, Balance de blancos, Exposición e Invertir usan
       sus propias fórmulas continuas (las mismas que construyen las
       tablas de 8 bits del compositor normal: levelFunction,
       curveFunction, wbGains, exposureFunction).
     · Blanco y negro: la misma luminancia, sin redondear.
     · Los que mezclan canales (brillo/contraste, tono/saturación, color
       por canales) se evalúan con su propia función sobre una rejilla
       RGB de 86³ (paso 3) en coma flotante y se interpolan. */
const GRID = 86, STEP = 255 / (GRID - 1);
const C255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

function adjustFunction(layer){
  const type = ADJUST_TYPES[layer.adjustType];
  const p = layer.adjustParams || type.defaults();
  const id = layer.adjustType;
  if(id === "gray") return (r, g, b, o) => { const l = r * .2126 + g * .7152 + b * .0722; o[0] = o[1] = o[2] = l; };
  if(id === "invert") return (r, g, b, o) => { o[0] = 255 - r; o[1] = 255 - g; o[2] = 255 - b; };
  if(id === "exposure"){
    if(!(p.ev || 0)) return (r, g, b, o) => { o[0] = r; o[1] = g; o[2] = b; };
    const f = exposureFunction(p);
    return (r, g, b, o) => { o[0] = f(C255(r)); o[1] = f(C255(g)); o[2] = f(C255(b)); };
  }
  if(id === "wb"){
    const k = wbGains(p);
    return (r, g, b, o) => { o[0] = C255(r * k.r); o[1] = C255(g * k.g); o[2] = C255(b * k.b); };
  }
  if(id === "levels"){
    const f = levelsFunctions(p);
    return (r, g, b, o) => { o[0] = C255(f.r(C255(r))); o[1] = C255(f.g(C255(g))); o[2] = C255(f.b(C255(b))); };
  }
  if(id === "curves"){
    const f = curveFunction(p.points && p.points.length >= 2 ? p.points : [[0,0],[255,255]]);
    return (r, g, b, o) => { o[0] = C255(f(C255(r))); o[1] = C255(f(C255(g))); o[2] = C255(f(C255(b))); };
  }
  /* Rejilla: los nodos son valores enteros (paso 3 exacto), así que la
     función de siempre los acepta tal cual; se le pasa un Float32Array
     para que su resultado no se redondee. Si alguna devolviera algo no
     numérico, se repite con la rejilla de 8 bits. */
  const n = GRID * GRID * GRID;
  const fill = d => {
    for(let bi = 0, i = 0; bi < GRID; bi++) for(let gi = 0; gi < GRID; gi++) for(let ri = 0; ri < GRID; ri++, i += 4){
      d[i] = Math.round(ri * STEP); d[i + 1] = Math.round(gi * STEP); d[i + 2] = Math.round(bi * STEP); d[i + 3] = 255;
    }
    return d;
  };
  let d = fill(new Float32Array(n * 4));
  try{ type.apply(d, n, 1, p); }catch{ d = null; }
  if(d) for(let i = 0; i < d.length; i++) if(!Number.isFinite(d[i])){ d = null; break; }
  if(!d){ d = fill(new Uint8ClampedArray(n * 4)); type.apply(d, n, 1, p); }
  const T = new Float32Array(n * 3);
  for(let i = 0, j = 0; i < n; i++, j += 4){ T[i * 3] = C255(d[j]); T[i * 3 + 1] = C255(d[j + 1]); T[i * 3 + 2] = C255(d[j + 2]); }
  const G1 = GRID - 1, S1 = GRID, S2 = GRID * GRID;
  return (r, g, b, o) => {
    const fr = C255(r) / STEP, fg = C255(g) / STEP, fb = C255(b) / STEP;
    let r0 = fr | 0, g0 = fg | 0, b0 = fb | 0;
    if(r0 >= G1) r0 = G1 - 1; if(g0 >= G1) g0 = G1 - 1; if(b0 >= G1) b0 = G1 - 1;
    const tr = fr - r0, tg = fg - g0, tb = fb - b0;
    const i000 = (b0 * S2 + g0 * S1 + r0) * 3, i100 = i000 + 3, i010 = i000 + S1 * 3, i110 = i010 + 3;
    const i001 = i000 + S2 * 3, i101 = i001 + 3, i011 = i001 + S1 * 3, i111 = i011 + 3;
    for(let c = 0; c < 3; c++){
      const c00 = T[i000 + c] + (T[i100 + c] - T[i000 + c]) * tr, c10 = T[i010 + c] + (T[i110 + c] - T[i010 + c]) * tr;
      const c01 = T[i001 + c] + (T[i101 + c] - T[i001 + c]) * tr, c11 = T[i011 + c] + (T[i111 + c] - T[i011 + c]) * tr;
      const c0 = c00 + (c10 - c00) * tg, c1 = c01 + (c11 - c01) * tg;
      o[c] = c0 + (c1 - c0) * tb;
    }
  };
}

/* ── modos de fusión (valores 0..1) ───────────────────────────────
   Nativos del lienzo: fórmulas de la especificación W3C Compositing
   (las mismas que aplica el navegador). Los diez «a mano» siguen
   exactamente las de editor/blend.js. */
const sep = {
  "source-over": (b, s) => s,
  multiply: (b, s) => b * s,
  screen: (b, s) => b + s - b * s,
  overlay: (b, s) => hardLight(s, b),
  darken: (b, s) => Math.min(b, s),
  lighten: (b, s) => Math.max(b, s),
  "color-dodge": (b, s) => b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s)),
  "color-burn": (b, s) => b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s),
  "hard-light": (b, s) => hardLight(b, s),
  "soft-light": (b, s) => s <= .5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * ((b <= .25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b)) - b),
  difference: (b, s) => Math.abs(b - s),
  exclusion: (b, s) => b + s - 2 * b * s
};
function hardLight(b, s){ return s <= .5 ? b * 2 * s : b + (2 * s - 1) - b * (2 * s - 1); }

const lum = (r, g, b) => .3 * r + .59 * g + .11 * b;
function clipColor(c){
  const l = lum(c[0], c[1], c[2]), n = Math.min(c[0], c[1], c[2]), x = Math.max(c[0], c[1], c[2]);
  if(n < 0) for(let i = 0; i < 3; i++) c[i] = l + (c[i] - l) * l / (l - n || 1e-9);
  if(x > 1) for(let i = 0; i < 3; i++) c[i] = l + (c[i] - l) * (1 - l) / (x - l || 1e-9);
  return c;
}
function setLum(c, l){ const d = l - lum(c[0], c[1], c[2]); return clipColor([c[0] + d, c[1] + d, c[2] + d]); }
const satOf = c => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
function setSat(c, s){
  const o = [0, 0, 0], idx = [0, 1, 2].sort((a, b) => c[a] - c[b]);
  const mn = idx[0], md = idx[1], mx = idx[2];
  if(c[mx] > c[mn]){ o[md] = (c[md] - c[mn]) * s / (c[mx] - c[mn]); o[mx] = s; }
  o[mn] = 0;
  return o;
}
const nonSep = {
  hue: (cb, cs) => setLum(setSat(cs, satOf(cb)), lum(cb[0], cb[1], cb[2])),
  saturation: (cb, cs) => setLum(setSat(cb, satOf(cs)), lum(cb[0], cb[1], cb[2])),
  color: (cb, cs) => setLum(cs, lum(cb[0], cb[1], cb[2])),
  luminosity: (cb, cs) => setLum(cb, lum(cs[0], cs[1], cs[2]))
};

/* Modos de editor/blend.js, en 0..255 como allí */
const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const clamp1 = v => v < 0 ? 0 : v > 1 ? 1 : v;
function fVividLight(b, s){
  const B = b / 255, S = s / 255;
  const r = S <= .5 ? (S <= 0 ? 0 : 1 - clamp1((1 - B) / (2 * S))) : (S >= 1 ? 1 : clamp1(B / (2 * (1 - S))));
  return clamp255(r * 255);
}
const custom = {
  "linear-light": (b, s) => clamp255(b + 2 * s - 255),
  "linear-burn": (b, s) => clamp255(b + s - 255),
  subtract: (b, s) => clamp255(b - s),
  divide: (b, s) => s <= 0 ? 255 : clamp255(b / s * 255),
  "pin-light": (b, s) => s < 128 ? Math.min(b, 2 * s) : Math.max(b, clamp255(2 * s - 255)),
  "vivid-light": fVividLight,
  "hard-mix": (b, s) => fVividLight(b, s) < 128 ? 0 : 255
};
function hash2i(x, y){
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) % 4096 / 4096;
}
const SUPPORTED_BLENDS = new Set([...Object.keys(sep), ...Object.keys(nonSep), ...Object.keys(custom),
  "lighter", "darker-color", "lighter-color", "dissolve"]);

/* Funde `src` (premultiplicado, 0..1) sobre `dst` (ídem) en la franja
   que empieza en la fila `y0` del documento. */
function blendInto(dst, src, mode, opacity, w, y0){
  const n = dst.length;
  const cb = [0, 0, 0], cs = [0, 0, 0];
  const f = sep[mode], ns = nonSep[mode], cu = custom[mode];
  for(let i = 0; i < n; i += 4){
    const sa = src[i + 3];
    if(sa <= 0) continue;
    const as = sa * opacity;
    const Cs0 = src[i] / sa, Cs1 = src[i + 1] / sa, Cs2 = src[i + 2] / sa;
    const ab = dst[i + 3];
    const Cb0 = ab > 0 ? dst[i] / ab : 0, Cb1 = ab > 0 ? dst[i + 1] / ab : 0, Cb2 = ab > 0 ? dst[i + 2] / ab : 0;
    if(f || ns){
      let B0, B1, B2;
      if(f){ B0 = f(Cb0, Cs0); B1 = f(Cb1, Cs1); B2 = f(Cb2, Cs2); }
      else { cb[0] = Cb0; cb[1] = Cb1; cb[2] = Cb2; cs[0] = Cs0; cs[1] = Cs1; cs[2] = Cs2; const r = ns(cb, cs); B0 = r[0]; B1 = r[1]; B2 = r[2]; }
      const m0 = (1 - ab) * Cs0 + ab * B0, m1 = (1 - ab) * Cs1 + ab * B1, m2 = (1 - ab) * Cs2 + ab * B2;
      dst[i]     = as * m0 + (1 - as) * dst[i];
      dst[i + 1] = as * m1 + (1 - as) * dst[i + 1];
      dst[i + 2] = as * m2 + (1 - as) * dst[i + 2];
      dst[i + 3] = as + ab * (1 - as);
    } else if(mode === "lighter"){
      dst[i]     = Math.min(1, dst[i] + as * Cs0);
      dst[i + 1] = Math.min(1, dst[i + 1] + as * Cs1);
      dst[i + 2] = Math.min(1, dst[i + 2] + as * Cs2);
      dst[i + 3] = Math.min(1, ab + as);
    } else {
      /* Modos de editor/blend.js: trabajan sobre el color sin
         premultiplicar de lo de debajo (0..255) y suman alfa así. */
      let d0 = Cb0 * 255, d1 = Cb1 * 255, d2 = Cb2 * 255, na;
      const s0 = Cs0 * 255, s1 = Cs1 * 255, s2 = Cs2 * 255;
      if(mode === "dissolve"){
        const p = i >> 2, x = p % w, y = y0 + ((p / w) | 0);
        if(hash2i(x, y) >= as) continue;
        d0 = s0; d1 = s1; d2 = s2; na = 1;
      } else if(cu){
        d0 += (cu(d0, s0) - d0) * as; d1 += (cu(d1, s1) - d1) * as; d2 += (cu(d2, s2) - d2) * as;
        na = Math.min(1, ab + sa * as);
      } else {   // color más oscuro / más claro
        const lD = d0 * .2126 + d1 * .7152 + d2 * .0722, lS = s0 * .2126 + s1 * .7152 + s2 * .0722;
        if(!(mode === "darker-color" ? lS < lD : lS > lD)) continue;
        d0 += (s0 - d0) * as; d1 += (s1 - d1) * as; d2 += (s2 - d2) * as;
        na = Math.min(1, ab + sa * as);
      }
      dst[i] = d0 / 255 * na; dst[i + 1] = d1 / 255 * na; dst[i + 2] = d2 / 255 * na; dst[i + 3] = na;
    }
  }
}

/* ── lectura de franjas ───────────────────────────────────────── */
function effectiveMask(layer){
  if(layer.maskRef){ const r = doc.layers.find(l => l.id === layer.maskRef); return r ? r.mask : null; }
  return layer.mask;
}
function readBand(canvas, y0, w, bh){
  return canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, y0, w, bh).data;
}
/* Píxeles de una capa → Float32 premultiplicado */
function layerBand(canvas, y0, w, bh){
  const d = readBand(canvas, y0, w, bh), out = new Float32Array(d.length);
  for(let i = 0; i < d.length; i += 4){
    const a = d[i + 3] / 255;
    if(a <= 0) continue;
    out[i] = d[i] / 255 * a; out[i + 1] = d[i + 1] / 255 * a; out[i + 2] = d[i + 2] / 255 * a; out[i + 3] = a;
  }
  return out;
}
function maskBand(layer, y0, w, bh){
  const m = effectiveMask(layer);
  if(!m || !layer.maskEnabled) return null;
  const d = readBand(m.canvas, y0, w, bh), out = new Float32Array(w * bh);
  for(let i = 0, p = 3; i < out.length; i++, p += 4) out[i] = d[p] / 255;
  return out;
}

/* ¿Hay algo en el documento que este motor aún no reproduce igual? */
function unsupportedReason(layers){
  for(const l of layers){
    if(!l.visible) continue;
    if(l.styles && hasEnabledStyle(l.styles)) return "estilos de capa";
    if(l.type !== "group" && l.type !== "adjust" && isBlendIfActive(l.blendIf)) return "«Fusionar si»";
    if(l.type === "adjust"){
      if(!ADJUST_TYPES[l.adjustType]) return "un tipo de capa de ajuste desconocido";
      const p = l.adjustParams || {};
      if(l.adjustType === "bc" && !p.useLegacy && p.pivot !== "mid" && !Number.isFinite(p.pivotL) && (+p.brightness || +p.contrast)) return "brillo y contraste sin pivote medido";
    }
    if(l.type !== "adjust" && l.blend && !SUPPORTED_BLENDS.has(l.blend)) return `el modo de fusión «${l.blend}»`;
  }
  return null;
}

/* Compone un nivel del árbol (mismo orden y reglas que compositeTree) */
function composeLevel(nodes, out, y0, w, bh, fns){
  const n = w * bh;
  let clipBase = null;
  const tmp = [0, 0, 0];
  for(const node of nodes){
    const l = node.layer;
    if(!l.visible || l.opacity <= 0 || l.__editing) continue;
    if(l.type === "adjust"){
      const fn = fns.get(l), mk = maskBand(l, y0, w, bh);
      for(let p = 0, i = 0; p < n; p++, i += 4){
        const a = out[i + 3];
        if(a <= 0) continue;
        const f = mk ? l.opacity * mk[p] : l.opacity;
        if(f <= 0) continue;
        const r = out[i] / a * 255, g = out[i + 1] / a * 255, b = out[i + 2] / a * 255;
        fn(r, g, b, tmp);
        const r2 = r + (Math.min(255, Math.max(0, tmp[0])) - r) * f;
        const g2 = g + (Math.min(255, Math.max(0, tmp[1])) - g) * f;
        const b2 = b + (Math.min(255, Math.max(0, tmp[2])) - b) * f;
        out[i] = r2 / 255 * a; out[i + 1] = g2 / 255 * a; out[i + 2] = b2 / 255 * a;
      }
      continue;
    }
    let src;
    if(l.type === "group"){
      src = new Float32Array(n * 4);
      composeLevel(node.children || [], src, y0, w, bh, fns);
    } else {
      src = layerBand(l.canvas, y0, w, bh);
    }
    const mk = maskBand(l, y0, w, bh);
    if(mk) for(let p = 0, i = 0; p < n; p++, i += 4){ const k = mk[p]; src[i] *= k; src[i + 1] *= k; src[i + 2] *= k; src[i + 3] *= k; }
    if(l.clipped && clipBase) for(let p = 0, i = 0; p < n; p++, i += 4){ const k = clipBase[p]; src[i] *= k; src[i + 1] *= k; src[i + 2] *= k; src[i + 3] *= k; }
    if(!l.clipped){ clipBase = new Float32Array(n); for(let p = 0, i = 3; p < n; p++, i += 4) clipBase[p] = src[i]; }
    blendInto(out, src, l.blend || "source-over", l.opacity, w, y0);
  }
}

/* ── almacén de 16 bits ──────────────────────────────────────────
   RGBA Uint16: color sRGB codificado SIN premultiplicar (precisión en
   las sombras) y alfa lineal. */
async function storeFromLayers(W, H){
  const reason = unsupportedReason(doc.layers);
  if(reason) return { reason };
  const fns = new Map();
  for(const l of doc.layers) if(l.type === "adjust" && l.visible && l.opacity > 0) fns.set(l, adjustFunction(l));
  const tree = buildLayerTree(doc.layers);
  const store = new Uint16Array(W * H * 4);
  const rows = Math.max(1, Math.floor(BAND_PIXELS / W));
  for(let y0 = 0; y0 < H; y0 += rows){
    const bh = Math.min(rows, H - y0), out = new Float32Array(W * bh * 4);
    composeLevel(tree, out, y0, W, bh, fns);
    await breathe();
    const base = y0 * W * 4;
    for(let i = 0; i < out.length; i += 4){
      const a = out[i + 3], j = base + i;
      if(a <= 0) continue;
      const ia = 1 / a;
      store[j]     = Math.round(clamp1(out[i] * ia) * 65535);
      store[j + 1] = Math.round(clamp1(out[i + 1] * ia) * 65535);
      store[j + 2] = Math.round(clamp1(out[i + 2] * ia) * 65535);
      store[j + 3] = Math.round(clamp1(a) * 65535);
    }
  }
  return { store, W, H, mode: "layers" };
}
function storeFromCanvas(canvas){
  const W = canvas.width, H = canvas.height, store = new Uint16Array(W * H * 4);
  const x = canvas.getContext("2d", { willReadFrequently: true });
  const rows = Math.max(1, Math.floor(BAND_PIXELS / W));
  for(let y0 = 0; y0 < H; y0 += rows){
    const bh = Math.min(rows, H - y0), d = x.getImageData(0, y0, W, bh).data, base = y0 * W * 4;
    for(let i = 0; i < d.length; i++) store[base + i] = d[i] * 257;
  }
  return { store, W, H, mode: "canvas" };
}

/* ── remuestreo y salida ─────────────────────────────────────────
   Por filas: cada fila de salida suma las filas de origen que le
   tocan, ya remuestreadas en horizontal (con caché), en luz lineal y
   alfa premultiplicado. Al reducir, media por áreas (cada píxel de
   salida promedia exactamente la zona de origen que cubre); al
   ampliar, bilineal. */
function taps(srcN, dstN){
  const s = srcN / dstN, out = new Array(dstN);
  for(let x = 0; x < dstN; x++){
    const idx = [], wt = [];
    if(s > 1){
      const a = x * s, b = (x + 1) * s;
      for(let i = Math.floor(a); i < Math.ceil(b) && i < srcN; i++){
        const ov = Math.min(b, i + 1) - Math.max(a, i);
        if(ov > 0){ idx.push(i); wt.push(ov / s); }
      }
    } else {
      const f = Math.max(0, Math.min(srcN - 1, (x + .5) * s - .5)), i0 = Math.floor(f), i1 = Math.min(srcN - 1, i0 + 1), t = f - i0;
      idx.push(i0); wt.push(1 - t);
      if(i1 !== i0 && t > 0){ idx.push(i1); wt.push(t); }
    }
    out[x] = { idx, wt };
  }
  return out;
}

/* Recorre la imagen de salida fila a fila y llama a `emit(y, row)`,
   con `row` Float32 (w*4): color sRGB codificado 0..1 sin premultiplicar
   y alfa 0..1. */
async function produce({ store, W, H }, w, h, emit){
  const every = Math.max(1, Math.floor(BAND_PIXELS / w));
  if(w === W && h === H){
    const row = new Float32Array(w * 4);
    for(let y = 0; y < h; y++){
      const base = y * W * 4;
      for(let i = 0; i < row.length; i++) row[i] = store[base + i] / 65535;
      emit(y, row);
      if(y % every === every - 1) await breathe();
    }
    return;
  }
  const L = lin16(), hx = taps(W, w), vy = taps(H, h), cache = new Map();
  const hrow = sy => {
    let r = cache.get(sy);
    if(r) return r;
    r = new Float32Array(w * 4);
    const base = sy * W * 4;
    for(let x = 0; x < w; x++){
      const { idx, wt } = hx[x];
      let R = 0, G = 0, B = 0, A = 0;
      for(let k = 0; k < idx.length; k++){
        const j = base + idx[k] * 4, a = store[j + 3] / 65535 * wt[k];
        if(a <= 0) continue;
        R += L[store[j]] * a; G += L[store[j + 1]] * a; B += L[store[j + 2]] * a; A += a;
      }
      const o = x * 4; r[o] = R; r[o + 1] = G; r[o + 2] = B; r[o + 3] = A;
    }
    cache.set(sy, r);
    return r;
  };
  const row = new Float32Array(w * 4);
  for(let y = 0; y < h; y++){
    const { idx, wt } = vy[y];
    for(const key of cache.keys()) if(key < idx[0]) cache.delete(key);
    row.fill(0);
    for(let k = 0; k < idx.length; k++){
      const r = hrow(idx[k]), t = wt[k];
      for(let i = 0; i < row.length; i++) row[i] += r[i] * t;
    }
    for(let i = 0; i < row.length; i += 4){
      const a = row[i + 3];
      if(a <= 1e-7){ row[i] = row[i + 1] = row[i + 2] = row[i + 3] = 0; continue; }
      row[i] = encodeLinear(row[i] / a); row[i + 1] = encodeLinear(row[i + 1] / a); row[i + 2] = encodeLinear(row[i + 2] / a);
      row[i + 3] = Math.min(1, a);
    }
    emit(y, row);
    if(y % every === every - 1) await breathe();
  }
}

async function toCanvas(src, w, h, dither){
  const out = document.createElement("canvas"); out.width = w; out.height = h;
  const x = out.getContext("2d", { colorSpace: "srgb" });
  const rows = Math.max(1, Math.floor(BAND_PIXELS / w));
  let img = null, y0 = 0;
  await produce(src, w, h, (y, row) => {
    if(!img || y >= y0 + img.height){
      if(img) x.putImageData(img, 0, y0);
      y0 = y; img = x.createImageData(w, Math.min(rows, h - y));
    }
    const d = img.data, o = (y - y0) * w * 4;
    for(let i = 0; i < row.length; i += 4){
      const px = i >> 2;
      for(let c = 0; c < 3; c++){
        const v = row[i + c] * 255;
        d[o + i + c] = Math.round(dither ? v + ditherNoise(px, y, c) : v);
      }
      d[o + i + 3] = Math.round(row[i + 3] * 255);
    }
  });
  if(img) x.putImageData(img, 0, y0);
  return out;
}

/* 16 bits por canal: RGBA Uint16 (o RGB sobre `background` si no se
   conserva la transparencia), color sRGB codificado. */
async function toUint16(src, w, h, { alpha = true, background = "#ffffff" } = {}){
  const bg = [1, 3, 5].map(k => parseInt(background.slice(k, k + 2), 16) / 255);
  const ch = alpha ? 4 : 3, data = new Uint16Array(w * h * ch);
  await produce(src, w, h, (y, row) => {
    let o = y * w * ch;
    for(let i = 0; i < row.length; i += 4, o += ch){
      const a = row[i + 3];
      if(alpha){
        data[o] = Math.round(row[i] * 65535); data[o + 1] = Math.round(row[i + 1] * 65535);
        data[o + 2] = Math.round(row[i + 2] * 65535); data[o + 3] = Math.round(a * 65535);
      } else for(let c = 0; c < 3; c++) data[o + c] = Math.round((row[i + c] * a + bg[c] * (1 - a)) * 65535);
    }
  });
  return { data, channels: ch, w, h };
}

/** Exportación de alta precisión. Devuelve
    { canvas | data16, mode: "high-precision", reason, source } o, si no
    cabe en memoria, { canvas: null, mode: "compatible", reason }.
    `layersOnly`: no recurrir al aplanado de 8 bits (devuelve null). */
export async function renderPrecise({ w, h, dither = false, bits16 = false, alpha = true, background = "#ffffff", layersOnly = false }){
  w = Math.max(1, Math.round(w || doc.w)); h = Math.max(1, Math.round(h || doc.h));
  const max = precisionMaxPixels();
  if(doc.w * doc.h > max || w * h > max)
    return { canvas: null, mode: "compatible", reason: `alta precisión limitada a ${Math.round(max / 1e6)} MP en este dispositivo` };
  let src = await storeFromLayers(doc.w, doc.h), why = "";
  if(!src.store){
    if(layersOnly) return null;
    why = src.reason;
    src = storeFromCanvas(flatten());
  }
  const reason = src.mode === "layers"
    ? "Capas y ajustes recompuestos en coma flotante" + (w !== doc.w || h !== doc.h ? "; remuestreo en RGB lineal" : "")
    : `Composición de 8 bits (por ${why}); remuestreo en RGB lineal`;
  if(bits16) return { data16: await toUint16(src, w, h, { alpha, background }), mode: "high-precision", reason: reason + " · 16 bits por canal", source: src.mode };
  return { canvas: await toCanvas(src, w, h, dither), mode: "high-precision", reason: reason + (dither ? " · tramado a 8 bits" : ""), source: src.mode };
}

/* Para pruebas: compone sin remuestrear y devuelve el almacén */
export function _debugStore(){ return storeFromLayers(doc.w, doc.h); }   // asíncrona
