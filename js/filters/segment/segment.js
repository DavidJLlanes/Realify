/* ═══════════════════════════════════════════════════════════════
   SEGMENTACIÓN · ORQUESTADOR
   Máscaras de persona (BodyPix) y de cielo (DeepLab v3, ADE20K) del
   tamaño ORIGINAL de la imagen (0-255, listas para el canal alfa de
   una máscara de capa).

   Antes funcionaban con TensorFlow.js en un worker propio; ahora son
   los mismos modelos convertidos a ONNX y corren en el worker de IA
   común (js/ai/worker.js: WebGPU si hay, si no WebAssembly), sin
   TF.js. Además los modelos dan una PROBABILIDAD, no un sí/no: el
   borde de la máscara sale suave en vez de dentado.
   ═══════════════════════════════════════════════════════════════ */

import { runModel } from "../../ai/runtime.js";

/* Miniatura de trabajo: la foto entera, reducida respetando su
   proporción. DeepLab trabaja como mucho a 513 px por lado. */
function workThumb(src, maxSide, snap16 = false){
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  let w = Math.max(1, Math.round(src.width * scale)), h = Math.max(1, Math.round(src.height * scale));
  // BodyPix pide lados de 16k + 1
  if(snap16){ w = Math.max(17, Math.round((w - 1) / 16) * 16 + 1); h = Math.max(17, Math.round((h - 1) / 16) * 16 + 1); }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, w, h);
  return { rgba: x.getImageData(0, 0, w, h).data, w, h };
}

/* Probabilidad pequeña (0-1) → alfa 0-255 al tamaño de `src`. Se
   endurece un poco (el borde queda nítido pero sin escalones) y se
   amplía con suavizado; un desenfoque ligero evita los dientes al
   estirar una rejilla de 129 celdas a una foto de 4000 px. */
function upscaleMask(prob, w, h, outW, outH){
  const small = document.createElement("canvas");
  small.width = w; small.height = h;
  const sx = small.getContext("2d");
  const img = sx.createImageData(w, h);
  for(let i = 0; i < prob.length; i++){
    const a = Math.min(1, Math.max(0, (prob[i] - 0.5) * 3 + 0.5));
    img.data[i*4] = img.data[i*4+1] = img.data[i*4+2] = 255;
    img.data[i*4+3] = Math.round(a * 255);
  }
  sx.putImageData(img, 0, 0);
  const out = document.createElement("canvas");
  out.width = outW; out.height = outH;
  const ox = out.getContext("2d", { willReadFrequently: true });
  ox.imageSmoothingQuality = "high";
  ox.filter = "blur(1.5px)";
  ox.drawImage(small, 0, 0, outW, outH);
  const outImg = ox.getImageData(0, 0, outW, outH);
  const mask = new Uint8ClampedArray(outW * outH);
  for(let i = 0; i < mask.length; i++) mask[i] = outImg.data[i*4+3];
  return mask;
}

/* ── Por bloques (fase 3 de PENDIENTE.md) ───────────────────────
   La pasada GLOBAL (la foto entera a 513 px) decide dónde hay persona o
   cielo: es la que ve la escena completa. En fotos grandes, además, la
   foto a unas 1,75 veces esa resolución se parte en bloques de 513 que
   se solapan, y cada bloque da su probabilidad con 4 veces más detalle
   en los bordes (ramas contra el cielo, pelo, dedos). Los bloques sólo
   cuentan en la franja dudosa del borde de la máscara global: un bloque
   sin contexto no puede inventarse cielo en una pared azul. */

/* Rejilla del modelo (celda c ↔ píxel c·stride, esquinas alineadas) →
   mapa de W×H píxeles */
function gridToMap(prob, gw, gh, stride, W, H){
  const out = new Float32Array(W * H);
  for(let y = 0; y < H; y++){
    const fy = Math.min(gh - 1, y / stride), y0 = fy | 0, y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < W; x++){
      const fx = Math.min(gw - 1, x / stride), x0 = fx | 0, x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0;
      const a = prob[y0 * gw + x0] + (prob[y0 * gw + x1] - prob[y0 * gw + x0]) * tx;
      const b = prob[y1 * gw + x0] + (prob[y1 * gw + x1] - prob[y1 * gw + x0]) * tx;
      out[y * W + x] = a + (b - a) * ty;
    }
  }
  return out;
}

const SIDE = 513, OV = 128;
const snap16 = v => Math.max(17, Math.round((v - 1) / 16) * 16 + 1);

