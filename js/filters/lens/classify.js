/* ═══════════════════════════════════════════════════════════════
   ADAPTIVE PHOTO LENS · CLASIFICACIÓN
   La mitad del trabajo la hace MobileNet en el worker; la otra mitad,
   unas pocas medidas sobre una miniatura de 64 píxeles hechas aquí.
   MobileNet sabe qué OBJETO hay en la foto; no sabe si la foto es un
   retrato, un contraluz, un blanco y negro o una escena nocturna,
   porque ImageNet no tiene esas clases. Esas se leen directamente de
   los píxeles —cuánta piel, cuánta saturación, cuánto negro y cuánto
   blanco— y se suman a los votos del modelo antes de decidir.
   ═══════════════════════════════════════════════════════════════ */

import { IMAGENET_MAP, CATEGORY_BY_ID } from "./categories.js";

import { runModel } from "../../ai/runtime.js";

const SS_KEY = "realify.lens.model";
const LABELS_URL = new URL("../../../assets/models/mobilenet/labels.json", import.meta.url).href;

/* Umbral por debajo del cual no se da la categoría por buena y se
   ofrecen las tres más probables. */
export const CONFIDENCE_MIN = 0.6;

let readyInfo = null;
let labels = null;

/* Lo que quedó de la sesión anterior: si el modelo ya se cargó una
   vez en esta pestaña, la interfaz puede decirlo sin esperar. */
export function cachedModelInfo(){
  try{ return JSON.parse(sessionStorage.getItem(SS_KEY) || "null"); }catch{ return null; }
}

/* Antes arrancaba un worker propio con TensorFlow.js; ahora MobileNet
   es un modelo ONNX del worker de IA común (js/ai/worker.js), que lo
   carga la primera vez que se clasifica. Esto sólo deja constancia. */
export async function ensureModel(){
  if(readyInfo) return readyInfo;
  readyInfo = { backend: "onnx", cached: true, ms: 0, version: "onnx" };
  return readyInfo;
}

export const modelInfo = () => readyInfo;

async function loadLabels(){
  if(labels) return labels;
  try{
    const r = await fetch(LABELS_URL);
    labels = await r.json();
  }catch{ labels = []; }
  return labels;
}

/* ── miniaturas ──────────────────────────────────────────────── */

/* 224×224 para el modelo. Se recorta al cuadrado central en vez de
   deformar: MobileNet se entrenó con recortes, y un panorama aplastado
   a cuadrado le desconcierta más que perder los bordes. */
function squareThumb(src, size){
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const x = c.getContext("2d", { willReadFrequently: true });
  const s = Math.min(src.width, src.height);
  const sx = (src.width - s) / 2, sy = (src.height - s) / 2;
  x.imageSmoothingQuality = "high";
  x.drawImage(src, sx, sy, s, s, 0, 0, size, size);
  return x.getImageData(0, 0, size, size);
}

/* Medidas rápidas sobre 64×64 de la imagen ENTERA (no del recorte):
   la piel se busca en el centro, y el resto —brillo, negros,
   blancos, saturación— en toda la foto. */
