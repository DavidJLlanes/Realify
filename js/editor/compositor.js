/* ═══════════════════════════════════════════════════════════════
   COMPOSITOR
   Un único lienzo visible donde se apilan todas las capas. Se
   recompone entero en cada cambio, agrupado por fotograma: para las
   resoluciones con las que se trabaja aquí, un drawImage por capa
   cuesta menos que llevar la contabilidad de qué zona ha cambiado.
   Si algún día hay treinta capas, este es el sitio donde meter
   rectángulos sucios.
   ═══════════════════════════════════════════════════════════════ */

import { on, emit } from "../core/bus.js";
import { doc } from "../core/doc.js";
import { view } from "./view.js";
import { getIsolateView } from "./masks.js";
import { buildLayerTree, compositeTree, blendAdjustResult } from "./layertree.js";
import { drawWithBlend, drawWithBlendAccelerated, CUSTOM_BLENDS } from "./blend.js";
import { isBlendIfActive, buildBlendIfAlphaCanvas } from "./blendif.js";
import { hasEnabledStyle } from "./layerstyles.js";
import { isAdjustLayer, applyAdjustLayer } from "./adjustlayers.js";
import { LARGE_DOCUMENT_PIXELS, TILE_SIZE, clampRect, unionRect, tileRectsFor,
         visibleDocumentRect, cachedLayerTile, invalidateLayerCache,
         invalidateAllLayerCaches } from "../core/performance.js";
export { blendAdjustResult };

const board = document.getElementById("board");
const stage = document.getElementById("stage");

const cv = document.createElement("canvas");
const cx = cv.getContext("2d", { colorSpace:"srgb" });
let cpuCv = null, cpuCx = null;   // ver compose(): sólo con modos de fusión a mano
board.appendChild(cv);
const tileHost=document.createElement("div");
tileHost.className="compositor-tiles";
tileHost.style.cssText="position:absolute;inset:0;pointer-events:none";
board.appendChild(tileHost);

/* Lienzo de superposiciones, aparte y del tamaño de la ventana.
   Antes se dibujaban dentro del lienzo compuesto, que mide justo lo
   que el documento, así que todo lo que cayera fuera de la imagen
   desaparecía: los tiradores de las esquinas salían cortados por la
   mitad y, al arrastrar una esquina hacia fuera —que es lo normal
   corrigiendo perspectiva—, se perdía y ya no había forma de volver a
   agarrarla. Este va por encima de todo, ocupa la ventana entera y no
   recibe clics. */
const ov = document.createElement("canvas");
const ox = ov.getContext("2d", { colorSpace:"srgb" });
/* El ancho y el alto van en CSS a propósito, no con `inset:0`. Un
   <canvas> es un elemento reemplazado: con `width:auto` el navegador
   usa su tamaño INTRÍNSECO —el de los atributos width/height— y se
   desentiende de `right`/`bottom`, así que `inset:0` no lo estira.
   Como el lienzo se dimensiona en píxeles de dispositivo, en una
   pantalla al 125 % o al 150 % (lo normal en Windows) acababa
   mostrándose un 25-50 % más grande de la cuenta, anclado arriba a la
   izquierda: el círculo del pincel y los tiradores de perspectiva se
   dibujaban desplazados, y cada vez más cuanto más lejos de esa
   esquina. Con width/height al 100 % el elemento ocupa el escenario y
   los píxeles de más se quedan donde tienen que estar, dándole nitidez
   en pantallas densas. */
ov.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;" +
                   "pointer-events:none;z-index:2";
stage.insertBefore(ov, document.getElementById("empty") || null);

const dpr = () => (typeof devicePixelRatio === "number" && devicePixelRatio) || 1;

/* Capa de dibujo temporal: el trazo en curso se pinta aquí y sólo se
   funde con la capa real al soltar. Así una pincelada es una sola
   entrada de historial y se puede cancelar a mitad. */
const scratch = document.createElement("canvas");
const sctx = scratch.getContext("2d", { colorSpace:"srgb" });
let scratchOn = false;
let scratchOwner = null;
let scratchAlpha = 1;
let scratchBlend = "source-over";
let scratchX=0,scratchY=0,scratchDirty=null;

