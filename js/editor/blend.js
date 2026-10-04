/* ═══════════════════════════════════════════════════════════════
   FUSIÓN
   Aplica un lienzo sobre otro con un modo y una opacidad, resolviendo
   a mano los modos que el propio `<canvas>` no sabe hacer de forma
   nativa en vez de dejar que el navegador ignore en silencio un
   `globalCompositeOperation` que no reconoce. Sin dependencias de
   `core/doc.js` a propósito, para que lo puedan usar tanto la
   composición en vivo (editor/layertree.js) como «Combinar con la de
   abajo» (core/doc.js) sin un ciclo de imports entre los dos.

   Los 27 modos de un editor de imagen serio: 17 los entiende el
   propio `<canvas>` de forma nativa —incluido «Sumar», que es
   `globalCompositeOperation:"lighter"`, aunque no tenga nombre propio
   en la lista CSS de modos de fusión— y quedan diez que hay que
   resolver a mano, píxel a píxel, porque no están en esa lista:
   Disolver, Quemar lineal, Color más oscuro/más claro, Luz lineal,
   Luz intensa, Luz suave puntual, Mezcla fuerte, Restar y Dividir.
   ═══════════════════════════════════════════════════════════════ */

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const clamp1 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* Recorre los dos lienzos una vez y aplica `formula(base, blend)` —en
    0..255— a cada canal por separado. Cubre la mayoría de los modos a
   mano: sólo Disolver (no es un remapeo de canal, es un umbral de
   alfa) y Color más oscuro/más claro (compara el PÍXEL entero, no
   canal a canal) necesitan su propio bucle más abajo. */
function blendPerChannel(ctx, srcCanvas, w, h, opacity, formula){
  const dst = ctx.getImageData(0, 0, w, h);
  const src = srcCanvas.getContext("2d", { colorSpace:"srgb" }).getImageData(0, 0, w, h);
  const d = dst.data, s = src.data;
  for(let i = 0; i < d.length; i += 4){
    const ab=d[i+3]/255, as=(s[i+3]/255)*opacity, ao=as+ab*(1-as);
    if(as<=0||ao<=0) continue;
    for(let c=0;c<3;c++){
      const cb=d[i+c]/255, cs=s[i+c]/255, blended=formula(d[i+c],s[i+c])/255;
      const premul=(1-as)*ab*cb+(1-ab)*as*cs+ab*as*blended;
      d[i+c]=Math.round(255*premul/ao);
    }
    d[i+3]=Math.round(255*ao);
  }
  ctx.putImageData(dst, 0, 0);
}

/* Por debajo del gris medio quema (resta) linealmente, por encima
   aclara (suma): B + 2·S − 255. Un gris exacto (128) no cambia nada,
   que es justo lo que hace que una capa de detalle centrada en 128 no
   altere las zonas sin textura de lo que tiene debajo — la propiedad
   que hace falta para recombinar una separación de frecuencias con
   precisión. */
const fLinearLight = (b, s) => clamp255(b + 2 * s - 255);

/* Quemar lineal: resta sin más, la versión sin curva de Subexponer
   color — oscurece mucho más deprisa y sin la suavidad de la curva de
   división. */
const fLinearBurn = (b, s) => clamp255(b + s - 255);

/* Restar y Dividir: aritmética directa entre canales, sin curva
   ninguna — los dos modos «de calculadora», útiles para diferenciar
   dos tomas o normalizar una iluminación. */
const fSubtract = (b, s) => clamp255(b - s);
const fDivide = (b, s) => s <= 0 ? 255 : clamp255(b / s * 255);

/* Luz suave puntual: por debajo de 128 se comporta como Oscurecer
   (el mínimo de los dos), por encima como Aclarar (el máximo) — un
   interruptor duro en vez de la mezcla continua de Luz suave. */
function fPinLight(b, s){
  return s < 128 ? Math.min(b, 2 * s) : Math.max(b, clamp255(2 * s - 255));
}

/* Luz intensa: Subexponer color por debajo de 128, Sobreexponer color
   por encima, con más contraste que cualquiera de los dos por
   separado —es la versión «a lo bestia» de Luz fuerte—. Las fórmulas
   trabajan en 0..1 porque son más legibles ahí, no por nada más. */
function fVividLight(b, s){
  const B = b / 255, S = s / 255;
  const r = S <= 0.5
    ? (S <= 0 ? 0 : 1 - clamp1((1 - B) / (2 * S)))
    : (S >= 1 ? 1 : clamp1(B / (2 * (1 - S))));
  return clamp255(r * 255);
}

/* Mezcla fuerte: el resultado de Luz intensa, pero posterizado a
   negro o blanco puro según de qué lado del gris medio caiga —el modo
   más agresivo de los 27, útil para sacar un mapa de umbral rápido
   sin abrir Umbral aparte. */
const fHardMix = (b, s) => fVividLight(b, s) < 128 ? 0 : 255;

/* Color más oscuro / más claro: a diferencia de Oscurecer/Aclarar
   —que comparan canal a canal, y pueden acabar mezclando un canal de
   cada capa en un mismo píxel—, éstos comparan la LUMINOSIDAD del
   píxel entero y se quedan con esa capa completa, sin mezclar canales
   sueltos entre sí. Mismos pesos que el resto de la aplicación
   (histograma, contraste automático…). */
