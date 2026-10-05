/* Intercambio con editores externos. TIFF guarda el compuesto sin pérdidas;
   PSD conserva grupos y capas rasterizadas. El proyecto .realify sigue siendo
   la copia que conserva los mandos nativos de texto, filtros y ajustes. */
import { doc } from "../core/doc.js";
import { buildLayerTree, flatten } from "../editor/layertree.js";
import { profileFor } from "../core/icc.js";
import { hasEnabledStyle } from "../editor/layerstyles.js";
import { hiToCanvas8, hiCoversCanvas } from "../core/hisrc.js";
import { rebuildPsd16, addImageResource } from "./psdlayers16.js";

export async function tiffFromCanvas(canvas, space = "srgb"){
  // Display P3: se guardan los números P3 con su perfil ICC incrustado; si no, sRGB (en documentos P3 el navegador convierte)
  const p3 = space === "display-p3";
  const rgba = canvas.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, canvas.width, canvas.height, { colorSpace: p3 ? "display-p3" : "srgb" }).data;
  return (await import("./formats16.js")).tiff8(rgba, canvas.width, canvas.height, space);
}

/* Modos de fusión de Realify → los de Photoshop (los 27, más «sumar» = linear dodge). */
export const PSD_BLEND = {
  "source-over":"normal", multiply:"multiply", screen:"screen", overlay:"overlay", darken:"darken", lighten:"lighten",
  "color-dodge":"color dodge", "color-burn":"color burn", "hard-light":"hard light", "soft-light":"soft light",
  difference:"difference", exclusion:"exclusion", hue:"hue", saturation:"saturation", color:"color", luminosity:"luminosity",
  lighter:"linear dodge", "linear-light":"linear light", "linear-burn":"linear burn", subtract:"subtract", divide:"divide",
  "pin-light":"pin light", "vivid-light":"vivid light", "hard-mix":"hard mix", "darker-color":"darker color",
  "lighter-color":"lighter color", dissolve:"dissolve"
};
const hexRgb = h => { const t = String(h || "#000000").replace("#", ""), n = parseInt(t.length === 3 ? t.split("").map(c => c + c).join("") : t, 16) || 0; return { r:(n >> 16) & 255, g:(n >> 8) & 255, b:n & 255 }; };
const px = v => ({ units:"Pixels", value:v });
const effectiveMask = l => l.maskRef ? doc.layers.find(x => x.id === l.maskRef)?.mask : l.mask;

/** Estilos de capa de Realify → efectos de capa de Photoshop (sombra, resplandor exterior, trazo, degradado). */
export function psdEffects(st, k = 1){
  if(!st) return null;
  const e = {};
  if(st.shadow?.enabled){
    const s = st.shadow, dx = s.x ?? 4, dy = s.y ?? 4;
    // La luz de Photoshop viene de «angle»: la sombra cae al lado contrario (y hacia arriba es positivo)
    let ang = Math.atan2(-dy, dx) * 180 / Math.PI + 180; if(ang > 180) ang -= 360;
    e.dropShadow = [{ present:true, showInDialog:true, enabled:true, size:px((s.blur ?? 8) * k), distance:px(Math.hypot(dx, dy) * k), angle:ang,
      color:hexRgb(s.color), blendMode:"normal", opacity:(s.opacity ?? 75) / 100, useGlobalLight:false, antialiased:true, choke:px(0), layerConceals:true }];
  }
  if(st.glow?.enabled){
    const g = st.glow;
    e.outerGlow = { present:true, showInDialog:true, enabled:true, size:px((g.size ?? 12) * k), color:hexRgb(g.color), blendMode:"normal",
      opacity:(g.opacity ?? 75) / 100, source:"edge", antialiased:true, noise:0, range:1, choke:px(0), jitter:0 };
  }
  if(st.stroke?.enabled){
    const t = st.stroke;
    e.stroke = [{ present:true, showInDialog:true, enabled:true, overprint:false, size:px((t.width ?? 3) * k), position:"outside", fillType:"color",
      blendMode:"normal", opacity:1, color:hexRgb(t.color ?? "#ffffff") }];
  }
  if(st.gradient?.enabled){
    const g = st.gradient;
    let ang = -(g.angle || 0); while(ang > 180) ang -= 360; while(ang < -180) ang += 360;      // pantalla (y abajo) → matemático (y arriba)
    e.gradientOverlay = [{ present:true, showInDialog:true, enabled:true, blendMode:"normal", opacity:(g.opacity ?? 100) / 100, align:true, scale:1,
      dither:false, reverse:false, type:"linear", angle:ang, offset:{ x:0, y:0 },
      gradient:{ name:"Realify", type:"solid", smoothness:1,
        colorStops:[{ color:hexRgb(g.color1), location:0, midpoint:0.5 }, { color:hexRgb(g.color2), location:1, midpoint:0.5 }],
        opacityStops:[{ opacity:1, location:0, midpoint:0.5 }, { opacity:1, location:1, midpoint:0.5 }] } }];
  }
  return Object.keys(e).length ? e : null;
}

