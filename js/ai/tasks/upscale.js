/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · AMPLIAR
   Amplía la imagen con un modelo de superresolución, por teselas.
   Entradas: modelo, imagen RGBA y tamaño. Salida: imagen ampliada.
   ═══════════════════════════════════════════════════════════════ */

import { getSession, runSession } from "../engine/sessions.js";
import { inputType, makeTensor, readFloats } from "../engine/tensors.js";
import { starts } from "../engine/tiling.js";
import { post } from "../engine/post.js";

/* ── Ampliar ─────────────────────────────────────────────────
   Teselas con solape como `restore`, pero la salida es `scale` veces
   mayor (se mide en la primera tesela, por si el modelo no es el que
   dice el catálogo). El alfa se amplía aparte, sin IA. */
export async function upscale({ model, id, rgba, w, h }){
  const { session } = await getSession(id, model);
  const name = session.inputNames[0], type = inputType(session, name);
  const tile = Math.min(model.tile || 192, Math.max(w, h)), overlap = 12;
  const xs = starts(w, Math.min(tile, w), overlap), ys = starts(h, Math.min(tile, h), overlap);
  const total = xs.length * ys.length;
  let S = model.scale || 4, W = 0, H = 0, out = null, done = 0;
  post({ type:"stage", model:id, stage:"run" });
  for(let r = 0; r < ys.length; r++) for(let c = 0; c < xs.length; c++){
    const x0 = xs[c], y0 = ys[r], tw = Math.min(tile, w), th = Math.min(tile, h), n = tw * th;
    const input = new Float32Array(3 * n);
    for(let y = 0; y < th; y++) for(let x = 0; x < tw; x++){
      const si = ((y0 + y) * w + x0 + x) * 4, p = y * tw + x;
      input[p] = rgba[si] / 255; input[n + p] = rgba[si + 1] / 255; input[2 * n + p] = rgba[si + 2] / 255;
    }
    const res = await runSession(id, model, { [name]: makeTensor(type, input, [1, 3, th, tw]) });
    const t = res[session.outputNames[0]], vals = readFloats(t);
    const oh = t.dims[2], ow = t.dims[3];
    if(!out){ S = Math.round(ow / tw) || S; W = w * S; H = h * S; out = new Uint8ClampedArray(W * H * 4); }
    const on = ow * oh, ovL = c ? (xs[c - 1] + tw - x0) * S : 0, ovT = r ? (ys[r - 1] + th - y0) * S : 0;
    for(let y = 0; y < oh; y++) for(let x = 0; x < ow; x++){
      const p = y * ow + x, di = ((y0 * S + y) * W + x0 * S + x) * 4;
      let a = 1;
      if(x < ovL){ const k = x / Math.max(1, ovL - 1); a = Math.min(a, k * k * (3 - 2 * k)); }
      if(y < ovT){ const k = y / Math.max(1, ovT - 1); a = Math.min(a, k * k * (3 - 2 * k)); }
      const rr = vals[p] * 255, gg = vals[on + p] * 255, bb = vals[2 * on + p] * 255;
      out[di]     = a === 1 ? rr : out[di]     * (1 - a) + rr * a;
      out[di + 1] = a === 1 ? gg : out[di + 1] * (1 - a) + gg * a;
      out[di + 2] = a === 1 ? bb : out[di + 2] * (1 - a) + bb * a;
      out[di + 3] = 255;
    }
    done++; post({ type:"tiles", model:id, done, total });
  }
  // Alfa (vecino más próximo): sólo si la imagen tenía transparencia
  let hasAlpha = false; for(let i = 3; i < rgba.length; i += 4) if(rgba[i] < 255){ hasAlpha = true; break; }
  if(hasAlpha) for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) out[(y * W + x) * 4 + 3] = rgba[(((y / S) | 0) * w + ((x / S) | 0)) * 4 + 3];
  return { rgba: out, w: W, h: H, scale: S };
}