function blendPixelPick(ctx, srcCanvas, w, h, opacity, keepDarker){
  const dst = ctx.getImageData(0, 0, w, h);
  const src = srcCanvas.getContext("2d", { colorSpace:"srgb" }).getImageData(0, 0, w, h);
  const d = dst.data, s = src.data;
  for(let i = 0; i < d.length; i += 4){
    const as = (s[i+3] / 255) * opacity;
    if(as <= 0) continue;
    const lumD = d[i]*0.2126 + d[i+1]*0.7152 + d[i+2]*0.0722;
    const lumS = s[i]*0.2126 + s[i+1]*0.7152 + s[i+2]*0.0722;
    const pick = keepDarker ? lumS < lumD : lumS > lumD;
    if(!pick) continue;
    const ab=d[i+3]/255, ao=as+ab*(1-as);
    for(let c=0;c<3;c++){
      const cb=d[i+c]/255, cs=s[i+c]/255;
      d[i+c]=Math.round(255*((1-as)*ab*cb+(1-ab)*as*cs+ab*as*cs)/ao);
    }
    d[i+3]=Math.round(255*ao);
  }
  ctx.putImageData(dst, 0, 0);
}

/* Disolver: en vez de mezclar color, sortea qué píxeles muestran la
   capa a opacidad plena y cuáles dejan ver la de abajo sin tocar —el
   efecto de grano de una opacidad baja en una impresora de
   inyección—. El sorteo tiene que ser el MISMO en cada recomposición
   —si no, la imagen chispea cada vez que se repinta por cualquier
   motivo ajeno a esta capa—, así que en vez de `Math.random()` se
   deriva un umbral fijo de las coordenadas del propio píxel (hash
   entero barato, sin tabla ni estado). */
function hash2i(x, y){
  /* Aritmética entera de 32 bits exacta (Math.imul): el producto en coma flotante perdía bits y no coincidía con
     el de la GPU (WebGPU y el compositor de coma flotante). */
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 4096 / 4096;
}
function blendDissolve(ctx, srcCanvas, w, h, opacity){
  const dst = ctx.getImageData(0, 0, w, h);
  const src = srcCanvas.getContext("2d", { colorSpace:"srgb" }).getImageData(0, 0, w, h);
  const d = dst.data, s = src.data;
  for(let y = 0; y < h; y++){
    for(let x = 0; x < w; x++){
      const i = (y * w + x) * 4;
      const a = (s[i+3] / 255) * opacity;
      if(a <= 0) continue;
      if(hash2i(x, y) >= a) continue;   // este píxel «pierde» el sorteo: se queda como estaba
      d[i] = s[i]; d[i+1] = s[i+1]; d[i+2] = s[i+2]; d[i+3] = 255;
    }
  }
  ctx.putImageData(dst, 0, 0);
}

/* Modos que el propio `<canvas>` no entiende de forma nativa: todo lo
   demás —incluido «lighter», que sí es nativo aunque no tenga hueco
   en la lista CSS de modos de fusión— pasa directo a
   `globalCompositeOperation`. */
const CUSTOM = {
  "linear-light": (ctx, src, w, h, op) => blendPerChannel(ctx, src, w, h, op, fLinearLight),
  "linear-burn":  (ctx, src, w, h, op) => blendPerChannel(ctx, src, w, h, op, fLinearBurn),
  "subtract":     (ctx, src, w, h, op) => blendPerChannel(ctx, src, w, h, op, fSubtract),
  "divide":       (ctx, src, w, h, op) => blendPerChannel(ctx, src, w, h, op, fDivide),
  "pin-light":    (ctx, src, w, h, op) => blendPerChannel(ctx, src, w, h, op, fPinLight),
  "vivid-light":  (ctx, src, w, h, op) => blendPerChannel(ctx, src, w, h, op, fVividLight),
  "hard-mix":     (ctx, src, w, h, op) => blendPerChannel(ctx, src, w, h, op, fHardMix),
  "darker-color": (ctx, src, w, h, op) => blendPixelPick(ctx, src, w, h, op, true),
  "lighter-color":(ctx, src, w, h, op) => blendPixelPick(ctx, src, w, h, op, false),
  "dissolve":     blendDissolve
};

export const CUSTOM_BLENDS = new Set(Object.keys(CUSTOM));

export function drawWithBlend(ctx, src, blend, opacity, w, h){
  const custom = CUSTOM[blend];
  if(custom){ custom(ctx, src, w, h, opacity); return; }
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = blend;
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}

/* Ruta asíncrona para los mosaicos grandes. Los modos nativos siguen
   siendo más baratos directamente en Canvas 2D; los diez modos que
   antes obligaban a leer dos ImageData completos se mandan a WebGPU.
   Si el dispositivo o el controlador no lo permiten, la función de
   siempre conserva exactamente el mismo resultado. */
export async function drawWithBlendAccelerated(ctx, src, blend, opacity, w, h){
  if(!CUSTOM_BLENDS.has(blend)){ drawWithBlend(ctx, src, blend, opacity, w, h); return; }
  try{
    const base=document.createElement("canvas");base.width=w;base.height=h;
    base.getContext("2d",{colorSpace:"srgb"}).drawImage(ctx.canvas,0,0);
    const { gpuBlend }=await import("./webgpu.js");
    const result=await gpuBlend(base,src,blend,opacity);
    if(result){ctx.save();ctx.globalCompositeOperation="copy";ctx.globalAlpha=1;ctx.drawImage(result,0,0);ctx.restore();return;}
  }catch(err){console.info("[rendimiento] mezcla WebGPU omitida",err);}
  drawWithBlend(ctx,src,blend,opacity,w,h);
}
