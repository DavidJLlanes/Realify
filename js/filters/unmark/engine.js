/* ══════════════════════════════════════════════════════════════
   UNMARK · MOTOR

   PROVENIENCIA: Basado en https://github.com/wiltodelta/remove-ai-watermarks
   El motor orquesta la cadena de detección, relleno y perturbación
   de píxeles, adaptando conceptos del proyecto de referencia mencionado.

   Orquesta la cadena entera sobre un lienzo de origen y devuelve
   otro con el resultado. La misma función sirve a la vista previa
   (sobre un proxy reducido, sin las etapas lentas) y a Aplicar
   (resolución completa, con todo): un solo camino, un solo
   resultado, que es la regla de la casa desde Realify.

     máscara (detección ∪ generador ∪ región ∪ selección)
       → relleno (local)
       → perturbaciones locales (worker)
       → limpieza espectral (CPU)
       → recompresión JPEG (CPU, asíncrona)
   ══════════════════════════════════════════════════════════════ */

import { CHAIN, WORKER_ORDER } from "./chain.js";
import { effParams } from "./state.js";
import { vendorRects } from "./vendors.js";
import { fullMaskFromDetection, rectMask } from "./detect.js";
import { inpaint, maskToCanvas } from "./inpaint.js";
import { rng } from "./disrupt.js";
import { removePeriodicPatterns } from "../camera/spectralclean.js";

/* ── worker ──────────────────────────────────────────────────── */
let worker = null, nextId = 1;
const pending = new Map();

function ensureWorker(){
  if(worker) return worker;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = e => {
    const m = e.data || {};
    const p = pending.get(m.id);
    if(!p) return;
    if(m.progress !== undefined){ p.onProgress?.(m.progress); return; }
    pending.delete(m.id);
    if(m.error) p.reject(new Error(m.error));
    else p.resolve(m.data);
  };
  worker.onerror = ev => {
    const err = new Error(ev.message || "El worker de Unmark ha fallado");
    for(const p of pending.values()) p.reject(err);
    pending.clear();
    worker = null;
  };
  return worker;
}

export function disruptAsync(img, stages, seed, onProgress){
  const anyOn = WORKER_ORDER.some(id => stages[id]?.on);
  if(!anyOn) return Promise.resolve(img);
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const data = new Uint8ClampedArray(img.data);   // copia: el original sigue vivo
    pending.set(id, { resolve: out => resolve(new ImageData(out, img.width, img.height)), reject, onProgress });
    ensureWorker().postMessage({ id, data, width: img.width, height: img.height,
                                 stages, seed, order: WORKER_ORDER }, [data.buffer]);
  });
}

/* ── parámetros efectivos (con dosis) ────────────────────────── */
export function effectiveStages(state){
  const dose = state.dose / 100;
  const out = {};
  for(const s of CHAIN){
    const st = state.stages[s.id];
    const on = state.solo ? state.solo === s.id : st.on;
    out[s.id] = { on: on && dose > 0, p: effParams(state.stages, s.id, dose) };
  }
  // El solo de una etapa de localización no tiene sentido sin el relleno
  if(state.solo && ["detect", "vendor", "region", "selection"].includes(state.solo)){
    out.inpaint.on = state.stages.inpaint.on;
  }
  return out;
}

export const cpuStagesActive = eff =>
  !!(eff.spectral?.on || eff.jpeg?.on || (eff.regen?.on && serverConfigured()) ||
     (eff.inpaint?.on && eff.inpaint.p.method === "server" && serverConfigured()));

/* ── máscara de marcas visibles ──────────────────────────────── */
/**
 * @param {number} W,H  tamaño del lienzo destino
 * @param {object} ctx  { detection, chosenIds:Set, selection:Uint8Array|null, selW, selH }
 *   `detection` viene de detectMarks() sobre el ORIGINAL a tamaño
 *   completo; se reescala a W×H (el proxy o la capa) aquí.
 */
export function buildMask(eff, W, H, ctx){
  const m = new Uint8Array(W * H);
  let any = false;
  if(eff.detect.on && ctx.detection && ctx.chosenIds?.size){
    const dm = fullMaskFromDetection(ctx.detection, ctx.chosenIds, W, H);
    for(let i = 0; i < m.length; i++) if(dm[i]){ m[i] = 255; any = true; }
  }
  if(eff.vendor.on){
    const rects = vendorRects(eff.vendor.p.vendor, W, H, eff.vendor.p.pad / 100 * 0.04);
    if(rects.length){ rectMask(rects, W, H, m); any = true; }
  }
  if(eff.region.on){
    const p = eff.region.p;
    const r = { x: Math.round(p.x / 100 * W), y: Math.round(p.y / 100 * H),
                w: Math.max(1, Math.round(p.w / 100 * W)), h: Math.max(1, Math.round(p.h / 100 * H)) };
    rectMask([r], W, H, m); any = true;
  }
  if(eff.selection.on && ctx.selection){
    const sel = ctx.selection, sw = ctx.selW, sh = ctx.selH;
    if(sw === W && sh === H){
      for(let i = 0; i < m.length; i++) if(sel[i] > 127){ m[i] = 255; any = true; }
    } else {
      for(let y = 0; y < H; y++){
        const sy = Math.min(sh - 1, (y * sh / H) | 0);
        for(let x = 0; x < W; x++){
          const sx = Math.min(sw - 1, (x * sw / W) | 0);
          if(sel[sy * sw + sx] > 127){ m[y * W + x] = 255; any = true; }
        }
      }
    }
  }
  return any ? m : null;
}

