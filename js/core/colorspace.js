/* ═══════════════════════════════════════════════════════════════
   ESPACIO DE COLOR DEL DOCUMENTO (fase 2 de PENDIENTE.md)

   Las fotos de iPhone y de muchos Android vienen en Display P3, con
   colores más saturados que los que caben en sRGB. Hasta ahora todo el
   editor trabajaba en sRGB y el navegador los recortaba al abrir la
   foto: rojos, verdes y naranjas intensos perdían saturación.

   Ahora, si una foto tiene de verdad colores fuera de sRGB y el
   navegador sabe trabajar en P3, el documento entero pasa a
   «modo P3» (`doc.colorSpace = "display-p3"`):
     · todo lienzo 2D que se cree mientras ese documento está activo
       trabaja en P3, aunque el código pida sRGB (antes era lo único que
       había) — salvo que pida expresamente `forceSrgb: true`, que sólo
       usa la exportación para convertir a sRGB;
     · todo `new ImageData(...)` sin espacio explícito se etiqueta P3.
   Así los datos de píxeles nunca se mezclan con etiquetas distintas
   (eso desplazaría los colores) y las herramientas no necesitan saber
   nada: hacen las mismas cuentas sobre números P3.
   Las fotos sRGB no cambian en absoluto: el documento sigue en sRGB y
   estos parches no tocan nada.

   No se tocan los contextos WebGL (filtro Realify, revelador…): el
   navegador convierte a sRGB al subir la textura y vuelve a P3 al
   dibujar el resultado, así que los colores son correctos y sólo esas
   herramientas recortan a la gama sRGB.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "./doc.js";
import { rgbMatrix } from "./icc.js";

let supported = null;
/** ¿Sabe este navegador trabajar con lienzos Display P3? */
export function p3Supported(){
  if(supported !== null) return supported;
  try{
    const c = document.createElement("canvas"); c.width = c.height = 1;
    const x = NativeGetContext.call(c, "2d", { colorSpace: "display-p3" });
    supported = !!(x && x.getContextAttributes && x.getContextAttributes().colorSpace === "display-p3");
  }catch{ supported = false; }
  return supported;
}

/** Espacio de trabajo del documento activo: "display-p3" o "srgb". */
export const workSpace = () => (doc.colorSpace === "display-p3" && p3Supported()) ? "display-p3" : "srgb";
export const isP3Doc = () => workSpace() === "display-p3";

/* ── parches ─────────────────────────────────────────────────── */
const NativeGetContext = HTMLCanvasElement.prototype.getContext;
const NativeOffscreenGetContext = typeof OffscreenCanvas === "function" ? OffscreenCanvas.prototype.getContext : null;
const NativeImageData = globalThis.ImageData;

function patchedOptions(type, opts){
  if(type !== "2d" || !isP3Doc() || (opts && opts.forceSrgb)) return opts;
  return { ...(opts || {}), colorSpace: "display-p3" };
}

let installed = false;
export function installColorSpace(){
  if(installed) return;
  installed = true;
  try{
    HTMLCanvasElement.prototype.getContext = function(type, opts){
      return NativeGetContext.call(this, type, patchedOptions(type, opts));
    };
    if(NativeOffscreenGetContext){
      OffscreenCanvas.prototype.getContext = function(type, opts){
        return NativeOffscreenGetContext.call(this, type, patchedOptions(type, opts));
      };
    }
    /* `new ImageData(...)` sin espacio → el del documento. `instanceof
       ImageData` sigue reconociendo los ImageData nativos. */
    class DocImageData extends NativeImageData {
      constructor(a, b, c, d){
        if(typeof a === "number"){
          const settings = b === undefined ? undefined : c;
          if(!isP3Doc() || (settings && settings.colorSpace)) super(a, b, ...(c === undefined ? [] : [c]));
          else super(a, b, { ...(settings || {}), colorSpace: "display-p3" });
        } else {
          if(!isP3Doc() || (d && d.colorSpace)){
            if(d !== undefined) super(a, b, c, d); else if(c !== undefined) super(a, b, c); else super(a, b);
          } else super(a, b, c === undefined ? a.length / 4 / b : c, { ...(d || {}), colorSpace: "display-p3" });
        }
      }
      static [Symbol.hasInstance](o){ return o instanceof NativeImageData; }
    }
    globalThis.ImageData = DocImageData;
    installP3Colors();
  }catch(err){ console.warn("[color] no se pudo activar el espacio de color del documento", err); }
}

/* ── colores de pintura en P3 (v257) ────────────────────────────────────────────
   En un documento P3 un color «#rrggbb» (o rgb()/rgba()) son SUS números —los del lienzo—, no sRGB: así el cuentagotas, que lee números P3, y el pincel, el relleno, el texto y las
   formas que usan esos mismos números dan el mismo color, y se alcanza toda la gama P3 (antes todo color de texto pasaba por sRGB: el rojo P3 puro del cuentagotas salía más
   apagado al pintar). Sólo afecta a lienzos 2D en P3; los de sRGB (y los de conversión con `forceSrgb`) siguen igual. */