export function beginScratch(layer, { alpha = 1, blend = "source-over", sparse = false, rect = null } = {}){
  const r=sparse&&rect?clampRect(rect,doc.w,doc.h):{x:0,y:0,w:doc.w,h:doc.h};
  scratch.width=Math.max(1,r.w);scratch.height=Math.max(1,r.h);scratchX=r.x;scratchY=r.y;
  sctx.setTransform(1,0,0,1,-scratchX,-scratchY);
  sctx.clearRect(scratchX,scratchY,scratch.width,scratch.height);
  scratchOn = true;
  scratchOwner = layer ? layer.id : null;
  scratchAlpha = alpha;
  scratchBlend = blend;
  scratchDirty={...r};
  return sctx;
}

export function scratchCtx(){ return sctx; }

/* Agranda el parche temporal sólo cuando el trazo sale de él. Así una
   pincelada de 200 px sobre una foto de 100 MP no reserva otros
   400 MB sólo para el trazo provisional. */
export function ensureScratchRect(rect){
  if(!scratchOn) return sctx;
  const r=clampRect(rect,doc.w,doc.h),current={x:scratchX,y:scratchY,w:scratch.width,h:scratch.height};
  const u=clampRect(unionRect(current,r),doc.w,doc.h);scratchDirty=unionRect(scratchDirty,r);
  if(u.x===current.x&&u.y===current.y&&u.w===current.w&&u.h===current.h)return sctx;
  const old=document.createElement("canvas");old.width=scratch.width;old.height=scratch.height;old.getContext("2d").drawImage(scratch,0,0);
  scratch.width=Math.max(1,u.w);scratch.height=Math.max(1,u.h);scratchX=u.x;scratchY=u.y;
  sctx.setTransform(1,0,0,1,-scratchX,-scratchY);sctx.drawImage(old,current.x,current.y);
  return sctx;
}

/* Vuelca el trazo temporal sobre la capa y lo apaga. */
export function endScratch(layer){
  if(!scratchOn) return;
  if(layer){
    layer.ctx.save();
    layer.ctx.globalAlpha = scratchAlpha;
    layer.ctx.globalCompositeOperation = scratchBlend;
    layer.ctx.drawImage(scratch, scratchX, scratchY);
    layer.ctx.restore();
    layer.thumbDirty = true;
  }
  scratchOn = false;
  scratchOwner = null;
  invalidateLayerCache(layer);
  const dirty=scratchDirty;scratchDirty=null;
  compose(dirty);
}

export function discardScratch(){
  scratchOn = false;
  scratchOwner = null;
  const dirty=scratchDirty;scratchDirty=null;
  compose(dirty);
}

/* Superposiciones de la herramienta activa: guías de recorte, marco
   de selección, contorno del pincel. Se dibujan encima de todo y no
   forman parte de la imagen. */
let overlayFn = null;
export function setOverlay(fn){ overlayFn = fn; scheduleOverlay(); }

/* Segundo hueco, aparte del de la herramienta activa: las guías (y sus
   reglas) tienen que verse pase lo que pase con la herramienta en
   uso, así que no pueden competir por el mismo hueco que el marco de
   recorte o el círculo del pincel. Se pinta DESPUÉS del de la
   herramienta, así que las guías quedan por encima de cualquier otra
   cosa —que es donde hace falta verlas para alinear con precisión—. */
let guideOverlayFn = null;
export function setGuideOverlay(fn){ guideOverlayFn = fn; scheduleOverlay(); }

/* Tercer hueco, igual de independiente de la herramienta activa que el
   de las guías: el contorno animado de la selección tiene que seguir
   viéndose pase lo que pase con la herramienta en uso (pintando con el
   pincel dentro de una selección, por ejemplo), no sólo mientras está
   activa la herramienta que la creó. */
let selOverlayFn = null;
export function setSelectionOverlay(fn){ selOverlayFn = fn; scheduleOverlay(); }

/* Dibuja la superposición en su propio lienzo. Se aplica la misma
   transformación que la vista le da al tablero, así que las funciones
   de superposición siguen trabajando en coordenadas de imagen y no ha
   habido que reescribir ninguna: lo único que cambia es que ahora
   pueden salirse de los bordes del documento. */
export function composeOverlay(){
  const k = dpr();
  const w = Math.max(1, Math.round(stage.clientWidth  * k));
  const h = Math.max(1, Math.round(stage.clientHeight * k));
  if(ov.width !== w || ov.height !== h){ ov.width = w; ov.height = h; }

  ox.setTransform(1, 0, 0, 1, 0, 0);
  ox.clearRect(0, 0, w, h);
  if((!overlayFn && !guideOverlayFn && !selOverlayFn) || !doc.open) return;

  ox.save();
  ox.setTransform(k, 0, 0, k, 0, 0);
  ox.translate(view.x, view.y);
  ox.scale(view.zoom, view.zoom);
  if(overlayFn){ try{ overlayFn(ox); }catch(err){ console.error("[overlay]", err); } }
  if(selOverlayFn){ try{ selOverlayFn(ox); }catch(err){ console.error("[overlay-seleccion]", err); } }
  if(guideOverlayFn){ try{ guideOverlayFn(ox); }catch(err){ console.error("[overlay-guias]", err); } }
  ox.restore();
}

