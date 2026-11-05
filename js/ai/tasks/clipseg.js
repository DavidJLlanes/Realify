/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · CLIPSeg
   Segmentación por descripción libre: una o varias vistas de 352×352 de la misma foto con el mismo texto.
   Entradas: vistas, ids y máscara del texto. Salida: logits de cada vista.
   ═══════════════════════════════════════════════════════════════ */

import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { post } from "../engine/post.js";
import { readFloats } from "../engine/tensors.js";

/* ── CLIPSeg (descripción libre): una o varias vistas de 352×352 de la misma foto con el mismo texto; devuelve los «logits» de cada una ── */
export async function clipseg({ model, id, tiles, ids, mask }){
  const { session } = await getSession(id, model);
  const S = 352, n = S * S, mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  const toBig = a => BigInt64Array.from(Array.from(a, v => BigInt(v)));
  const outs = [];
  post({ type:"stage", model:id, stage:"run" });
  for(const rgba of tiles){
    const x = new Float32Array(3 * n);
    for(let p = 0, i = 0; p < n; p++, i += 4){
      x[p] = (rgba[i] / 255 - mean[0]) / std[0]; x[n + p] = (rgba[i + 1] / 255 - mean[1]) / std[1]; x[2 * n + p] = (rgba[i + 2] / 255 - mean[2]) / std[2];
    }
    const out = await runSession(id, model, {
      input_ids: new ort.Tensor("int64", toBig(ids), [1, ids.length]),
      pixel_values: new ort.Tensor("float32", x, [1, 3, S, S]),
      attention_mask: new ort.Tensor("int64", toBig(mask), [1, mask.length])
    });
    outs.push(Float32Array.from(readFloats(out[session.outputNames[0]]).subarray(0, n)));
  }
  return { outs };
}
