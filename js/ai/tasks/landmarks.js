/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · PUNTOS DE LA CARA (MediaPipe Face Landmarker)
   478 puntos de una cara ya recortada.
   Entradas: modelo y recorte RGBA de 256×256 (la cara con margen). Salida: { pts: Float32Array(478×3) en píxeles del recorte, presence 0-1 }.
   ═══════════════════════════════════════════════════════════════ */
import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { readFloats } from "../engine/tensors.js";

export async function landmarks({ model, id, rgba }){
  const { session } = await getSession(id, model);
  const S = 256, x = new Float32Array(S * S * 3);
  for(let p = 0, i = 0; p < S * S; p++, i += 4){ x[p * 3] = rgba[i] / 255; x[p * 3 + 1] = rgba[i + 1] / 255; x[p * 3 + 2] = rgba[i + 2] / 255; }
  const out = await runSession(id, model, { [session.inputNames[0]]: new ort.Tensor("float32", x, [1, S, S, 3]) });
  const pts = Float32Array.from(readFloats(out[session.outputNames[0]]));
  const logit = readFloats(out[session.outputNames[1]])[0];
  return { pts, presence: 1 / (1 + Math.exp(-logit)) };
}