let queued=false,ovQueued=false,pendingDirty=null,pendingInvalidate=false;
export function scheduleCompose(opts={}){
  if(opts && opts.rect) pendingDirty=unionRect(pendingDirty,opts.rect);
  else pendingDirty={x:0,y:0,w:doc.w,h:doc.h};
  if(opts.layer)invalidateLayerCache(opts.layer);
  else if(!opts.transient) pendingInvalidate=true;
  if(queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued=false;const dirty=pendingDirty,inv=pendingInvalidate;pendingDirty=null;pendingInvalidate=false;
    if(inv)invalidateAllLayerCaches(doc.layers);compose(dirty);
  });
}

/* Al mover o hacer zoom sólo hace falta repintar la superposición: la
   pila de capas no ha cambiado y recomponerla entera en cada píxel de
   arrastre es justo lo que hacía que el paneo fuera a tirones. */
export function scheduleOverlay(){
  if(ovQueued) return;
  ovQueued = true;
  requestAnimationFrame(() => { ovQueued = false; composeOverlay(); });
}

const liveTiles=new Map(),tileTokens=new Map();
let tiledMode=false,composeGeneration=0;

function canUseTiledView(){
  if(doc.w*doc.h<LARGE_DOCUMENT_PIXELS||getIsolateView()!==null)return false;
  return doc.layers.every(l=>!hasEnabledStyle(l.styles));
}
function switchMode(next){
  if(next===tiledMode)return;tiledMode=next;
  cv.style.display=next?"none":"block";tileHost.style.display=next?"block":"none";
  if(!next){for(const c of liveTiles.values())c.remove();liveTiles.clear();tileTokens.clear();}
  else{cv.width=cv.height=1;}
}
function cropCanvas(source,r){const c=document.createElement("canvas");c.width=r.w;c.height=r.h;c.getContext("2d",{colorSpace:"srgb"}).drawImage(source,r.x,r.y,r.w,r.h,0,0,r.w,r.h);return c;}
function effectiveMask(layer){if(layer.maskRef){const ref=doc.layers.find(l=>l.id===layer.maskRef);return ref?.mask||null;}return layer.mask;}