/** Capa de ajuste de Realify → capa de ajuste de Photoshop, sólo las que dan el mismo resultado (invertir, niveles
    y curvas); null si no hay equivalente fiel (entonces sólo queda en la vista final y el proyecto .realify). */
export function psdAdjustment(l){
  const p = l.adjustParams || {};
  if(l.adjustType === "invert") return { type:"invert" };
  if(l.adjustType === "levels"){
    const ch = { shadowInput:Math.round(p.inLow ?? 0), highlightInput:Math.round(p.inHigh ?? 255), shadowOutput:Math.round(p.outLow ?? 0),
      highlightOutput:Math.round(p.outHigh ?? 255), midtoneInput:+(p.gamma ?? 1) };
    const id = { shadowInput:0, highlightInput:255, shadowOutput:0, highlightOutput:255, midtoneInput:1 };
    const c = p.channel || "rgb";
    return { type:"levels", rgb:c === "rgb" ? ch : id, red:c === "r" ? ch : id, green:c === "g" ? ch : id, blue:c === "b" ? ch : id };
  }
  if(l.adjustType === "curves"){
    const pts = (p.points && p.points.length >= 2 ? p.points : [[0,0],[255,255]]).map(([x, y]) => ({ input:Math.round(x), output:Math.round(y) }));
    return { type:"curves", rgb:pts };
  }
  return null;
}

/** Píxeles de 16 bits de una capa rasterizada (recortados a su caja): RGB del origen de 16 bits donde el lienzo sigue siendo su redondeo (misma regla que core/hisrc.js) y
    8 bits × 257 en el resto; el alfa, el del lienzo × 257. */
function hiPlanes(l, raster, W, H, scale){
  const d = raster.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, W, H, { colorSpace:"srgb" }).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) if(d[(y * W + x) * 4 + 3]){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  if(x1 < 0) return { rect:{ top:0, left:0, bottom:0, right:0 }, planes:null };
  const w = x1 - x0 + 1, h = y1 - y0 + 1, n = w * h, r = new Uint16Array(n), g = new Uint16Array(n), b = new Uint16Array(n), a = new Uint16Array(n);
  const hs = scale === 1 && hiCoversCanvas(l) ? l.hiSrc : null;
  for(let y = 0, k = 0; y < h; y++) for(let x = 0; x < w; x++, k++){
    const X = x0 + x, Y = y0 + y, i = (Y * W + X) * 4;
    a[k] = d[i + 3] * 257;
    if(!d[i + 3]) continue;
    if(hs){
      const j = (Y * W + X) * 3, R = hs.data[j], G = hs.data[j + 1], B = hs.data[j + 2];
      if(hiToCanvas8(R, X, Y, 0, hs.dither) === d[i] && hiToCanvas8(G, X, Y, 1, hs.dither) === d[i + 1] && hiToCanvas8(B, X, Y, 2, hs.dither) === d[i + 2]){ r[k] = R; g[k] = G; b[k] = B; continue; }
    }
    r[k] = d[i] * 257; g[k] = d[i + 1] * 257; b[k] = d[i + 2] * 257;
  }
  return { rect:{ top:y0, left:x0, bottom:y1 + 1, right:x1 + 1 }, planes:{ r, g, b, a } };
}

