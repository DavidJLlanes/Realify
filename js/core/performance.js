/* Infraestructura de rendimiento para documentos grandes.
   Mantiene la política en un módulo pequeño: tamaño de mosaico,
   rectángulos sucios y una caché LRU de recortes por capa. */

import { COARSE } from "./device.js";

const memory = Number(navigator.deviceMemory) || (COARSE ? 4 : 8);
export const TILE_SIZE = COARSE || memory <= 4 ? 256 : 512;
export const LARGE_DOCUMENT_PIXELS = COARSE || memory <= 4 ? 8_000_000 : 18_000_000;
export const CACHE_TILES_PER_LAYER = memory <= 4 ? 12 : memory <= 8 ? 24 : 48;

export const clampRect = (r, w, h) => {
  if(!r) return { x:0, y:0, w, h };
  const x = Math.max(0, Math.floor(r.x));
  const y = Math.max(0, Math.floor(r.y));
  const x2 = Math.min(w, Math.ceil(r.x + r.w));
  const y2 = Math.min(h, Math.ceil(r.y + r.h));
  return { x, y, w:Math.max(0, x2 - x), h:Math.max(0, y2 - y) };
};

export function unionRect(a, b){
  if(!a) return b ? { ...b } : null;
  if(!b) return { ...a };
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.w, b.x + b.w);
  const y2 = Math.max(a.y + a.h, b.y + b.h);
  return { x, y, w:x2-x, h:y2-y };
}

export function tileRectsFor(rect, w, h, size = TILE_SIZE){
  const r = clampRect(rect, w, h), out = [];
  if(!r.w || !r.h) return out;
  const x0 = Math.floor(r.x / size), y0 = Math.floor(r.y / size);
  const x1 = Math.floor((r.x + r.w - 1) / size), y1 = Math.floor((r.y + r.h - 1) / size);
  for(let ty=y0; ty<=y1; ty++) for(let tx=x0; tx<=x1; tx++){
    const x=tx*size, y=ty*size;
    out.push({ tx, ty, x, y, w:Math.min(size,w-x), h:Math.min(size,h-y), key:`${tx}:${ty}` });
  }
  return out;
}

export function visibleDocumentRect(view, stage, w, h, padTiles = 1){
  const z = Math.max(.0001, view.zoom), pad = TILE_SIZE * padTiles;
  return clampRect({
    x:(-view.x)/z-pad, y:(-view.y)/z-pad,
    w:stage.clientWidth/z+pad*2, h:stage.clientHeight/z+pad*2
  }, w, h);
}

const layerCaches = new WeakMap();
export function invalidateLayerCache(layer){ if(layer) layerCaches.delete(layer); }
export function invalidateAllLayerCaches(layers){ for(const l of layers || []) invalidateLayerCache(l); }

/* Recorta sólo una vez cada capa para cada mosaico visible. La caché
   se vacía al mutar la capa; durante una pincelada el original queda
   inmóvil y se reutiliza, mientras sólo cambia el parche temporal. */
export function cachedLayerTile(layer, rect, scale = 1){
  let cache = layerCaches.get(layer);
  if(!cache){ cache = new Map(); layerCaches.set(layer, cache); }
  const key = `${rect.x}:${rect.y}:${rect.w}:${rect.h}:${scale.toFixed(3)}`;
  if(cache.has(key)){
    const hit = cache.get(key); cache.delete(key); cache.set(key, hit);
    return hit;
  }
  const c=document.createElement("canvas"); c.width=Math.max(1,Math.ceil(rect.w*scale)); c.height=Math.max(1,Math.ceil(rect.h*scale));
  const x=c.getContext("2d",{colorSpace:"srgb"});x.imageSmoothingQuality="high";x.drawImage(layer.canvas,rect.x,rect.y,rect.w,rect.h,0,0,c.width,c.height);
  cache.set(key,c);
  while(cache.size>CACHE_TILES_PER_LAYER) cache.delete(cache.keys().next().value);
  return c;
}

export const performanceProfile = () => ({
  tileSize:TILE_SIZE, largeDocumentPixels:LARGE_DOCUMENT_PIXELS,
  deviceMemory:memory, webgpu:!!navigator.gpu
});
