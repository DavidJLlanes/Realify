/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · CIELO (DeepLab ADE20K)
   Segmenta el cielo y otras clases de ADE20K.
   Entradas: modelo, imagen RGBA, tamaño y clases. Salida: probabilidad de cielo.
   ═══════════════════════════════════════════════════════════════ */

import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { readFloats } from "../engine/tensors.js";

/* Cielo: probabilidad (0-1) en la rejilla de los logits, recortada a
   la parte que ocupa la imagen (el grafo la rellena hasta 513) */
export async function segSky({ model, id, rgba, w, h, classes }){
  const { session } = await getSession(id, model);
  const x = new Uint8Array(w * h * 3);
  for(let p = 0, i = 0; p < w * h; p++, i += 4){ x[p * 3] = rgba[i]; x[p * 3 + 1] = rgba[i + 1]; x[p * 3 + 2] = rgba[i + 2]; }
  const name = session.inputNames[0];
  const out = await runSession(id, model, { [name]: new ort.Tensor("uint8", x, [1, h, w, 3]) });
  const t = out[session.outputNames[0]], [, C, GH, GW] = t.dims, v = readFloats(t), N = GH * GW;
  // Rejilla con esquinas alineadas: la celda r corresponde al píxel r·512/(GH−1)
  const st = 512 / (GH - 1), rh = Math.min(GH, Math.floor((h - 1) / st) + 1), rw = Math.min(GW, Math.floor((w - 1) / st) + 1);
  const prob = new Float32Array(rw * rh); let skyN = 0;
  const cls = classes?.length ? classes : [3];
  for(let r = 0; r < rh; r++) for(let c = 0; c < rw; c++){
    const q = r * GW + c; let mx = -Infinity, arg = 0;
    for(let k = 0; k < C; k++){ const val = v[k * N + q]; if(val > mx){ mx = val; arg = k; } }
    let s = 0; for(let k = 0; k < C; k++) s += Math.exp(v[k * N + q] - mx);
    // `classes`: canales de ADE20K a sumar (por defecto sólo el cielo, 3); la unión de varias clases
    // es la probabilidad de «cualquiera de ellas» (las clases son excluyentes: se suman)
    let pc = 0; for(const k of cls) pc += Math.exp(v[k * N + q] - mx);
    prob[r * rw + c] = pc / s;
    if(cls.includes(arg)) skyN++;
  }
  return { prob, w: rw, h: rh, hasSky: skyN > 0 };
}
