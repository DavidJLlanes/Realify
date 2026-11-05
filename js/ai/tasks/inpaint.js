/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · RELLENO (LaMa)
   Rellena un hueco sobre un recorte ya preparado a 512×512.
   Entradas: modelo, imagen RGBA y máscara del hueco. Salida: imagen rellenada.
   ═══════════════════════════════════════════════════════════════ */

import { getSession, runSession } from "../engine/sessions.js";
import { makeTensor, inputType, rgbaToPlanar, readFloats } from "../engine/tensors.js";
import { post } from "../engine/post.js";

export async function inpaint({ model, id, rgba, hole, size }){
  const { session } = await getSession(id, model);
  const n = size * size;
  const [imgName, maskName] = session.inputNames.includes("image")
    ? ["image", "mask"] : session.inputNames;
  const m = new Float32Array(n);
  for(let i = 0; i < n; i++) m[i] = hole[i] ? 1 : 0;
  const feeds = {
    [imgName]:  makeTensor(inputType(session, imgName), rgbaToPlanar(rgba, n), [1, 3, size, size]),
    [maskName]: makeTensor(inputType(session, maskName), m, [1, 1, size, size])
  };
  post({ type:"stage", model:id, stage:"run" });
  const out = await runSession(id, model, feeds);
  const vals = readFloats(out[session.outputNames[0]]);
  // LaMa_512 devuelve 0-255; las variantes «FAST», 0-1.
  let hi = 0;
  for(let i = 0; i < vals.length; i++) if(vals[i] > hi) hi = vals[i];
  const amp = hi <= 1.5 ? 255 : 1;
  const res = new Uint8ClampedArray(n * 4);
  for(let p = 0, i = 0; p < n; p++, i += 4){
    res[i] = vals[p] * amp; res[i + 1] = vals[n + p] * amp; res[i + 2] = vals[2 * n + p] * amp; res[i + 3] = 255;
  }
  return { rgba: res };
}
