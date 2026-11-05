/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · PERSONAS (BodyPix)
   Segmenta personas.
   Entradas: modelo, imagen RGBA y tamaño. Salida: máscara de persona.
   ═══════════════════════════════════════════════════════════════ */

import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { readFloats } from "../engine/tensors.js";

/* Persona (BodyPix): probabilidad en la rejilla de salida (stride 16) */
export async function segPerson({ model, id, rgba, w, h }){
  const { session } = await getSession(id, model);
  const x = new Float32Array(w * h * 3);
  for(let p = 0, i = 0; p < w * h; p++, i += 4){ x[p * 3] = rgba[i] / 127.5 - 1; x[p * 3 + 1] = rgba[i + 1] / 127.5 - 1; x[p * 3 + 2] = rgba[i + 2] / 127.5 - 1; }
  const name = session.inputNames[0];
  const out = await runSession(id, model, { [name]: new ort.Tensor("float32", x, [1, h, w, 3]) });
  const key = session.outputNames.find(o => /float_segments/.test(o));
  const t = out[key], [, GH, GW] = t.dims, v = readFloats(t);
  const prob = new Float32Array(GH * GW);
  for(let i = 0; i < prob.length; i++) prob[i] = 1 / (1 + Math.exp(-v[i]));
  return { prob, w: GW, h: GH };
}