async function compositeTileNodes(nodes,rect,ctx,generation,scale){
  const rw=ctx.canvas.width,rh=ctx.canvas.height;let clipBase=null;
  for(const node of nodes){
    const l=node.layer;
    if(generation!==composeGeneration)return;
    if(!l.visible||l.opacity<=0||l.__editing)continue;
    if(isAdjustLayer(l)){
      const img=ctx.getImageData(0,0,rw,rh),orig=Uint8ClampedArray.from(img.data);applyAdjustLayer(l,img.data,rw,rh);
      const mask=effectiveMask(l);let alpha=null;if(mask&&l.maskEnabled){const mc=cropCanvas(mask.canvas,rect),scaled=document.createElement("canvas");scaled.width=rw;scaled.height=rh;scaled.getContext("2d").drawImage(mc,0,0,rw,rh);const md=scaled.getContext("2d",{willReadFrequently:true}).getImageData(0,0,rw,rh).data;alpha=new Uint8ClampedArray(rw*rh);for(let i=0,p=3;i<alpha.length;i++,p+=4)alpha[i]=md[p];}
      blendAdjustResult(img.data,orig,l.opacity,alpha);ctx.putImageData(img,0,0);continue;
    }
    let drawn;
    if(l.type==="group"){
      drawn=document.createElement("canvas");drawn.width=rw;drawn.height=rh;
      await compositeTileNodes(node.children||[],rect,drawn.getContext("2d",{colorSpace:"srgb"}),generation,scale);
    }else drawn=cachedLayerTile(l,rect,scale);
    const mask=effectiveMask(l),ownMasked=!!(mask&&l.maskEnabled),hasScratch=scratchOn&&l.type!=="group"&&scratchOwner===l.id,doClip=!!(l.clipped&&clipBase),hasBlendIf=l.type!=="group"&&isBlendIfActive(l.blendIf),underlying=hasBlendIf?ctx.getImageData(0,0,rw,rh):null;
    if(ownMasked||hasScratch||doClip||hasBlendIf){
      const tmp=document.createElement("canvas");tmp.width=rw;tmp.height=rh;const t=tmp.getContext("2d",{colorSpace:"srgb"});t.drawImage(drawn,0,0);
      if(hasScratch){t.globalAlpha=scratchAlpha;t.globalCompositeOperation=scratchBlend;t.save();t.scale(scale,scale);t.drawImage(scratch,scratchX-rect.x,scratchY-rect.y);t.restore();t.globalAlpha=1;t.globalCompositeOperation="source-over";}
      if(hasBlendIf){const a=buildBlendIfAlphaCanvas(tmp,underlying,rw,rh,l.blendIf);t.globalCompositeOperation="destination-in";t.drawImage(a,0,0);t.globalCompositeOperation="source-over";}
      if(ownMasked){t.globalCompositeOperation="destination-in";t.drawImage(mask.canvas,rect.x,rect.y,rect.w,rect.h,0,0,rw,rh);t.globalCompositeOperation="source-over";}
      if(doClip){t.globalCompositeOperation="destination-in";t.drawImage(clipBase,0,0);t.globalCompositeOperation="source-over";}
      drawn=tmp;
    }
    if(!l.clipped)clipBase=drawn;
    if(CUSTOM_BLENDS.has(l.blend))await drawWithBlendAccelerated(ctx,drawn,l.blend,l.opacity,rw,rh);
    else drawWithBlend(ctx,drawn,l.blend,l.opacity,rw,rh);
  }
}
async function compositeTile(rect,ctx,generation,scale){
  const rw=ctx.canvas.width,rh=ctx.canvas.height;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,rw,rh);
  await compositeTileNodes(buildLayerTree(doc.layers),rect,ctx,generation,scale);
}
function tileCanvas(rect,scale){
  const w=Math.max(1,Math.ceil(rect.w*scale)),h=Math.max(1,Math.ceil(rect.h*scale));let c=liveTiles.get(rect.key);if(c&&c.width===w&&c.height===h)return c;
  if(c)c.remove();c=document.createElement("canvas");c.width=w;c.height=h;c.dataset.tile=rect.key;c.dataset.scale=String(scale);
  c.style.cssText=`left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px`;
  tileHost.appendChild(c);liveTiles.set(rect.key,c);return c;
}
function composeTiled(dirty){
  const scale=Math.min(1,Math.max(.125,view.zoom*((typeof devicePixelRatio==="number"&&devicePixelRatio)||1)*1.25)),visible=visibleDocumentRect(view,stage,doc.w,doc.h,1),wanted=tileRectsFor(visible,doc.w,doc.h,TILE_SIZE),keep=new Set(wanted.map(r=>r.key)),generation=++composeGeneration;
  for(const [key,c]of liveTiles)if(!keep.has(key)){c.remove();liveTiles.delete(key);tileTokens.delete(key);}
  const d=dirty?clampRect(dirty,doc.w,doc.h):null;
  for(const r of wanted){
    const old=liveTiles.get(r.key),exists=!!old,resolutionChanged=!old||old.width!==Math.max(1,Math.ceil(r.w*scale))||old.height!==Math.max(1,Math.ceil(r.h*scale)),touch=!d||!(r.x+r.w<=d.x||r.y+r.h<=d.y||r.x>=d.x+d.w||r.y>=d.y+d.h);
    const c=tileCanvas(r,scale);if(exists&&!touch&&!resolutionChanged)continue;const token=(tileTokens.get(r.key)||0)+1;tileTokens.set(r.key,token);
    compositeTile(r,c.getContext("2d",{colorSpace:"srgb"}),generation,scale).then(()=>{if(tileTokens.get(r.key)===token)emit("compositor:tile",r);}).catch(err=>console.error("[mosaico]",err));
  }
  composeOverlay();emit("compositor:done");
}

