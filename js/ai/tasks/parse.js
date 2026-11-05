/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · PARTES DE LA CARA (BiSeNet)
   Segmenta pelo, ojos, labios, orejas, cuello, gafas y sombrero.
   Entradas: modelo, imagen RGBA y partes pedidas. Salida: máscaras por grupo.
   ═══════════════════════════════════════════════════════════════ */

import { getSession, runSession } from "../engine/sessions.js";
import { post } from "../engine/post.js";
import { makeTensor, inputType, readFloats } from "../engine/tensors.js";

/* ── Zonas de la cara (BiSeNet, face parsing) ────────────────────
   Recorte de la cara a 512×512, RGB normalizado como ImageNet; salida
   1×19×512×512 (fondo, piel, cejas, ojos, gafas, orejas, pendiente,
   nariz, boca, labios, cuello, collar, ropa, pelo, sombrero). Se
   devuelven las PROBABILIDADES (softmax) de cada zona que usa el
   retoque, 0-255, para que los bordes salgan suaves. */
const PARSE_GROUPS = { skin: [1, 7, 8, 10, 14], brows: [2, 3], eyes: [4, 5], mouth: [11], lips: [12, 13], hair: [17] };

export async function parse({ model, id, rgba, parts }){
  const { session } = await getSession(id, model);
  const S = 512, n = S * S;
  const name = session.inputNames[0];
  const x = new Float32Array(3 * n), mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for(let p = 0, i = 0; p < n; p++, i += 4){
    x[p] = (rgba[i] / 255 - mean[0]) / std[0]; x[n + p] = (rgba[i + 1] / 255 - mean[1]) / std[1]; x[2 * n + p] = (rgba[i + 2] / 255 - mean[2]) / std[2];
  }
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, { [name]: makeTensor(inputType(session, name), x, [1, 3, S, S]) });
  const t = out[session.outputNames[0]], v = readFloats(t), C = t.dims[1];
  // `parts`: { nombre: [canales…] } a petición (selección por texto: pelo, orejas, cuello…); si no, los grupos del retoque
  const G = parts || PARSE_GROUPS, groups = {};
  for(const k in G) groups[k] = new Uint8ClampedArray(n);
  const e = new Float32Array(C);
  for(let p = 0; p < n; p++){
    let mx = -Infinity;
    for(let c = 0; c < C; c++){ e[c] = v[c * n + p]; if(e[c] > mx) mx = e[c]; }
    let sum = 0;
    for(let c = 0; c < C; c++){ e[c] = Math.exp(e[c] - mx); sum += e[c]; }
    for(const k in G){ let s = 0; for(const c of G[k]) s += e[c]; groups[k][p] = Math.round(s / sum * 255); }
  }
  return { groups };
}
