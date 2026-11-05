/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · MATTE
   Alfa de un modelo de segmentación (eliminar fondo, selección con un toque).
   Entradas: modelo, imagen RGBA y tamaño. Salida: máscara alfa.
   ═══════════════════════════════════════════════════════════════ */

import { getSession, runSession } from "../engine/sessions.js";
import { makeTensor, inputType, rgbaToPlanar, readFloats } from "../engine/tensors.js";
import { post } from "../engine/post.js";

/* ── Tareas ────────────────────────────────────────────────────── */
export async function matte({ model, id, rgba, size }){
  const { session } = await getSession(id, model);
  const n = size * size;
  const name = session.inputNames[0];
  const feeds = { [name]: makeTensor(inputType(session, name), rgbaToPlanar(rgba, n, model.norm), [1, 3, size, size]) };
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, feeds);
  const vals = readFloats(out[session.outputNames[0]]);
  // Algunos modelos devuelven probabilidad (0-1) y otros logits: si
  // hay valores fuera de rango claro, se pasan por una sigmoide.
  let lo = Infinity, hi = -Infinity;
  for(let i = 0; i < n; i++){ const v = vals[i]; if(v < lo) lo = v; if(v > hi) hi = v; }
  const logits = lo < -0.5 || hi > 1.5;
  // `minmax`: la salida se estira entre su mínimo y su máximo (ISNet).
  const span = model.minmax && !logits && hi - lo > 1e-6 ? hi - lo : 0;
  const mask = new Uint8ClampedArray(n);
  for(let i = 0; i < n; i++){
    const v = logits ? 1 / (1 + Math.exp(-vals[i])) : span ? (vals[i] - lo) / span : vals[i];
    mask[i] = Math.round(v * 255);
  }
  return { mask };
}
