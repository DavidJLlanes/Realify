/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · COLOREAR
   Colorea una imagen en blanco y negro: predice los canales a y b del espacio Lab.
   Entradas: modelo, imagen RGBA y tamaño. Salida: canales ab.
   ═══════════════════════════════════════════════════════════════ */

import { rgbToLab, labToRgb, rgbfToLab } from "../lab.js";
import { getSession, runSession } from "../engine/sessions.js";
import { inputType, makeTensor, readFloats } from "../engine/tensors.js";
import { post } from "../engine/post.js";
import { starts, mirror } from "../engine/tiling.js";

/* ── Colorear ─────────────────────────────────────────────────
   Devuelve sólo el color (a, b de Lab) a la resolución de trabajo; la
   luminancia la pone quien llama, de la foto original. */
export async function colorize({ model, id, rgba, w, h }){
  const { session } = await getSession(id, model);
  const name = session.inputNames[0], type = inputType(session, name);
  const ab = new Float32Array(w * h * 2);
  post({ type:"stage", model:id, stage:"run" });
  if(model.colorize === "ab"){
    // DDColor: la luminancia en RGB (a = b = 0) a N × N, salida a y b.
    const N = model.input || 512, n = N * N, input = new Float32Array(3 * n);
    for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
      const sx = Math.min(w - 1, (x * w / N) | 0), sy = Math.min(h - 1, (y * h / N) | 0), si = (sy * w + sx) * 4;
      const L = rgbToLab(rgba[si], rgba[si + 1], rgba[si + 2])[0], [r, g, b] = labToRgb(L, 0, 0), p = y * N + x;
      input[p] = r / 255; input[n + p] = g / 255; input[2 * n + p] = b / 255;
    }
    const res = await runSession(id, model, { [name]: makeTensor(type, input, [1, 3, N, N]) });
    const t = res[session.outputNames[0]], v = readFloats(t), oh = t.dims[2], ow = t.dims[3], on = ow * oh;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const sx = Math.min(ow - 1, (x * ow / w) | 0), sy = Math.min(oh - 1, (y * oh / h) | 0), p = sy * ow + sx, o = (y * w + x) * 2;
      ab[o] = v[p]; ab[o + 1] = v[on + p];
    }
    return { ab, w, h };
  }
  // Modelos «1x»: la foto en gris, por teselas; del resultado sólo el color.
  const gray = new Uint8ClampedArray(rgba.length);
  for(let i = 0; i < rgba.length; i += 4){ const L = rgbToLab(rgba[i], rgba[i + 1], rgba[i + 2])[0], [r, g, b] = labToRgb(L, 0, 0); gray[i] = r; gray[i + 1] = g; gray[i + 2] = b; gray[i + 3] = 255; }
  const tile = Math.min(model.tile || 512, Math.max(w, h)), overlap = 32;
  const xs = starts(w, Math.min(tile, w), overlap), ys = starts(h, Math.min(tile, h), overlap);
  const total = xs.length * ys.length; let done = 0;
  for(let r = 0; r < ys.length; r++) for(let c = 0; c < xs.length; c++){
    const x0 = xs[c], y0 = ys[r], tw = Math.min(tile, w), th = Math.min(tile, h);
    const pw = Math.ceil(tw / 8) * 8, ph = Math.ceil(th / 8) * 8, n = pw * ph, input = new Float32Array(3 * n);
    for(let y = 0; y < ph; y++) for(let x = 0; x < pw; x++){
      const si = ((y0 + mirror(y, th)) * w + x0 + mirror(x, tw)) * 4, p = y * pw + x;
      input[p] = gray[si] / 255; input[n + p] = gray[si + 1] / 255; input[2 * n + p] = gray[si + 2] / 255;
    }
    const res = await runSession(id, model, { [name]: makeTensor(type, input, [1, 3, ph, pw]) });
    const t = res[session.outputNames[0]], v = readFloats(t), ow = t.dims[3], on = t.dims[2] * ow;
    const ovL = c ? xs[c - 1] + tw - x0 : 0, ovT = r ? ys[r - 1] + th - y0 : 0;
    for(let y = 0; y < th; y++) for(let x = 0; x < tw; x++){
      const p = y * ow + x, o = ((y0 + y) * w + x0 + x) * 2;
      const [, A, B] = rgbfToLab(v[p], v[on + p], v[2 * on + p]);
      let a = 1;
      if(x < ovL){ const k = x / Math.max(1, ovL - 1); a = Math.min(a, k * k * (3 - 2 * k)); }
      if(y < ovT){ const k = y / Math.max(1, ovT - 1); a = Math.min(a, k * k * (3 - 2 * k)); }
      ab[o] = a === 1 ? A : ab[o] * (1 - a) + A * a; ab[o + 1] = a === 1 ? B : ab[o + 1] * (1 - a) + B * a;
    }
    done++; post({ type:"tiles", model:id, done, total });
  }
  return { ab, w, h };
}
