/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · PROFUNDIDAD (Depth Anything V2)
   Estima la profundidad relativa de la escena.
   Entradas: modelo e imagen RGBA. Salida: mapa de profundidad.
   ═══════════════════════════════════════════════════════════════ */

import { getSession, runSession } from "../engine/sessions.js";
import { post } from "../engine/post.js";
import { makeTensor, inputType, readFloats } from "../engine/tensors.js";

/* ── Profundidad (Depth Anything V2 Small) ──────────────────────
   Entrada 1×3×518×518 RGB normalizado como ImageNet; salida 1×518×518
   de profundidad relativa INVERSA (mayor = más cerca). Se devuelve
   normalizada a 0-1 (1 = lo más cercano). */
export async function depth({ model, id, rgba }){
  const { session, backend } = await getSession(id, model);
  const S = 518, n = S * S, x = new Float32Array(3 * n), mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for(let p = 0, i = 0; p < n; p++, i += 4){
    x[p] = (rgba[i] / 255 - mean[0]) / std[0]; x[n + p] = (rgba[i + 1] / 255 - mean[1]) / std[1]; x[2 * n + p] = (rgba[i + 2] / 255 - mean[2]) / std[2];
  }
  const name = session.inputNames[0];
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, { [name]: makeTensor(inputType(session, name), x, [1, 3, S, S]) });
  const v = readFloats(out[session.outputNames[0]]);
  let lo = Infinity, hi = -Infinity;
  for(let i = 0; i < n; i++){ if(v[i] < lo) lo = v[i]; if(v[i] > hi) hi = v[i]; }
  const d = new Float32Array(n), span = Math.max(1e-6, hi - lo);
  for(let i = 0; i < n; i++) d[i] = (v[i] - lo) / span;
  return { depth: d, size: S, backend };
}
