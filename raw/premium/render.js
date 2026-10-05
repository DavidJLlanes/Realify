/* ═══════════════════════════════════════════════════════════════
   REVELADO PREMIUM · entrada única para la CPU
   Lo llaman pipeline.js › renderPhoto (worker y hilo principal, con
   o sin franja) y el worker para la salida reducida en luz lineal y
   la de 16 bits. Guarda en caché, por fuente, los píxeles de un
   ráster y los mapas de baja resolución.
   ═══════════════════════════════════════════════════════════════ */
import { premiumParams, mapsKey } from "./core.js";
import { computeMaps, renderRows, downscale, sourceRowsFor, encode8, encode16 } from "./cpu.js";
import { wbGains } from "../tone.js";

const rasters = new WeakMap(), mapsCache = new WeakMap();
const canvasOf = (w, h) => {
  const c = typeof document === "undefined" ? new OffscreenCanvas(w, h) : document.createElement("canvas");
  c.width = w; c.height = h; return c;
};
/* Contexto 2D en el espacio de color indicado (sRGB o Display P3): los números del revelado Premium están ya en el espacio de salida */
const ctxOf = (c, space, opts = {}) => c.getContext("2d", { ...opts, colorSpace: space, forceSrgb: space === "srgb" });

export { ctxOf };
export function premiumSource(source){
  if((source?.linear || source?.raster16) && source?.data) return source;
  let r = rasters.get(source);
  if(!r){
    const c = canvasOf(source.width, source.height), x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(source, 0, 0);
    r = { raster: true, width: source.width, height: source.height, data: x.getImageData(0, 0, source.width, source.height).data };
    rasters.set(source, r);
  }
  return r;
}

export function prepare(source, settings){
  const src = premiumSource(source), P = premiumParams(settings, wbGains(settings));
  const key = mapsKey(settings) + "|" + P.epsChroma;
  let m = mapsCache.get(src);
  if(!m || m.key !== key){ m = { key, maps: computeMaps(src, P) }; mapsCache.set(src, m); }
  return { src, P, maps: m.maps };
}

/* Filas [y0, y1) a resolución original → lienzo de 8 bits */
export function renderPremiumCanvas(source, settings, { region = null } = {}){
  const { src, P, maps } = prepare(source, settings), W = src.width;
  const y0 = region?.y || 0, y1 = region ? region.y + region.height : src.height;
  const lin = renderRows(src, P, maps, y0, y1);
  const c = canvasOf(W, y1 - y0), x = ctxOf(c, P.space, { willReadFrequently: true });
  x.putImageData(new ImageData(encode8(lin, W, y1 - y0, y0, P.grain), W, y1 - y0, { colorSpace: P.space }), 0, 0);
  return c;
}

/* Escena en luz lineal (para la fusión HDR Premium), reducida en
   luz lineal a outW×outH, en Uint16: valor × 16 384 (hasta 4,0). */
export function renderPremiumLinear(source, settings, d0, d1, outW, outH){
  const { src, P, maps } = prepare(source, settings), W = src.width, H = src.height;
  let lin;
  if(outW === W && outH === H) lin = renderRows(src, P, maps, d0, d1, true);
  else { const s = outH / H, [y0, y1] = sourceRowsFor(d0, d1, s, H); lin = downscale(renderRows(src, P, maps, y0, y1, true), W, y0, y1 - y0, outW, d0, d1, s); }
  const out = new Uint16Array(lin.length);
  for(let i = 0; i < lin.length; i++) out[i] = Math.max(0, Math.min(65535, Math.round(lin[i] * 16384)));
  return out;
}

/* Filas de SALIDA [d0, d1) de un resultado outW×outH: se revelan las
   filas de origen correspondientes y se reducen en luz lineal. */
export function renderPremiumRows(source, settings, d0, d1, outW, outH, bits = 8){
  const { src, P, maps } = prepare(source, settings), W = src.width, H = src.height;
  let lin, w = W;
  if(outW === W && outH === H) lin = renderRows(src, P, maps, d0, d1);
  else {
    const s = outH / H, [y0, y1] = sourceRowsFor(d0, d1, s, H);
    lin = downscale(renderRows(src, P, maps, y0, y1), W, y0, y1 - y0, outW, d0, d1, s); w = outW;
  }
  return bits === 16 ? encode16(lin, w, d1 - d0, d0, P.grain) : encode8(lin, w, d1 - d0, d0, P.grain);
}
