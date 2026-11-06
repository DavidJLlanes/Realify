/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · CLIP (imagen o texto → vector de 512 números)
   Con el modelo de imagen (clip_vision) recibe una foto RGBA de 224×224 (ya recortada al centro) y la normaliza como CLIP; con el de
   texto (clip_text) recibe los identificadores del tokenizador. Devuelve el vector normalizado (norma 1): la semejanza es el producto escalar.
   Entradas: modelo y rgba, o modelo e ids. Salida: { v: Float32Array(512) }.
   ═══════════════════════════════════════════════════════════════ */
import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { post } from "../engine/post.js";
import { readFloats } from "../engine/tensors.js";

const MEAN = [0.48145466, 0.4578275, 0.40821073], STD = [0.26862954, 0.26130258, 0.27577711];
const unit = v => { let s = 0; for(const x of v) s += x * x; s = Math.sqrt(s) || 1; const o = new Float32Array(v.length); for(let i = 0; i < v.length; i++) o[i] = v[i] / s; return o; };

export async function clip({ model, id, rgba, ids }){
  const { session } = await getSession(id, model), name = session.inputNames[0];
  let feed;
  if(ids){
    feed = { [name]: new ort.Tensor("int64", BigInt64Array.from(Array.from(ids, BigInt)), [1, ids.length]) };
  } else {
    const S = 224, n = S * S, x = new Float32Array(3 * n);
    for(let p = 0, i = 0; p < n; p++, i += 4) for(let c = 0; c < 3; c++) x[c * n + p] = (rgba[i + c] / 255 - MEAN[c]) / STD[c];
    feed = { [name]: new ort.Tensor("float32", x, [1, 3, S, S]) };
  }
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, feed);
  return { v: unit(readFloats(out[session.outputNames.find(n => /embeds?$/.test(n)) || session.outputNames[0]])) };
}