/* kind: { task, id, title, stride, snap } */
async function segmentTiled(src, kind){
  const { aiSession } = await import("../../ai/runtime.js");
  const T = await import("../../ai/tiles.js");
  return aiSession(kind.title, async step => {
    step(0, 1);
    const g = workThumb(src, SIDE, kind.snap);
    const rg = await runModel(kind.task, kind.id, { rgba: g.rgba, w: g.w, h: g.h, ...kind.extra }, [g.rgba.buffer]);
    const long = Math.max(src.width, src.height);
    const side = T.workSide(SIDE, OV, 2, long);
    if(side <= SIDE * 1.3) return { prob: rg.prob, w: rg.w, h: rg.h, stride: kind.stride, thumbW: g.w, thumbH: g.h, hasSky: rg.hasSky };

    // Foto a la resolución de trabajo (lados 16k+1 para BodyPix)
    const k = side / long;
    let W = Math.round(src.width * k), H = Math.round(src.height * k);
    if(kind.snap){ W = snap16(W); H = snap16(H); }
    const work = document.createElement("canvas"); work.width = W; work.height = H;
    const wx = work.getContext("2d", { willReadFrequently: true });
    wx.imageSmoothingQuality = "high"; wx.drawImage(src, 0, 0, W, H);

    const G = T.resizeBilinear(gridToMap(rg.prob, rg.w, rg.h, kind.stride, g.w, g.h), g.w, g.h, W, H);
    const plan = T.tilePlan(W, H, SIDE, OV), total = 1 + plan.length, mix = T.blender(W, H);
    for(let i = 0; i < plan.length; i++){
      step(1 + i, total);
      const t = plan[i], rgba = wx.getImageData(t.x, t.y, t.w, t.h).data;
      const r = await runModel(kind.task, kind.id, { rgba, w: t.w, h: t.h, ...kind.extra }, [rgba.buffer]);
      mix.add(t, gridToMap(r.prob, r.w, r.h, kind.stride, t.w, t.h), T.tileWeights(t, W, H, OV));
    }
    step(total, total);
    const tiles = mix.result();
    // Franja dudosa de la máscara global, ensanchada y con borde suave
    const band = new Float32Array(W * H);
    for(let i = 0; i < band.length; i++) band[i] = G[i] > 0.06 && G[i] < 0.94 ? 1 : 0;
    const gate = T.smooth(band, W, H, Math.max(4, Math.round(W / 64)));
    let any = false;
    for(let i = 0; i < G.length; i++){
      const a = Math.min(1, gate[i] * 3);
      G[i] = G[i] + (tiles[i] - G[i]) * a;
      if(G[i] > 0.5) any = true;
    }
    return { prob: G, w: W, h: H, stride: 1, thumbW: W, thumbH: H, hasSky: rg.hasSky || any };
  });
}

/* Probabilidad (en rejilla o ya densa) → alfa del tamaño de `src` */
function toMask(r, src){
  const dense = r.stride === 1 ? r.prob : gridToMap(r.prob, r.w, r.h, r.stride, r.thumbW, r.thumbH);
  return upscaleMask(dense, r.thumbW, r.thumbH, src.width, src.height);
}

/** Máscara de persona (0-255) del tamaño de `src`. Vacía —todo ceros—
    si BodyPix no encuentra a nadie. */
export async function segmentPerson(src){
  const t0 = performance.now();
  const r = await segmentTiled(src, { task: "segPerson", id: "person", title: "Buscando a la persona con IA", stride: 16, snap: true });
  return { mask: toMask(r, src), ms: Math.round(performance.now() - t0) };
}

/** Máscara de cielo (0-255) del tamaño de `src`. `hasSky` distingue
    «no hay cielo en la foto» de «hubo un fallo». */
export async function segmentSky(src){
  const t0 = performance.now();
  const r = await segmentTiled(src, { task: "segSky", id: "sky", title: "Detectando el cielo con IA", stride: 4, snap: false });
  return { mask: toMask(r, src), hasSky: r.hasSky, ms: Math.round(performance.now() - t0) };
}

/** Máscara (0-255, del tamaño de `src`) de la unión de varias clases de ADE20K (canales 1-150 del modelo).
    Mismo método por bloques que el cielo. `found` dice si el modelo vio alguna de ellas. */
export async function segmentClasses(src, classes, title = "Buscando en la foto con IA"){
  const t0 = performance.now();
  const r = await segmentTiled(src, { task: "segSky", id: "sky", title, stride: 4, snap: false, extra: { classes } });
  return { mask: toMask(r, src), found: r.hasSky, ms: Math.round(performance.now() - t0) };
}
