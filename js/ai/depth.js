/* ═══════════════════════════════════════════════════════════════
   IA · PROFUNDIDAD (Premium 👑)
   Depth Anything V2 Small calcula, a 518×518, lo cerca o lejos que
   está cada punto de la foto (1 = lo más cercano, 0 = lo más lejano).

   Procesado Premium («el bueno y el mejor»):
     · Global: la foto entera a 518×518 da la estructura de la escena
       (qué está delante y qué detrás).
     · Por bloques (fase 3): en fotos grandes, la foto a unas 1,75 veces
       esa resolución (2,5 con GPU) se parte en bloques de 518 que se
       solapan. El modelo
       da en cada bloque una profundidad RELATIVA (su propia escala y
       desplazamiento), así que cada bloque se ajusta por mínimos
       cuadrados al mapa global y se funde con los demás sin costuras.
       Del resultado, las formas grandes salen del mapa global (siempre
       coherente) y el detalle fino de los bloques: pelo, ramas, bordes
       de objetos pequeños que a 518 px se perdían.
     · Mejor: se ajusta a los bordes REALES de la foto con un filtro
       guiado por la propia imagen, a la resolución de trabajo de cada
       herramienta.
   ═══════════════════════════════════════════════════════════════ */

import { runModel, aiSession } from "./runtime.js";
import { guidedFilterAlpha } from "../editor/refineedge-math.js";
import { tilePlan, tileWeights, blender, fitAffine, resizeBilinear, smooth, workSide } from "./tiles.js";

const S = 518;
let cache = null;   // { src, map } — la última foto analizada

/* La región (x, y, w, h) de `src` estirada a S×S, en RGBA */
function squareRGBA(src, x, y, w, h){
  const c = document.createElement("canvas"); c.width = c.height = S;
  const cx = c.getContext("2d", { willReadFrequently: true });
  cx.imageSmoothingQuality = "high";
  cx.drawImage(src, x, y, w, h, 0, 0, S, S);
  return cx.getImageData(0, 0, S, S).data;
}
const infer = rgba => runModel("depth", "depth", { rgba }, [rgba.buffer], { title: "Calculando la profundidad con IA" });

/** Mapa de profundidad de `source` (un lienzo): { d: Float32 0-1, w, h }. */
export async function depthMap(source){
  if(cache && cache.src === source) return cache.map;
  const W0 = source.width, H0 = source.height, long = Math.max(W0, H0), OV = Math.round(S / 4);
  const map = await aiSession("Calculando la profundidad con IA", async step => {
    step(0, 1);
    const g = await infer(squareRGBA(source, 0, 0, W0, H0));
    /* Bloques: 2 a lo largo del lado mayor (3 con GPU, donde cada pasada
       cuesta décimas de segundo). Sólo si la foto es claramente mayor
       que el modelo. */
    const side = workSide(S, OV, g.backend === "webgpu" ? 3 : 2, long);
    const k = side / long, W = Math.round(W0 * k), H = Math.round(H0 * k);
    const plan = side > S * 1.3 ? tilePlan(W, H, S, OV) : [];
    if(!plan.length) return { d: g.depth, w: S, h: S };
    const total = 1 + plan.length;

    // Foto a la resolución de trabajo, de la que salen los bloques
    const work = document.createElement("canvas"); work.width = W; work.height = H;
    const wx = work.getContext("2d"); wx.imageSmoothingQuality = "high"; wx.drawImage(source, 0, 0, W, H);
    const G = resizeBilinear(g.depth, S, S, W, H), mix = blender(W, H);
    for(let i = 0; i < plan.length; i++){
      step(1 + i, total);
      const t = plan[i];
      const tile = resizeBilinear((await infer(squareRGBA(work, t.x, t.y, t.w, t.h))).depth, S, S, t.w, t.h);
      // Escala y desplazamiento del bloque → los del mapa global
      const ref = new Float32Array(t.w * t.h);
      for(let y = 0; y < t.h; y++) ref.set(G.subarray((t.y + y) * W + t.x, (t.y + y) * W + t.x + t.w), y * t.w);
      const { a, b } = fitAffine(tile, ref);
      for(let j = 0; j < tile.length; j++) tile[j] = a * tile[j] + b;
      mix.add(t, tile, tileWeights(t, W, H, OV));
    }
    step(total, total);
    /* Formas grandes del global, detalle de los bloques: se suma al
       mosaico la parte de baja frecuencia de la diferencia con el
       global (σ ≈ 1/8 de bloque). El resultado ya está en la escala del
       global (0-1): sólo se recorta, sin reestirar, para que las
       herramientas se comporten igual que con el mapa global. */
    const M = mix.result(), diff = new Float32Array(M.length);
    for(let j = 0; j < M.length; j++) diff[j] = G[j] - M[j];
    const low = smooth(diff, W, H, Math.round(S / 8));
    for(let j = 0; j < M.length; j++){ const v = M[j] + low[j]; M[j] = v < 0 ? 0 : v > 1 ? 1 : v; }
    return { d: M, w: W, h: H };
  });
  cache = { src: source, map };
  return map;
}

/** Profundidad a w×h (Float32, 0-1), ajustada a los bordes de `rgba`
    (los píxeles de la foto a ese mismo tamaño). */
export function depthAt(map, w, h, rgba){
  const mw = map.w || map.n, mh = map.h || map.n;
  const out = resizeBilinear(map.d, mw, mh, w, h);
  if(!rgba) return out;
  const I = new Float32Array(w * h);
  for(let i = 0, j = 0; i < w * h; i++, j += 4) I[i] = (rgba[j] * 0.2126 + rgba[j + 1] * 0.7152 + rgba[j + 2] * 0.0722) / 255;
  const r = Math.max(2, Math.round(Math.max(w, h) / 300));
  const g = guidedFilterAlpha(I, out, w, h, r, 0.0008);
  for(let i = 0; i < g.length; i++) g[i] = Math.min(1, Math.max(0, g[i]));
  return g;
}
