/* ══════════════════════════════════════════════════════════════
   UNMARK · ZONAS CONOCIDAS POR GENERADOR
   Dónde pinta cada generador su marca visible. Son posiciones
   aproximadas —cada servicio las cambia con las versiones— y por
   eso van con margen y se combinan con la detección automática,
   que afina dentro de la zona. Medidas en fracción del LADO CORTO
   de la imagen: un rótulo mide más o menos lo mismo en una foto
   apaisada que en una vertical de la misma resolución.

   anchor: tl tr bl br (esquinas), tc bc (centro arriba / abajo)
   w, h:   tamaño de la zona
   mx, my: margen desde el borde
   ══════════════════════════════════════════════════════════════ */

const Z = (anchor, w, h, mx = 0.02, my = 0.02) => ({ anchor, w, h, mx, my });

export const VENDORS = [
  { id:"gemini",     label:"Google Gemini / Nano Banana (destello, abajo-derecha)",
    zones:[Z("br", 0.085, 0.085, 0.018, 0.018)] },
  { id:"veo",        label:"Google Veo (rombo, abajo-derecha)",
    zones:[Z("br", 0.07, 0.07, 0.02, 0.02)] },
  { id:"doubao",     label:"Doubao / Jimeng (rótulo abajo-derecha + píldora arriba-izquierda)",
    zones:[Z("br", 0.26, 0.06), Z("tl", 0.13, 0.05)] },
  { id:"qwen",       label:"Qwen / Tongyi (rótulo abajo-centro + píldora arriba-izquierda)",
    zones:[Z("bc", 0.26, 0.06), Z("tl", 0.13, 0.05)] },
  { id:"kling",      label:"Kling AI (rótulo abajo-derecha)",
    zones:[Z("br", 0.24, 0.06)] },
  { id:"hailuo",     label:"Hailuo / MiniMax (rótulo abajo-derecha)",
    zones:[Z("br", 0.30, 0.06)] },
  { id:"hunyuan",    label:"Hunyuan (rótulo abajo-derecha)",
    zones:[Z("br", 0.24, 0.06)] },
  { id:"yuanbao",    label:"Yuanbao / Baidu / LiblibAI (abajo-centro + arriba-izquierda)",
    zones:[Z("bc", 0.26, 0.06), Z("tl", 0.13, 0.05)] },
  { id:"seedance",   label:"Seedance (etiqueta «AI» enmarcada)",
    zones:[Z("br", 0.10, 0.06), Z("tr", 0.10, 0.06)] },
  { id:"sora",       label:"Sora (mascota y rótulo, esquinas inferiores)",
    zones:[Z("br", 0.22, 0.09), Z("bl", 0.22, 0.09)] },
  { id:"microsoft",  label:"Microsoft Designer / Copilot (insignia blanca arriba-derecha)",
    zones:[Z("tr", 0.14, 0.06)] },
  { id:"samsung",    label:"Samsung Galaxy AI (etiqueta abajo-izquierda)",
    zones:[Z("bl", 0.18, 0.06)] },
  { id:"meta",       label:"Meta AI («Imagined with AI», abajo-izquierda)",
    zones:[Z("bl", 0.26, 0.06)] },
  { id:"grok",       label:"Grok / xAI (rótulo abajo-derecha)",
    zones:[Z("br", 0.14, 0.06)] },
  { id:"ideogram",   label:"Ideogram (rótulo abajo-derecha)",
    zones:[Z("br", 0.16, 0.05)] },
  { id:"runninghub", label:"RunningHub (rótulo abajo-derecha)",
    zones:[Z("br", 0.22, 0.06)] },
  { id:"dalle2",     label:"DALL·E 2 (barra de colores, abajo-derecha)",
    zones:[Z("br", 0.09, 0.02, 0, 0)] },
  { id:"corners",    label:"Las cuatro esquinas (genérico)",
    zones:[Z("br", 0.20, 0.07), Z("bl", 0.20, 0.07), Z("tr", 0.20, 0.07), Z("tl", 0.20, 0.07)] },
  { id:"bottom",     label:"Todo el borde inferior (genérico)",
    zones:[Z("bc", 4, 0.07, 0, 0.01)] }
];

export const VENDOR_BY_ID = Object.fromEntries(VENDORS.map(v => [v.id, v]));

/* Rectángulos en píxeles de una imagen w×h para un generador,
   crecidos por `pad` (0..1, fracción del lado corto). */
export function vendorRects(vendorId, w, h, pad = 0){
  const v = VENDOR_BY_ID[vendorId];
  if(!v) return [];
  const s = Math.min(w, h);
  const out = [];
  for(const z of v.zones){
    let rw = Math.min(w, z.w * s + 2 * pad * s);
    let rh = Math.min(h, z.h * s + 2 * pad * s);
    let mx = Math.max(0, z.mx * s - pad * s);
    let my = Math.max(0, z.my * s - pad * s);
    let x, y;
    switch(z.anchor){
      case "tl": x = mx; y = my; break;
      case "tr": x = w - mx - rw; y = my; break;
      case "bl": x = mx; y = h - my - rh; break;
      case "br": x = w - mx - rw; y = h - my - rh; break;
      case "tc": x = (w - rw) / 2; y = my; break;
      default:   x = (w - rw) / 2; y = h - my - rh; break;   // bc
    }
    x = Math.max(0, Math.min(w - rw, x));
    y = Math.max(0, Math.min(h - rh, y));
    out.push({ x: Math.round(x), y: Math.round(y), w: Math.round(rw), h: Math.round(rh), label: v.label });
  }
  return out;
}
