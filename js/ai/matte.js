/* ═══════════════════════════════════════════════════════════════
   ELIMINAR FONDO · alfa del sujeto a la resolución de la foto
   El modelo (U²-Net 320, MODNet 512, ISNet 1024) ve la foto estirada
   a un cuadrado pequeño: el borde sale a la resolución del modelo y
   se ampliaba con un simple escalado. Ahora, tras la pasada global
   (la que decide qué es sujeto), el borde se REFINA a resolución
   completa: filtro guiado por la luminosidad de la foto en una franja
   alrededor del borde, de modo que el contorno (pelo, pelusa) sigue
   la imagen real y no la rejilla del modelo; lejos del borde no se
   toca (sin halos).

   Por bloques (opcional, `tiles: true`): la foto se trabaja a mayor
   resolución en bloques del tamaño del modelo (js/ai/tiles.js) y sólo
   aportan en la franja dudosa y donde coinciden con la decisión global.
   Medido con U²-Net (tests/matte.mjs, fotos de 2000 px) NO mejora: el
   modelo da bordes igual de blandos con más resolución (correlación
   con los contornos de la foto 0,29 / 0,05 / 0,51 frente a 0,34 / 0,15 /
   0,53 sólo con el refinado) y tarda el triple; por eso es opcional y
   está apagado.
   ═══════════════════════════════════════════════════════════════ */

import { MODELS } from "./models.js";
import { runModel, aiSession } from "./runtime.js";
import { tilePlan, tileWeights, blender, resizeBilinear, smooth, workSide } from "./tiles.js";
import { guidedFilterAlpha, boxBlurFloat } from "../editor/refineedge-math.js";

const squareRgba = (src, sx, sy, sw, sh, n) => {
  const c = document.createElement("canvas"); c.width = c.height = n;
  const x = c.getContext("2d", { willReadFrequently: true, colorSpace: "srgb", forceSrgb: true });
  x.imageSmoothingQuality = "high";
  x.drawImage(src, sx, sy, sw, sh, 0, 0, n, n);
  return x.getImageData(0, 0, n, n).data;
};
const toFloat = u8 => { const f = new Float32Array(u8.length); for(let i = 0; i < f.length; i++) f[i] = u8[i] / 255; return f; };

/** Refina `alpha` (Float32 0-1, W×H) con el filtro guiado por la luminosidad de `src`, sólo en la franja del borde. */
export function refineAlpha(alpha, W, H, rgba){
  const N = W * H, I = new Float32Array(N);
  for(let i = 0, j = 0; i < N; i++, j += 4) I[i] = (rgba[j] * 0.2126 + rgba[j + 1] * 0.7152 + rgba[j + 2] * 0.0722) / 255;
  const r = Math.max(2, Math.round(Math.max(W, H) / 700));
  const g = guidedFilterAlpha(I, alpha, W, H, r, 0.0012);
  const band = boxBlurFloat(alpha, W, H, r * 2), out = new Float32Array(N);
  for(let i = 0; i < N; i++){ const b = band[i]; out[i] = b > 0.995 || b < 0.005 ? alpha[i] : Math.min(1, Math.max(0, g[i])); }
  return out;
}

/** Alfa 0-255 del sujeto de `src` (lienzo), del tamaño de `src`. `tiles: true` añade la pasada por bloques (apagada: no mejora, ver arriba). */
export async function matteAlpha(src, id, { tiles = false, refine = true } = {}){
  const n = MODELS[id].input, W = src.width, H = src.height, long = Math.max(W, H), OV = Math.round(n / 4);
  return aiSession("Eliminando fondo con IA", async step => {
    step(0, 1);
    // 1. Global: la foto entera estirada al cuadrado del modelo
    const rg = await runModel("matte", id, { rgba: squareRgba(src, 0, 0, W, H, n), size: n }, []);
    const coarse = toFloat(rg.mask);
    const side = workSide(n, OV, 2, long);
    let alpha;
    if(tiles && side > n * 1.3){
      // 2. Bloques a mayor resolución, sólo para la franja dudosa
      const k = side / long, WW = Math.round(W * k), HH = Math.round(H * k);
      const work = document.createElement("canvas"); work.width = WW; work.height = HH;
      const wx = work.getContext("2d", { willReadFrequently: true, colorSpace: "srgb", forceSrgb: true });
      wx.imageSmoothingQuality = "high"; wx.drawImage(src, 0, 0, WW, HH);
      const G = resizeBilinear(coarse, n, n, WW, HH);
      const plan = tilePlan(WW, HH, n, OV), total = 1 + plan.length, mix = blender(WW, HH);
      for(let i = 0; i < plan.length; i++){
        step(1 + i, total);
        const t = plan[i], r = await runModel("matte", id, { rgba: squareRgba(work, t.x, t.y, t.w, t.h, n), size: n }, []);
        mix.add(t, resizeBilinear(toFloat(r.mask), n, n, t.w, t.h), tileWeights(t, WW, HH, OV));
      }
      step(total, total);
      const tl = mix.result(), band = new Float32Array(WW * HH);
      for(let i = 0; i < band.length; i++) band[i] = G[i] > 0.06 && G[i] < 0.94 ? 1 : 0;
      const gate = smooth(band, WW, HH, Math.max(4, Math.round(WW / 64)));
      /* Un bloque no ve la foto entera: si discrepa de la decisión global (sujeto/fondo), manda la global; donde coinciden, aporta el
         detalle fino del borde (pelo, pelusa) a mayor resolución. */
      for(let i = 0; i < G.length; i++){
        if((tl[i] > 0.5) !== (G[i] > 0.5)) continue;
        G[i] += (tl[i] - G[i]) * Math.min(1, gate[i] * 3);
      }
      alpha = resizeBilinear(G, WW, HH, W, H);
    } else alpha = resizeBilinear(coarse, n, n, W, H);
    // 3. Borde a resolución completa
    if(refine){
      const rgba = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
      alpha = refineAlpha(alpha, W, H, rgba);
    }
    const out = new Uint8ClampedArray(W * H);
    for(let i = 0; i < out.length; i++) out[i] = Math.round(alpha[i] * 255);
    return out;
  }, { unit: "bloque" });
}
