/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · MobileSAM
   El codificador corre una vez por foto (samEncode) y su resultado se guarda aquí; cada toque sólo ejecuta el decodificador (samDecode).
   Entradas: foto, puntos y etiquetas. Salida: máscara. clearSamCache() la vacía al olvidar modelos.
   Límite: una sola foto codificada a la vez, identificada por `key`.
   ═══════════════════════════════════════════════════════════════ */

import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { post } from "../engine/post.js";
import { makeTensor, inputType, readFloats } from "../engine/tensors.js";

/* ── Segment Anything (MobileSAM + decodificador de SAM) ──────────
   El codificador analiza la foto UNA vez (lado mayor a 1024, normalizada
   como ImageNet, rellena abajo/derecha hasta 1024×1024) y su resultado
   se queda aquí; cada toque sólo ejecuta el decodificador, que tarda
   milisegundos. `key` identifica la foto codificada. */
let samCache = null;

export function clearSamCache(){ samCache = null; }   // la usa el despachador al olvidar modelos (la variable no se puede asignar desde otro módulo)

export async function samEncode({ model, id, rgba, w, h, key }){
  const { session } = await getSession(id, model);
  const S = 1024, n = S * S, x = new Float32Array(3 * n);
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for(let c = 0; c < 3; c++) x.fill(-mean[c] / std[c], c * n, (c + 1) * n);
  for(let y = 0; y < h; y++) for(let xx = 0; xx < w; xx++){
    const i = (y * w + xx) * 4, p = y * S + xx;
    x[p] = (rgba[i] / 255 - mean[0]) / std[0];
    x[n + p] = (rgba[i + 1] / 255 - mean[1]) / std[1];
    x[2 * n + p] = (rgba[i + 2] / 255 - mean[2]) / std[2];
  }
  const name = session.inputNames[0];
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, { [name]: makeTensor(inputType(session, name), x, [1, 3, S, S]) });
  const t = out[session.outputNames[0]];
  samCache = { key, data: readFloats(t), dims: t.dims.slice() };
  return { ok: true };
}

export async function samDecode({ model, id, key, coords, labels, w, h, maskInput }){
  if(!samCache || samCache.key !== key) throw new Error("la foto no está analizada (vuelve a abrir la herramienta)");
  const { session } = await getSession(id, model);
  const np = labels.length;
  const hasMask = !!maskInput;
  const feeds = {
    image_embeddings: new ort.Tensor("float32", samCache.data, samCache.dims),
    point_coords: new ort.Tensor("float32", Float32Array.from(coords), [1, np, 2]),
    point_labels: new ort.Tensor("float32", Float32Array.from(labels), [1, np]),
    mask_input: new ort.Tensor("float32", hasMask ? maskInput : new Float32Array(256 * 256), [1, 1, 256, 256]),
    has_mask_input: new ort.Tensor("float32", new Float32Array([hasMask ? 1 : 0]), [1]),
    orig_im_size: new ort.Tensor("float32", new Float32Array([h, w]), [2])
  };
  const out = await runSession(id, model, feeds);
  const masks = out.masks, iou = readFloats(out.iou_predictions), low = out.low_res_masks;
  const K = masks.dims[1], mh = masks.dims[2], mw = masks.dims[3], plane = mh * mw;
  const all = readFloats(masks), lowAll = readFloats(low);
  // La de más calidad según el propio modelo; con un solo punto, SAM da
  // varias candidatas (parte, objeto, todo) y ésta suele ser el objeto.
  let best = 0;
  for(let k = 1; k < K; k++) if(iou[k] > iou[best]) best = k;
  const logits = all.slice(best * plane, (best + 1) * plane);
  const lowRes = lowAll.slice(best * 65536, (best + 1) * 65536);
  return { logits, lowRes, mw, mh, score: iou[best] };
}
