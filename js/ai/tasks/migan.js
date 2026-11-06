/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · RELLENO (MI-GAN)
   Rellena un hueco con el pipeline ONNX completo de MI-GAN (28 MB): recorta, reescala, rellena y mezcla dentro del propio modelo.
   Entradas: modelo, imagen RGBA (size×size o w×h) y hueco (1 = rellenar). Salida: { rgba } del mismo tamaño, opaco.
   Límite: las entradas son uint8 (imagen 0-255 y máscara 255 = conservar, 0 = rellenar), sin normalizar.
   ═══════════════════════════════════════════════════════════════ */
import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { post } from "../engine/post.js";

export async function migan({ model, id, rgba, hole, size, w = size, h = size }){
  const { session } = await getSession(id, model);
  const n = w * h, img = new Uint8Array(3 * n), keep = new Uint8Array(n);
  for(let p = 0, i = 0; p < n; p++, i += 4){ img[p] = rgba[i]; img[n + p] = rgba[i + 1]; img[2 * n + p] = rgba[i + 2]; keep[p] = hole[p] ? 0 : 255; }
  const [a, b] = session.inputNames;
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, { [a]: new ort.Tensor("uint8", img, [1, 3, h, w]), [b]: new ort.Tensor("uint8", keep, [1, 1, h, w]) });
  const vals = out[session.outputNames[0]].data, res = new Uint8ClampedArray(n * 4);
  for(let p = 0, i = 0; p < n; p++, i += 4){ res[i] = vals[p]; res[i + 1] = vals[n + p]; res[i + 2] = vals[2 * n + p]; res[i + 3] = 255; }
  return { rgba: res };
}