export function compose(dirty=null){
  if(!doc.open){ cv.width = cv.height = 0;tileHost.innerHTML="";liveTiles.clear(); return; }
  switchMode(canUseTiledView());
  if(tiledMode){composeTiled(dirty);return;}
  if(cv.width !== doc.w || cv.height !== doc.h){
    cv.width = doc.w; cv.height = doc.h;
  }
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.clearRect(0, 0, doc.w, doc.h);

  /* Alt+clic en una miniatura de máscara (panels.js): el lienzo
     enseña sólo esa máscara, en escala de grises, hasta que se
     repite el gesto. El dato real vive en el alfa (ver masks.js), así
     que "verlo en gris" es volcar ese alfa a RGB y dejar el propio
     alfa opaco del todo, para que no se transparente con lo de abajo. */
  const isolateId = getIsolateView();
  if(isolateId !== null){
    const iso = doc.layers.find(x => x.id === isolateId);
    if(iso && iso.mask){
      const img = iso.mask.ctx.getImageData(0, 0, doc.w, doc.h);
      const d = img.data;
      for(let i = 0; i < d.length; i += 4){
        const g = d[i + 3];
        d[i] = d[i + 1] = d[i + 2] = g;
        d[i + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
      composeOverlay();
      emit("compositor:done");
      return;
    }
  }

  // El recorrido de verdad —grupos, máscaras, recorte a la capa de
  // abajo, capas de ajuste y estilos de capa— vive en layertree.js,
  // compartido con `flatten()` (aplanar y exportar): aquí sólo se le
  // pasa el trazo en curso, que es un concepto puramente de la vista
  // en directo y no tiene sentido al exportar.
  const live = {
    on: scratchOn, ownerId: scratchOwner, canvas: scratch,
    alpha: scratchAlpha, blend: scratchBlend, x:scratchX, y:scratchY
  };
  /* Los modos de fusión resueltos a mano (blend.js) leen con
     getImageData el lienzo sobre el que se compone, una vez por capa y
     por repintado. Sobre `cv`, que vive en la GPU, cada lectura es una
     descarga lenta (y el navegador lo avisa en la consola). Sólo en ese
     caso se compone en un lienzo auxiliar en CPU y se copia de una vez;
     sin esos modos, todo sigue igual, directo sobre `cv`. */
  if(doc.layers.some(l => l.visible && CUSTOM_BLENDS.has(l.blend))){
    if(!cpuCv){
      cpuCv = document.createElement("canvas");
      cpuCx = cpuCv.getContext("2d", { colorSpace:"srgb", willReadFrequently:true });
    }
    if(cpuCv.width !== doc.w || cpuCv.height !== doc.h){ cpuCv.width = doc.w; cpuCv.height = doc.h; }
    cpuCx.setTransform(1, 0, 0, 1, 0, 0);
    cpuCx.clearRect(0, 0, doc.w, doc.h);
    compositeTree(buildLayerTree(doc.layers), cpuCx, doc.w, doc.h, live);
    cx.drawImage(cpuCv, 0, 0);
  } else {
    if(cpuCv){ cpuCv.width = cpuCv.height = 0; cpuCv = null; cpuCx = null; }
    compositeTree(buildLayerTree(doc.layers), cx, doc.w, doc.h, live);
  }

  composeOverlay();
  emit("compositor:done");
}

export const canvasEl = () => {
  if(!tiledMode)return cv;
  const c=document.createElement("canvas");c.width=doc.w;c.height=doc.h;
  compositeTree(buildLayerTree(doc.layers),c.getContext("2d",{colorSpace:"srgb"}),doc.w,doc.h,null);
  return c;
};

/* Lee el color compuesto en un punto, para el cuentagotas. */
export function pickColor(x, y){
  x = Math.floor(x); y = Math.floor(y);
  if(x<0||y<0||x>=doc.w||y>=doc.h)return null;
  let d;
  if(tiledMode){const key=`${Math.floor(x/TILE_SIZE)}:${Math.floor(y/TILE_SIZE)}`,c=liveTiles.get(key);if(!c)return null;const scale=+c.dataset.scale||1;d=c.getContext("2d").getImageData(Math.max(0,Math.min(c.width-1,Math.floor((x-(+c.style.left.replace("px","")))*scale))),Math.max(0,Math.min(c.height-1,Math.floor((y-(+c.style.top.replace("px","")))*scale))),1,1).data;}
  else d=cx.getImageData(x,y,1,1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

on("doc:change",()=>scheduleCompose());
on("doc:structure",()=>scheduleCompose());
on("mask:isolate",()=>scheduleCompose());
on("doc:resize",()=>{scratch.width=scratch.height=1;scratchX=scratchY=0;invalidateAllLayerCaches(doc.layers);compose();});

/* La superposición vive en coordenadas de pantalla, así que al mover o
   ampliar la vista hay que repintarla aunque la imagen no cambie. */
on("view:change",()=>{scheduleOverlay();if(tiledMode)composeTiled(null);});
addEventListener("resize",()=>{scheduleOverlay();if(tiledMode)composeTiled(null);});
