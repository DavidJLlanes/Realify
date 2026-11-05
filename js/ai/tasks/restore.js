/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · RESTAURAR (SCUNet / FBCNN)
   Reducción de ruido y de artefactos JPEG por teselas sobre la imagen entera.
   Entradas: modelo, imagen RGBA, tamaño y fuerza. Salida: imagen restaurada.
   ═══════════════════════════════════════════════════════════════ */

import { getSession, runSession } from "../engine/sessions.js";
import { inputType, makeTensor, readFloats } from "../engine/tensors.js";
import { starts, mirror } from "../engine/tiling.js";
import { post } from "../engine/post.js";

/* Teselas con solape, como el AiProcessor de ImageToolbox: si la
   imagen es menor que una tesela se amplía en espejo hasta un múltiplo
   de 8 (y al mínimo que pida el modelo), y en la costura con la
   tesela anterior se mezcla con un «smoothstep» para que no quede
   rejilla visible. */
export async function restore({ model, id, rgba, w, h, strength = 50 }){
  const { session, backend } = await getSession(id, model);
  const name = session.inputNames[0];
  const type = inputType(session, name);
  // En la GPU caben teselas mayores: menos costuras y ~30 % más rápido.
  const tile = backend === "webgpu" ? (model.tileGpu || model.tile) : model.tile, overlap = 32;
  const xs = starts(w, tile, overlap), ys = starts(h, tile, overlap);
  const total = xs.length * ys.length;
  const out = new Uint8ClampedArray(rgba.length);
  const extra = session.inputNames.filter(nm => nm !== name);
  let done = 0;
  post({ type:"stage", model:id, stage:"run" });

  for(let r = 0; r < ys.length; r++) for(let c = 0; c < xs.length; c++){
    const x0 = xs[c], y0 = ys[r];
    const tw = Math.min(tile, w), th = Math.min(tile, h);
    // Solape REAL con la tesela anterior: la última se pega al borde,
    // así que puede solapar más de `overlap`.
    const ovL = c ? xs[c - 1] + tw - x0 : 0, ovT = r ? ys[r - 1] + th - y0 : 0;
    const align = v => Math.max(model.minSide || 0, Math.ceil(v / 8) * 8);
    const pw = align(tw), ph = align(th), n = pw * ph;
    const input = new Float32Array(3 * n);
    for(let y = 0; y < ph; y++){
      const sy = y0 + mirror(y, th);
      for(let x = 0; x < pw; x++){
        const si = (sy * w + x0 + mirror(x, tw)) * 4, p = y * pw + x;
        input[p] = rgba[si] / 255; input[n + p] = rgba[si + 1] / 255; input[2 * n + p] = rgba[si + 2] / 255;
      }
    }
    const feeds = { [name]: makeTensor(type, input, [1, 3, ph, pw]) };
    for(const nm of extra) feeds[nm] = makeTensor(inputType(session, nm), new Float32Array([strength / 100]), [1, 1]);
    const res = await runSession(id, model, feeds);
    const vals = readFloats(res[session.outputNames[0]]);

    for(let y = 0; y < th; y++) for(let x = 0; x < tw; x++){
      const p = y * pw + x, di = ((y0 + y) * w + x0 + x) * 4;
      let a = 1;
      if(x < ovL){ const t = x / Math.max(1, ovL - 1); a = Math.min(a, t * t * (3 - 2 * t)); }
      if(y < ovT){ const t = y / Math.max(1, ovT - 1); a = Math.min(a, t * t * (3 - 2 * t)); }
      const rr = vals[p] * 255, gg = vals[n + p] * 255, bb = vals[2 * n + p] * 255;
      out[di]     = a === 1 ? rr : out[di]     * (1 - a) + rr * a;
      out[di + 1] = a === 1 ? gg : out[di + 1] * (1 - a) + gg * a;
      out[di + 2] = a === 1 ? bb : out[di + 2] * (1 - a) + bb * a;
      out[di + 3] = rgba[di + 3];
    }
    done++;
    post({ type:"tiles", model:id, done, total });
  }
  return { rgba: out };
}