/* Rectángulos que la vista previa dibuja sobre la miniatura. */
export function previewRects(eff, W, H, ctx){
  const out = [];
  if(eff.detect.on && ctx.detection){
    for(const r of ctx.detection.regions){
      const on = ctx.chosenIds?.has(r.id);
      out.push({ x: r.x / ctx.detection.fullW * W, y: r.y / ctx.detection.fullH * H,
                 w: r.w / ctx.detection.fullW * W, h: r.h / ctx.detection.fullH * H,
                 kind: on ? "detect" : "off", label: r.label });
    }
  }
  if(eff.vendor.on)
    for(const r of vendorRects(eff.vendor.p.vendor, W, H, eff.vendor.p.pad / 100 * 0.04))
      out.push({ ...r, kind: "vendor" });
  if(eff.region.on){
    const p = eff.region.p;
    out.push({ x: p.x / 100 * W, y: p.y / 100 * H, w: p.w / 100 * W, h: p.h / 100 * H, kind: "region" });
  }
  return out;
}

/* ── utilidades de lienzo ────────────────────────────────────── */
export function canvasOf(img){
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  c.getContext("2d").putImageData(img, 0, 0);
  return c;
}
export function imageDataOf(canvas){
  return canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
}

function jpegRoundTrip(canvas, quality, gens){
  return new Promise(resolve => {
    let n = 0;
    const step = () => {
      if(n >= gens) return resolve();
      canvas.toBlob(blob => {
        if(!blob) return resolve();
        createImageBitmap(blob).then(bmp => {
          const c = canvas.getContext("2d");
          c.globalCompositeOperation = "copy";
          c.drawImage(bmp, 0, 0);
          c.globalCompositeOperation = "source-over";
          bmp.close();
          n++; step();
        }).catch(() => resolve());
      }, "image/jpeg", quality);
    };
    step();
  });
}

/**
 * Ejecuta la cadena sobre `source` y devuelve un canvas nuevo.
 * @param {HTMLCanvasElement} source
 * @param {object} eff       effectiveStages(state)
 * @param {object} o  { seed, preview, ctx, onStatus, onProgress, regenCache, signal }
 */
export async function process(source, eff, o){
  const W = source.width, H = source.height;
  const onStatus = o.onStatus || (() => {});
  const t0 = performance.now();
  let img = imageDataOf(source);
  const s = Math.min(W, H);
  const info = { maskPx: 0, regen: false, ms: 0 };

  // 1 · máscara y relleno
  const mask = buildMask(eff, W, H, o.ctx || {});
  if(mask){
    for(let i = 0; i < mask.length; i++) if(mask[i]) info.maskPx++;
  }
  if(mask && eff.inpaint.on){
    const p = eff.inpaint.p;
    const expandPx = Math.max(1, Math.round(p.expand / 100 * 0.03 * s));
    const featherPx = Math.round(p.feather / 100 * 0.02 * s);
    if(p.method === "server" && !o.preview && serverConfigured()){
      const grownMaskCanvas = maskToCanvas(mask, W, H);
      const remote = await inpaintRemote(canvasOf(img), grownMaskCanvas, { backend: "auto" }, onStatus, o.signal);
      img = imageDataOf(remote);
    } else {
      onStatus("Rellenando la marca…");
      const r = inpaint(img, mask, {
        method: p.method === "server" ? "hybrid" : p.method,
        expand: expandPx, feather: featherPx,
        texture: p.texture / 100, grain: p.grain / 100, seed: o.seed
      });
      img = r.img;
    }
  }

  // 2 · perturbaciones locales, en el worker
  onStatus("Perturbando…");
  const wstages = Object.fromEntries(WORKER_ORDER.map(id => [id, eff[id]]));
  img = await disruptAsync(img, wstages, o.seed, o.onProgress);

  let canvas = canvasOf(img);

  // 3 · limpieza espectral
  if(eff.spectral.on && !o.preview){
    onStatus("Limpiando espectro…");
    const p = eff.spectral.p;
    canvas = removePeriodicPatterns(canvas, {
      amt: p.amt / 100,
      thresh: 1.5 + (p.thresh / 100) * 2.5,
      dcGuard: 0.02 + (p.guard / 100) * 0.13
    });
  }

  // 4 · JPEG
  if(eff.jpeg.on && !o.preview){
    onStatus("Comprimiendo…");
    const p = eff.jpeg.p;
    const rand = rng(o.seed * 53 + 9);
    const jitter = (p.jitter / 100) * 0.12;
    const q = Math.max(0.3, Math.min(0.98, 0.30 + (p.q / 100) * 0.69 + (rand() * 2 - 1) * jitter));
    const gens = Math.max(1, Math.round(1 + (p.gens / 100) * 9));
    await jpegRoundTrip(canvas, q, gens);
  }

  info.ms = performance.now() - t0;
  return { canvas, info };
}