function measure(src){
  const N = 64;
  const c = document.createElement("canvas");
  c.width = N; c.height = N;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(src, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data;

  let sumL = 0, sumL2 = 0, dark = 0, bright = 0, sumS = 0, maxS = 0;
  let skin = 0, centerN = 0, warmBright = 0, brightN = 0, blueish = 0;
  for(let i = 0, p = 0; i < d.length; i += 4, p++){
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const s = mx > 0.02 ? (mx - mn) / mx : 0;
    sumL += l; sumL2 += l * l; sumS += s; if(s > maxS) maxS = s;
    if(l < 0.12) dark++;
    if(l > 0.90) bright++;
    if(l > 0.75){ brightN++; if(r > b + 0.08) warmBright++; }
    if(b > r + 0.06 && b > g + 0.02) blueish++;

    const px = p % N, py = (p / N) | 0;
    if(px >= N / 4 && px < 3 * N / 4 && py >= N / 4 && py < 3 * N / 4){
      centerN++;
      // Piel en YCbCr, el criterio clásico: Cb 77-127, Cr 133-173.
      const R = d[i], G = d[i + 1], B = d[i + 2];
      const cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B;
      const cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B;
      if(cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && l > 0.2 && l < 0.95) skin++;
    }
  }
  const n = N * N;
  const mean = sumL / n;
  return {
    mean, std: Math.sqrt(Math.max(0, sumL2 / n - mean * mean)),
    dark: dark / n, bright: bright / n,
    sat: sumS / n, maxSat: maxS,
    skin: centerN ? skin / centerN : 0,
    warmBright: brightN ? warmBright / brightN : 0,
    blueish: blueish / n
  };
}

/* ── fusión ──────────────────────────────────────────────────── */

/* Votos de los píxeles para lo que el modelo no sabe ver. Cada regla
   añade candidatos con un peso; se suman a los del modelo.

   `topMass` es cuánta probabilidad concentra el modelo en su mejor
   categoría. Los votos de píxeles se atenúan con ella: están para
   rellenar lo que el modelo no sabe —un retrato, un contraluz—, no
   para discutirle lo que sí sabe. Sin esta atenuación, el pelaje
   naranja de un gato pasaba por piel y le robaba la mitad de la
   confianza a un «gato» que el modelo tenía al 88 %. El blanco y
   negro es la excepción: no compite con el sujeto, lo describe. */
function heuristics(m, modelTop, topMass){
  const votes = [];
  const damp = 1 - 0.75 * Math.min(1, topMass || 0);
  const add = (cat, w, full) => votes.push([cat, full ? w : w * damp]);
  const topGroup = modelTop ? CATEGORY_BY_ID[modelTop.cat].group : null;

  // Blanco y negro: sin color en ninguna parte.
  if(m.sat < 0.045 && m.maxSat < 0.20){
    add(topGroup === "portrait" || m.skin > 0.15 ? "portrait-bw" : "special-bw", 0.9, true);
  }
  // Piel en el centro: es un retrato, diga lo que diga la ropa. Salvo
  // que el modelo esté viendo un animal con claridad: eso es pelaje.
  if(m.skin > 0.22 && !(topGroup === "animals" && topMass > 0.5)){
    const w = Math.min(0.85, 0.45 + m.skin);
    if(modelTop && modelTop.wear) add("portrait-classic", w);
    else add(m.mean > 0.55 ? "portrait-outdoor" : "portrait-classic", w * 0.8);
  }
  // Noche: casi todo negro con algún punto de luz.
  if(m.mean < 0.18 && m.bright > 0.003){
    add(topGroup === "arch" ? "arch-night" : "special-night", 0.5);
    if(m.sat > 0.25) add("misc-fireworks", 0.3);
    add("nature-night", 0.25);
  } else if(m.mean < 0.20 && m.dark > 0.6){
    add("special-lowkey", 0.45);
  }
  // Alta clave: casi todo claro y plano.
  if(m.mean > 0.78 && m.std < 0.18) add("special-highkey", 0.45);
  // Silueta y contraluz: negro y blanco a la vez, con el blanco cálido.
  if(m.dark > 0.30 && m.bright > 0.18){
    if(m.warmBright > 0.5){ add("special-silhouette", 0.45); add("nature-sunset", 0.3); }
    else add("special-backlight", 0.4);
  }
  // Nieve: claro, casi sin color y con el blanco tirando a azul.
  if(m.mean > 0.68 && m.sat < 0.14 && m.blueish > 0.25) add("nature-snow", 0.35);
  return votes;
}

/* Clasifica un lienzo. Devuelve siempre algo: si el modelo falla,
   `ok` es false y la interfaz pide elegir a mano. */
export async function classify(src){
  const t0 = performance.now();
  const measures = measure(src);
  let modelTop = null, model = null, error = null;

  try{
    await ensureModel();
    const image = squareThumb(src, 224);
    const res = await runModel("classify", "lens", { rgba: image.data }, [image.data.buffer], { quiet: true });
    readyInfo = { ...readyInfo, backend: res.backend || readyInfo.backend, ms: res.ms };
    try{ sessionStorage.setItem(SS_KEY, JSON.stringify({ ...readyInfo, when: Date.now() })); }catch{}
    const lab = await loadLabels();
    model = {
      top: res.top.map(([i, p]) => ({ index: i, p, label: (lab[i] || `clase ${i}`).split(",")[0],
                                      cat: IMAGENET_MAP[i].cat, wear: IMAGENET_MAP[i].wear })),
      ms: res.ms, backend: res.backend
    };
    modelTop = model.top[0];
  }catch(err){
    error = String(err && err.message || err);
  }

  // Votos por categoría: modelo (probabilidad de cada clase, sumada
  // por categoría destino) más medidas de píxeles.
  const score = new Map();
  const vote = (cat, w) => score.set(cat, (score.get(cat) || 0) + w);
  if(model) for(const t of model.top) vote(t.cat, t.p);
  const topMass = modelTop ? (score.get(modelTop.cat) || 0) : 0;
  for(const [cat, w] of heuristics(measures, modelTop, topMass)) vote(cat, w);

  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, w]) => s + w, 0) || 1;
  const suggestions = ranked.slice(0, 3).map(([id, w]) => ({ id, p: w / total }));
  const best = suggestions[0] || null;

  return {
    ok: !!best && !error,
    category: best ? best.id : null,
    confidence: best ? best.p : 0,
    sure: !!best && best.p >= CONFIDENCE_MIN,
    suggestions,
    model, measures, error,
    ms: Math.round(performance.now() - t0)
  };
}