/* Inserta un recurso de imagen (el perfil ICC, id 1039) en un PSD/PSB ya escrito: ag-psd no lo hace. */
function addIccResource(u8, icc){
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const cmdLen = dv.getUint32(26), irStart = 30 + cmdLen, irLen = dv.getUint32(irStart);
  const data = icc.length & 1 ? Uint8Array.from([...icc, 0]) : icc;
  const res = new Uint8Array(12 + data.length), rv = new DataView(res.buffer);
  res.set([0x38, 0x42, 0x49, 0x4D, 0x04, 0x0F, 0, 0], 0); rv.setUint32(8, icc.length); res.set(data, 12);
  const out = new Uint8Array(u8.length + res.length);
  out.set(u8.subarray(0, irStart + 4 + irLen), 0);
  out.set(res, irStart + 4 + irLen);
  out.set(u8.subarray(irStart + 4 + irLen), irStart + 4 + irLen + res.length);
  new DataView(out.buffer).setUint32(irStart, irLen + res.length);
  return out;
}

/**
 * PSD (o PSB, con `psb`) con grupos, capas, máscaras de capa REALES, estilos de capa como efectos de Photoshop, los 27 modos de
 * fusión, recorte, y las capas de ajuste que tienen equivalente fiel (invertir, niveles, curvas). Cada capa va sin
 * máscara ni estilos horneados: se pueden seguir editando en Photoshop. Resolución de 72 ppp y perfil sRGB.
 * Lo que no se traduce (texto, objetos inteligentes, Fusionar si, el resto de ajustes) va rasterizado, y una copia oculta
 * «Vista final · referencia» enseña el aspecto de Realify.
 */
