/* ═══════════════════════════════════════════════════════════════
   LUZ POR PROFUNDIDAD Y SEPARAR PLANOS (Premium 👑 · fase 5)
   Menú Inteligencia Artificial › Profundidad.

     · Luz por profundidad: sube o baja la luz según la distancia —lo
       cercano más claro y lo lejano más oscuro, o al revés—, con un
       punto de giro (toca la imagen para ponerlo) y una transición
       suave. Aclarar y oscurecer por distancia es lo que da relieve a
       una foto plana. Capa nueva.
     · Separar planos: reparte la foto en 2, 3 o 4 planos (por cantidad
       de píxeles) y crea una capa por plano con su máscara, para
       retocarlos por separado. Las máscaras son acumulativas y las
       transiciones suman 1, así que con las capas sin tocar la foto
       sale idéntica a la original.

   Procesado Premium («el bueno y el mejor»): la luz se aplica en luz
   lineal con un hombro suave —las luces no se recortan de golpe y el
   tono se conserva— sobre una distancia guiada por los bordes de la
   foto y se trama a 8 bits; los planos usan transiciones suaves entre
   ellos, no un corte seco.
   ═══════════════════════════════════════════════════════════════ */

import { doc, addLayer } from "../core/doc.js";
import { recordLayers } from "../core/history.js";
import { emit } from "../core/bus.js";
import { toast } from "../ui/toast.js";
import { lightEv, gainWithShoulder, quantileBounds, planeWeights } from "../ai/depthmath.js";
import { makeMaskFromArray, setMaskTarget } from "../editor/masks.js";
import { visibleImage, getDepth, scaled, PREVIEW, prepare, openShell, toNewLayer, DEC, enc, hash } from "./depthtools.js";
import { depthField, fieldToArray } from "./depthzones.js";

/* ── Luz por profundidad ─────────────────────────────────────── */

function lightPixel(rgb, ev){
  gainWithShoulder(rgb, Math.pow(2, ev));
  return rgb;
}

let lightOpen = false;
export async function openDepthLight(){
  if(lightOpen) return;
  const src = await visibleImage(); if(!src) return;
  const map = await getDepth(src); if(!map) return;
  lightOpen = true;

  const small = scaled(src, PREVIEW), P = prepare(small, map);
  const S = { near: 0.5, far: -0.8, pivot: 50, width: 45 };
  const evAt = u => lightEv(u, S.pivot / 100, S.near, S.far, S.width / 100);
  const view = document.createElement("canvas"); view.width = P.w; view.height = P.h;
  const vx = view.getContext("2d");
  let busy = 0;
  const render = () => {
    const id = ++busy;
    requestAnimationFrame(() => {
      if(id !== busy || sh.closed) return;
      const n = P.n, o = new Uint8ClampedArray(n * 4), rgb = [0, 0, 0];
      for(let i = 0, j = 0; i < n; i++, j += 4){
        rgb[0] = P.R[i]; rgb[1] = P.G[i]; rgb[2] = P.B[i];
        lightPixel(rgb, evAt(1 - P.d[i]));
        const nz = (hash(i) - 0.5) * 0.9;
        o[j] = enc(rgb[0]) + nz; o[j + 1] = enc(rgb[1]) + nz; o[j + 2] = enc(rgb[2]) + nz; o[j + 3] = 255;
      }
      vx.putImageData(new ImageData(o, P.w, P.h), 0, 0);
      sh.setView(view);
    });
  };

  const close = () => { lightOpen = false; sh.close(); };
  const { sh, mountControls } = await openShell({
    title: "Luz por profundidad", subtitle: "Premium 👑 · toca la imagen para poner el punto de giro", applyLabel: "Aplicar",
    onCancel: close,
    onApply: async () => {
      sh.setBusy("Aplicando a resolución completa…");
      await new Promise(r => setTimeout(r, 30));
      try{
        const c = await lightFull(src, map, evAt);
        close(); await toNewLayer(c, "Luz por profundidad");
        toast("Luz por profundidad aplicada en una capa nueva", "ok");
      } catch(err){ sh.setBusy(""); toast("No se pudo aplicar: " + err.message, "err"); }
    }
  });
  sh.setOriginal(small);
  let down0 = null;
  sh.setInteract((type, p, e) => {
    if(type === "down"){ down0 = { x: e.clientX, y: e.clientY }; return true; }
    if(type === "up" && down0 && p){
      if(Math.hypot(e.clientX - down0.x, e.clientY - down0.y) < 10 && p.x >= 0 && p.y >= 0 && p.x < P.w && p.y < P.h){
        S.pivot = Math.round((1 - P.d[(p.y | 0) * P.w + (p.x | 0)]) * 100);
        ctl.refresh(); render();
      }
      down0 = null;
    }
    return false;
  });
  const fmt = v => (v > 0 ? "+" : "") + v.toFixed(2) + " EV";
  const ctl = mountControls(sh, {
    sections: [{ id: "l", label: "Luz", props: [
      { key: "near", label: "Lo cercano", type: "range", min: -3, max: 3, step: 0.05, def: 0.5, fmt },
      { key: "far", label: "Lo lejano", type: "range", min: -3, max: 3, step: 0.05, def: -0.8, fmt },
      { key: "pivot", label: "Punto de giro", type: "range", min: 0, max: 100, unit: " %", def: 50 },
      { key: "width", label: "Transición", type: "range", min: 5, max: 100, unit: " %", def: 45 }
    ] }],
    get: k => S[k], set: (k, v) => { S[k] = v; render(); }
  });
  render();
}

