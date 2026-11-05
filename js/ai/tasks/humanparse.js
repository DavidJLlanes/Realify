/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · PARTES DEL CUERPO Y ROPA (SegFormer-B2 clothes)
   Entradas: modelo e imagen RGBA de 512×512 (la persona con relleno gris si no es cuadrada).
   Salida: { probs: Uint8Array(18×128×128) con la probabilidad de cada clase (0-255), C, S }.
   Clases: 0 fondo · 1 sombrero · 2 pelo · 3 gafas · 4 ropa de arriba · 5 falda · 6 pantalón · 7 vestido · 8 cinturón · 9 zapato izq.
   · 10 zapato der. · 11 cara · 12 pierna izq. · 13 pierna der. · 14 brazo izq. · 15 brazo der. · 16 bolso · 17 bufanda.
   ═══════════════════════════════════════════════════════════════ */
import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { readFloats } from "../engine/tensors.js";

export async function humanParse({ model, id, rgba }){
  const { session } = await getSession(id, model);
  const S = 512, n = S * S, x = new Float32Array(3 * n), mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for(let p = 0, i = 0; p < n; p++, i += 4){
    x[p] = (rgba[i] / 255 - mean[0]) / std[0]; x[n + p] = (rgba[i + 1] / 255 - mean[1]) / std[1]; x[2 * n + p] = (rgba[i + 2] / 255 - mean[2]) / std[2];
  }
  const out = await runSession(id, model, { [session.inputNames[0]]: new ort.Tensor("float32", x, [1, 3, S, S]) });
  const t = out[session.outputNames[0]], v = readFloats(t), C = t.dims[1], O = t.dims[2], m = O * O;
  const probs = new Uint8Array(C * m), e = new Float32Array(C);
  for(let p = 0; p < m; p++){                       // softmax por punto
    let mx = -Infinity;
    for(let c = 0; c < C; c++){ e[c] = v[c * m + p]; if(e[c] > mx) mx = e[c]; }
    let sum = 0;
    for(let c = 0; c < C; c++){ e[c] = Math.exp(e[c] - mx); sum += e[c]; }
    for(let c = 0; c < C; c++) probs[c * m + p] = Math.round(e[c] / sum * 255);
  }
  return { probs, C, S: O };
}