const COLOR_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i, RGB_RE = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i;
/** `color` convertido a «color(display-p3 …)» si es un hex o un rgb()/rgba() sencillo; el resto, igual. */
export function toP3Css(color){
  if(typeof color !== "string") return color;
  let m = COLOR_RE.exec(color), r, g, b, a = 1;
  if(m){
    let h = m[1]; if(h.length <= 4) h = h.replace(/./g, "$&$&");
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); if(h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
  } else if((m = RGB_RE.exec(color))){ r = +m[1]; g = +m[2]; b = +m[3]; if(m[4] !== undefined) a = +m[4]; }
  else return color;
  const f = v => +(Math.max(0, Math.min(255, v)) / 255).toFixed(5);
  return `color(display-p3 ${f(r)} ${f(g)} ${f(b)}${a < 1 ? ` / ${+a.toFixed(4)}` : ""})`;
}
/** Color CSS para pintar en pantalla (muestras, vistas previas) lo que el documento entiende como números P3. */
export const docCss = color => isP3Doc() ? toP3Css(color) : color;
const csOf = ctx => { let c = ctx.__realifyCs; if(c === undefined){ try{ c = ctx.getContextAttributes().colorSpace; }catch{ c = "srgb"; } ctx.__realifyCs = c; } return c; };
function installP3Colors(){
  for(const ctor of [globalThis.CanvasRenderingContext2D, globalThis.OffscreenCanvasRenderingContext2D]){
    if(!ctor) continue;
    for(const prop of ["fillStyle", "strokeStyle", "shadowColor"]){
      const d = Object.getOwnPropertyDescriptor(ctor.prototype, prop); if(!d || !d.set) continue;
      Object.defineProperty(ctor.prototype, prop, { configurable: true, enumerable: d.enumerable, get(){ return d.get.call(this); },
        set(v){ d.set.call(this, typeof v === "string" && v.charCodeAt(0) !== 99 && isP3Doc() && csOf(this) === "display-p3" ? toP3Css(v) : v); } });
    }
  }
  const cg = globalThis.CanvasGradient && CanvasGradient.prototype.addColorStop;
  if(cg) CanvasGradient.prototype.addColorStop = function(o, c){ return cg.call(this, o, isP3Doc() ? toP3Css(c) : c); };
}

/** Copia del lienzo convertida a sRGB (para formatos sin perfil ICC) */
export function toSrgbCanvas(canvas){
  const c = document.createElement("canvas"); c.width = canvas.width; c.height = canvas.height;
  NativeGetContext.call(c, "2d", { colorSpace: "srgb" }).drawImage(canvas, 0, 0);
  return c;
}

/* ── detección ───────────────────────────────────────────────────
   Se decodifica una copia pequeña en un lienzo P3 y en otro sRGB, se
   pasan los valores sRGB a P3 con la matriz exacta y se comparan: si
   coinciden, la foto cabe en sRGB y el documento se queda en sRGB; si
   una parte apreciable no coincide, el navegador estaba recortando
   colores y conviene trabajar en P3. Vale para cualquier formato y
   perfil que entienda el navegador (JPEG, PNG, HEIC, AVIF, WebP…). */
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
const enc = v => { v = v <= 0 ? 0 : v >= 1 ? 1 : v; return 255 * (v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055); };

export function hasWideGamut(source){
  if(!p3Supported() || !source?.width || !source?.height) return false;
  try{
    const k = Math.min(1, 256 / Math.max(source.width, source.height));
    const w = Math.max(1, Math.round(source.width * k)), h = Math.max(1, Math.round(source.height * k));
    const read = space => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = NativeGetContext.call(c, "2d", { colorSpace: space, willReadFrequently: true });
      // Sin suavizado: cada lienzo mezclaría los vecinos en su propio
      // espacio y los bordes entre colores intensos no coincidirían.
      x.imageSmoothingEnabled = false;
      x.drawImage(source, 0, 0, w, h);
      return x.getImageData(0, 0, w, h, { colorSpace: space }).data;
    };
    const p3 = read("display-p3"), s = read("srgb"), M = rgbMatrix("srgb", "display-p3");
    let out = 0, n = 0;
    for(let i = 0; i < s.length; i += 4){
      if(s[i + 3] < 16) continue;
      n++;
      const r = lin(s[i]), g = lin(s[i + 1]), b = lin(s[i + 2]);
      for(let c = 0; c < 3; c++){
        const v = enc(M[c][0] * r + M[c][1] * g + M[c][2] * b);
        if(Math.abs(v - p3[i + c]) > 4){ out++; break; }
      }
    }
    return n > 0 && out / n > 0.002;
  }catch{ return false; }
}
