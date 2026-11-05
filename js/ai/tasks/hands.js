/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · MANOS (MediaPipe: detector de palma y 21 puntos)
   · handDetect: imagen RGBA cuadrada de 192×192 (con relleno) → palmas { cx, cy, w, h, kp (7 puntos), score } en 0…1 del cuadrado.
   · handLandmarks: recorte RGBA de 224×224 de UNA mano (girada para que los dedos miren arriba) → { pts: 21×(x, y, z) en píxeles del
     recorte, presence 0-1, right 0-1 (probabilidad de mano derecha) }.
   ═══════════════════════════════════════════════════════════════ */
import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { readFloats } from "../engine/tensors.js";

const rgb01 = (rgba, n) => { const x = new Float32Array(n * 3); for(let p = 0, i = 0; p < n; p++, i += 4){ x[p * 3] = rgba[i] / 255; x[p * 3 + 1] = rgba[i + 1] / 255; x[p * 3 + 2] = rgba[i + 2] / 255; } return x; };

/* Anclas del detector de palma (192): paso 8 → 24×24 con 2 por celda; paso 16 (tres capas juntas) → 12×12 con 6 por celda = 2016. */
export function palmAnchors(){
  const a = [];
  for(const [cells, per] of [[24, 2], [12, 6]])
    for(let r = 0; r < cells; r++) for(let c = 0; c < cells; c++) for(let k = 0; k < per; k++) a.push([(c + 0.5) / cells, (r + 0.5) / cells]);
  return a;
}
const ANCHORS = palmAnchors();

const iou = (a, b) => {
  const x0 = Math.max(a.cx - a.w / 2, b.cx - b.w / 2), y0 = Math.max(a.cy - a.h / 2, b.cy - b.h / 2);
  const x1 = Math.min(a.cx + a.w / 2, b.cx + b.w / 2), y1 = Math.min(a.cy + a.h / 2, b.cy + b.h / 2);
  const i = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return i / (a.w * a.h + b.w * b.h - i || 1);
};

export async function handDetect({ model, id, rgba, threshold = 0.5 }){
  const { session } = await getSession(id, model), S = 192;
  const out = await runSession(id, model, { [session.inputNames[0]]: new ort.Tensor("float32", rgb01(rgba, S * S), [1, S, S, 3]) });
  const raw = readFloats(out[session.outputNames[0]]), sc = readFloats(out[session.outputNames[1]]);
  const list = [];
  for(let i = 0; i < ANCHORS.length; i++){
    const score = 1 / (1 + Math.exp(-Math.max(-100, Math.min(100, sc[i]))));
    if(score < threshold) continue;
    const [ax, ay] = ANCHORS[i], o = i * 18, kp = [];
    for(let k = 0; k < 7; k++) kp.push([raw[o + 4 + 2 * k] / S + ax, raw[o + 5 + 2 * k] / S + ay]);
    list.push({ cx: raw[o] / S + ax, cy: raw[o + 1] / S + ay, w: raw[o + 2] / S, h: raw[o + 3] / S, kp, score });
  }
  list.sort((a, b) => b.score - a.score);
  const keep = [];
  for(const d of list) if(!keep.some(k => iou(k, d) > 0.3)) keep.push(d);
  return { hands: keep };
}

export async function handLandmarks({ model, id, rgba }){
  const { session } = await getSession(id, model), S = 224;
  const out = await runSession(id, model, { [session.inputNames[0]]: new ort.Tensor("float32", rgb01(rgba, S * S), [1, S, S, 3]) });
  const pts = Float32Array.from(readFloats(out[session.outputNames[0]]));
  return { pts, presence: readFloats(out[session.outputNames[1]])[0], right: readFloats(out[session.outputNames[2]])[0] };
}
