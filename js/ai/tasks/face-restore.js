/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · RESTAURAR CARAS (GFPGAN)
   Restaura caras recortadas con el codificador y el decodificador en dos mitades para ahorrar memoria.
   Entradas: recortes de caras y modelos. Salida: caras restauradas.
   ═══════════════════════════════════════════════════════════════ */

import { post } from "../engine/post.js";
import { getSession, runSession, release } from "../engine/sessions.js";
import { makeTensor, inputType, readFloats } from "../engine/tensors.js";

export async function faceRestore({ model, id, crops, dec, decId, lowMem }){
  const S = 512, n = S * S, outs = [];
  post({ type:"stage", model:id, stage:"run" });
  for(const rgba of crops){
    const x = new Float32Array(3 * n);
    for(let p = 0, i = 0; p < n; p++, i += 4){ x[p] = rgba[i] / 127.5 - 1; x[n + p] = rgba[i + 1] / 127.5 - 1; x[2 * n + p] = rgba[i + 2] / 127.5 - 1; }
    const enc = (await getSession(id, model)).session;
    const mid = await runSession(id, model, { [enc.inputNames[0]]: makeTensor(inputType(enc, enc.inputNames[0]), x, [1, 3, S, S]) });
    if(lowMem) await release(id);
    const d = (await getSession(decId, dec)).session;
    const feeds = {};
    for(const name of d.inputNames) feeds[name] = mid[name];
    const out = await runSession(decId, dec, feeds);
    for(const k in mid){ try{ mid[k].dispose?.(); }catch{} }
    if(lowMem) await release(decId);
    const v = readFloats(out[d.outputNames[0]]), o = new Uint8ClampedArray(4 * n);
    for(let p = 0, i = 0; p < n; p++, i += 4){
      o[i] = (Math.max(-1, Math.min(1, v[p])) + 1) * 127.5;
      o[i + 1] = (Math.max(-1, Math.min(1, v[n + p])) + 1) * 127.5;
      o[i + 2] = (Math.max(-1, Math.min(1, v[2 * n + p])) + 1) * 127.5;
      o[i + 3] = 255;
    }
    outs.push(o);
  }
  if(lowMem){ await release(id); await release(decId); }
  return { outs };
}