/** Luz a tamaño real: la distancia a la resolución de trabajo, interpolada
    por píxel, y la ganancia en luz lineal por franjas (la foto grande nunca
    está entera en coma flotante). */
async function lightFull(src, map, evAt){
  const field = depthField(src, map), { W, H, smp, d } = field;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const cx = c.getContext("2d", { willReadFrequently: true });
  cx.drawImage(src, 0, 0);
  const band = Math.max(1, Math.floor(4e6 / W)), rgb = [0, 0, 0];
  for(let y0 = 0; y0 < H; y0 += band){
    const bh = Math.min(band, H - y0), img = cx.getImageData(0, y0, W, bh), px = img.data;
    for(let yy = 0; yy < bh; yy++) for(let X = 0; X < W; X++){
      const Y = y0 + yy, ev = evAt(1 - smp(d, X, Y));
      if(Math.abs(ev) < 0.003) continue;
      const j = (yy * W + X) * 4;
      rgb[0] = DEC[px[j]]; rgb[1] = DEC[px[j + 1]]; rgb[2] = DEC[px[j + 2]];
      lightPixel(rgb, ev);
      const nz = (hash(Y * W + X) - 0.5) * 0.9;
      px[j] = enc(rgb[0]) + nz; px[j + 1] = enc(rgb[1]) + nz; px[j + 2] = enc(rgb[2]) + nz;
    }
    cx.putImageData(img, 0, y0);
    await new Promise(r => setTimeout(r, 0));
  }
  return c;
}

/* ── Separar planos ──────────────────────────────────────────── */

const PLANE_NAMES = {
  2: ["Primer plano", "Fondo"],
  3: ["Primer plano", "Plano medio", "Fondo"],
  4: ["Primer plano", "Plano cercano", "Plano lejano", "Fondo"]
};
const PLANE_TINT = [[235, 80, 70], [90, 200, 120], [90, 140, 255], [225, 200, 80]];
const softOf = v => v / 200;

