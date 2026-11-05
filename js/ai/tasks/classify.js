/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · CLASIFICAR
   Clasifica la imagen con un modelo pequeño (por ejemplo, el de la lente).
   Entradas: modelo e imagen RGBA. Salida: probabilidades.
   ═══════════════════════════════════════════════════════════════ */

import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { readFloats } from "../engine/tensors.js";

/* ── Antiguos modelos de TensorFlow.js (ver models.js) ────────────── */
/* Photo Lens: las 10 clases de ImageNet más probables */
export async function classify({ model, id, rgba }){
  const { session } = await getSession(id, model);
  const n = 224 * 224, x = new Float32Array(3 * n);
  for(let p = 0, i = 0; p < n; p++, i += 4){ x[p * 3] = rgba[i] / 127.5 - 1; x[p * 3 + 1] = rgba[i + 1] / 127.5 - 1; x[p * 3 + 2] = rgba[i + 2] / 127.5 - 1; }
  const name = session.inputNames[0];
  const out = await runSession(id, model, { [name]: new ort.Tensor("float32", x, [1, 224, 224, 3]) });
  const probs = readFloats(out[session.outputNames[0]]);
  const idx = Array.from(probs.keys()).sort((a, b) => probs[b] - probs[a]).slice(0, 10);
  return { top: idx.map(i => [i, probs[i]]) };
}