export function layeredPsd(scale = 1, { psb = false, hi = null, meta = null } = {}){
  const A = globalThis.agPsd;
  if(!A?.writePsdUint8Array) throw new Error("El codificador PSD no está disponible");
  const width = Math.round(doc.w * scale), height = Math.round(doc.h * scale);
  if(!psb && (width > 30000 || height > 30000)) throw new Error("PSD admite como máximo 30 000 píxeles por lado: usa PSB para documentos más grandes");
  if(width > 300000 || height > 300000) throw new Error("PSB admite como máximo 300 000 píxeles por lado");
  const resize = canvas => {
    if(scale === 1) return canvas;
    const c = document.createElement("canvas"); c.width = width; c.height = height;
    const x = c.getContext("2d", { colorSpace:"srgb" }); x.imageSmoothingQuality = "high";
    x.drawImage(canvas, 0, 0, width, height); return c;
  };
  const dataOf = canvas => resize(canvas).getContext("2d", { willReadFrequently:true }).getImageData(0, 0, width, height, { colorSpace:"srgb" });
  let unsupported = false;
  /* 16 bits (hi = { composite }): ag-psd escribe la estructura con una imagen mínima por capa y psdlayers16.js la reescribe con los píxeles de 16 bits;
     `provs` lleva, por nodo, de dónde salen esos píxeles (la capa rasterizada y la capa cuya máscara cuenta). */
  const provs = new Map(), tiny = () => new ImageData(1, 1, { colorSpace:"srgb" });
  const maskOf = l => {
    const m = effectiveMask(l);
    if(!m) return null;
    if(hi) return { top:0, left:0, bottom:1, right:1, defaultColor:255, disabled:l.maskEnabled === false, imageData:tiny(), __src:m.canvas };
    const src = dataOf(m.canvas), d = new Uint8ClampedArray(src.data.length);
    for(let i = 0; i < d.length; i += 4){ d[i] = d[i + 1] = d[i + 2] = src.data[i + 3]; d[i + 3] = 255; }    // el dato de la máscara vive en el alfa
    return { top:0, left:0, bottom:height, right:width, defaultColor:255, disabled:l.maskEnabled === false, imageData:new ImageData(d, width, height, { colorSpace:"srgb" }) };
  };
  const nodes = list => list.slice().reverse().flatMap(({ layer:l, children }) => {
    const common = { name:l.name || "Capa", hidden:!l.visible, opacity:l.opacity ?? 1, blendMode:PSD_BLEND[l.blend] || "normal" };
    if(!PSD_BLEND[l.blend] && l.blend) unsupported = true;
    if(l.type === "adjust"){
      const adjustment = psdAdjustment(l);
      if(!adjustment){ unsupported = true; return []; }
      const m = maskOf(l), node = { ...common, adjustment, ...(m ? { mask:m } : {}) };
      provs.set(node, { mask:m && m.__src });
      return [node];
    }
    const effects = psdEffects(l.styles && hasEnabledStyle(l.styles) ? l.styles : null, scale), m = maskOf(l);
    if(l.blendIf) unsupported = true;
    if(children){
      const node = { ...common, children:nodes(children), ...(m ? { mask:m } : {}), ...(effects ? { effects } : {}) };
      provs.set(node, { mask:m && m.__src, group:true });
      return [node];
    }
    // Los píxeles de la capa SIN máscara, estilos, recorte ni «Fusionar si» (van aparte, como en Photoshop)
    const raster = flatten(null, [{ ...l, groupId:null, visible:true, opacity:1, blend:"source-over", clipped:false,
      mask:null, maskRef:null, styles:null, blendIf:null }], doc.w, doc.h);
    const node = { ...common, clipping:!!l.clipped, imageData:hi ? tiny() : dataOf(raster), ...(m ? { mask:m } : {}), ...(effects ? { effects } : {}) };
    if(hi) provs.set(node, { layer:l, raster, mask:m && m.__src });
    return [node];
  });
  const imageData = hi ? null : dataOf(flatten());
  const psd = { width, height, ...(imageData ? { imageData } : {}), children:nodes(buildLayerTree(doc.layers)),
    imageResources:{ resolutionInfo:{ horizontalResolution:72, horizontalResolutionUnit:"PPI", widthUnit:"Centimeters",
      verticalResolution:72, verticalResolutionUnit:"PPI", heightUnit:"Centimeters" } } };
  // Una copia oculta facilita comparar la apariencia final si algo propio de Realify no se traduce a PSD.
  if(!hi && (unsupported || doc.layers.some(l => l.type === "text" || l.smart)))
    psd.children.unshift({ name:"Vista final · referencia", hidden:true, imageData });
  if(meta && meta.xmp) psd.imageResources.xmpMetadata = meta.xmp;
  let bytes = A.writePsdUint8Array(psd, { noBackground:true, trimImageData:!hi, psb });
  if(hi){
    // los orígenes de píxeles, en el orden del archivo (un grupo = divisor, hijos, grupo)
    const order = [];
    const walk = list => { for(const n of list){ const pv = provs.get(n);            // ag-psd escribe `children` en el orden dado (de abajo arriba)
      if(n.children){ order.push(null); walk(n.children); order.push(pv || null); } else order.push(pv || null); } };
    walk(psd.children);
    const grab = c => { const d = c.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, c.width, c.height).data; return d; };
    const providers = order.map(pv => {
      if(!pv) return null;
      const out = { rect:null, planes:null, mask:null };
      if(pv.layer) Object.assign(out, hiPlanes(pv.layer, resize(pv.raster), width, height, scale));
      if(pv.mask){
        const md = grab(resize(pv.mask)), data = new Uint16Array(width * height);
        for(let i = 0; i < data.length; i++) data[i] = md[i * 4 + 3] * 257;
        out.mask = { rect:{ top:0, left:0, bottom:height, right:width }, data };
      }
      return out;
    });
    bytes = rebuildPsd16(bytes, providers, { width, height, psb, composite:hi.composite });
  }
  try{ bytes = addIccResource(bytes, profileFor("srgb")); }catch(err){ console.warn("[psd] sin perfil ICC", err); }
  if(meta && meta.exif){ try{ bytes = addImageResource(bytes, 1058, meta.exif); }catch(err){ console.warn("[psd] sin EXIF", err); } }
  return new Blob([bytes], { type:"image/vnd.adobe.photoshop" });
}