let planesOpen = false;
export async function openDepthPlanes(){
  if(planesOpen) return;
  const src = await visibleImage(); if(!src) return;
  const map = await getDepth(src); if(!map) return;
  planesOpen = true;

  const small = scaled(src, PREVIEW), P = prepare(small, map);
  const S = { n: 3, soft: 8 };
  const view = document.createElement("canvas"); view.width = P.w; view.height = P.h;
  const vx = view.getContext("2d");
  let busy = 0;
  const render = () => {
    const id = ++busy;
    requestAnimationFrame(() => {
      if(id !== busy || sh.closed) return;
      const bounds = quantileBounds(P.d, S.n), soft = softOf(S.soft), w = new Float32Array(S.n);
      const n = P.n, o = new Uint8ClampedArray(n * 4), px = P.px;
      for(let i = 0, j = 0; i < n; i++, j += 4){
        planeWeights(1 - P.d[i], bounds, soft, w);
        let r = 0, g = 0, b = 0;
        for(let k = 0; k < S.n; k++){ const t = PLANE_TINT[k]; r += w[k] * t[0]; g += w[k] * t[1]; b += w[k] * t[2]; }
        o[j] = px[j] * 0.62 + r * 0.38; o[j + 1] = px[j + 1] * 0.62 + g * 0.38; o[j + 2] = px[j + 2] * 0.62 + b * 0.38; o[j + 3] = 255;
      }
      vx.putImageData(new ImageData(o, P.w, P.h), 0, 0);
      sh.setView(view);
    });
  };

  const close = () => { planesOpen = false; sh.close(); };
  const { sh, mountControls } = await openShell({
    title: "Separar planos", subtitle: "Premium 👑 · una capa por plano, con su máscara", applyLabel: "Crear capas",
    onCancel: close,
    onApply: async () => {
      sh.setBusy("Creando las capas a resolución completa…");
      await new Promise(r => setTimeout(r, 30));
      try{
        await createPlanes(src, map, S.n, softOf(S.soft), P.d);
        close();
        toast(`${S.n} planos separados en capas`, "ok");
      } catch(err){ sh.setBusy(""); toast("No se pudieron crear las capas: " + err.message, "err"); }
    }
  });
  sh.setOriginal(small);
  mountControls(sh, {
    sections: [{ id: "p", label: "Planos", props: [
      { key: "n", label: "Número de planos", type: "seg", options: [[2, "2"], [3, "3"], [4, "4"]] },
      { key: "soft", label: "Transición", type: "range", min: 0, max: 40, unit: " %", def: 8 }
    ], note: "Rojo = lo más cercano, azul y amarillo = lo más lejano. Cada capa lleva su máscara; con todas sin tocar, la foto queda igual." }],
    get: k => S[k], set: (k, v) => { S[k] = k === "n" ? +v : v; render(); }
  });
  render();
}

/** Una capa por plano, de atrás adelante. Las máscaras son acumulativas
    (cada capa se ve en su plano y en todos los más cercanos) y la de más
    atrás no lleva máscara: la foto recompuesta es idéntica a la original. */
async function createPlanes(src, map, n, soft, previewDepth){
  const bounds = quantileBounds(previewDepth, n), names = PLANE_NAMES[n];
  const field = depthField(src, map), W = field.W, H = field.H;
  const masks = [];
  for(let i = 0; i < n - 1; i++){
    // Cuánto de este punto está en el plano i o en alguno más cercano
    masks[i] = await fieldToArray(field, u => { const w = planeWeights(u, bounds, soft); let s = 0; for(let k = 0; k <= i; k++) s += w[k]; return s; });
  }
  recordLayers("Separar planos", () => {
    for(let i = n - 1; i >= 0; i--){
      const l = addLayer({ name: names[i] });
      l.ctx.drawImage(src, 0, 0, l.canvas.width, l.canvas.height);
      if(i < n - 1){ l.mask = makeMaskFromArray(masks[i], W, H); l.maskEnabled = true; }
      l.thumbDirty = true;
    }
  });
  setMaskTarget(null);
  emit("doc:structure"); emit("doc:change");
}
