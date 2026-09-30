/* ═══════════════════════════════════════════════════════════════
   IA · ILUMINAR CON IA (Zero-DCE++, Premium 👑)
   Zero-DCE++ (Li, Guo y Loy, TPAMI 2021) estima, para cada punto de la
   foto y cada canal, una curva de luz: la red —diminuta, 10 000
   parámetros, 42 KB— mira la foto reducida y devuelve el mapa α de las
   curvas; luego se aplican ocho veces x ← x + α·(x² − x). No inventa
   píxeles: sólo decide cuánto levantar cada zona, así que no cambia
   la foto, la ilumina. Se ejecuta aquí mismo, en JavaScript.

   OJO: licencia CC BY-NC 4.0 (uso NO comercial), aceptada por el
   usuario mientras Realify sea gratuito (ver CLAUDE.md y
   assets/models/zerodce/LICENSE.txt).

   Procesado Premium («el bueno y el mejor»), siempre:
     · Bueno: los mapas α se amplían a la resolución de la foto con un
       filtro guiado por la propia imagen (siguen sus bordes: sin halos
       ni zonas planas) y las curvas se aplican en coma flotante.
     · Mejor: el negro vuelve a su sitio (sin lavar), el ruido de luz y
       de color que aparece al levantar las sombras se limpia en
       proporción a lo que se ha aclarado cada punto, y se trama.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, slider, pickerGroup } from "../editor/adjust.js";
import { guidedFilterAlpha } from "../editor/refineedge-math.js";
import { finishLifted } from "../editor/lowlight.js";

const URL_W = new URL("../../assets/models/zerodce/zerodce_pp.bin", import.meta.url).href;
// [canales de entrada, de salida] de cada bloque (convolución 3×3 por canal + 1×1)
const LAYERS = [[3, 32], [32, 32], [32, 32], [32, 32], [64, 32], [64, 32], [64, 3]];
const EST = 320;   // lado largo al que la red estima las curvas

let weights = null;
async function loadWeights(){
  if(weights) return weights;
  const res = await fetch(URL_W);
  if(!res.ok) throw new Error("No se pudo cargar el modelo (" + res.status + ")");
  const f = new Float32Array(await res.arrayBuffer());
  let o = 0; const take = n => { const a = f.subarray(o, o + n); o += n; return a; };
  weights = LAYERS.map(([ci, co]) => ({ ci, co, dw: take(ci * 9), db: take(ci), pw: take(co * ci), pb: take(co) }));
  return weights;
}

/* Un bloque: 3×3 por canal (con relleno) y luego 1×1 */
function block(x, w, h, L, act){
  const n = w * h, t = new Float32Array(L.ci * n), y = new Float32Array(L.co * n);
  for(let c = 0; c < L.ci; c++){
    const k = L.dw.subarray(c * 9, c * 9 + 9), b = L.db[c], src = c * n;
    for(let yy = 0; yy < h; yy++) for(let xx = 0; xx < w; xx++){
      let s = b;
      for(let dy = -1; dy <= 1; dy++){ const Y = yy + dy; if(Y < 0 || Y >= h) continue;
        for(let dx = -1; dx <= 1; dx++){ const X = xx + dx; if(X < 0 || X >= w) continue; s += k[(dy + 1) * 3 + dx + 1] * x[src + Y * w + X]; } }
      t[src + yy * w + xx] = s;
    }
  }
  for(let o = 0; o < L.co; o++){
    const dst = y.subarray(o * n, o * n + n); dst.fill(L.pb[o]);
    for(let c = 0; c < L.ci; c++){ const wt = L.pw[o * L.ci + c], s = t.subarray(c * n, c * n + n); for(let p = 0; p < n; p++) dst[p] += wt * s[p]; }
    for(let p = 0; p < n; p++) dst[p] = act(dst[p]);
  }
  return y;
}
const relu = v => v > 0 ? v : 0;
const cat = (a, b) => { const o = new Float32Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };

/* Mapas α (3 × h × w) de una imagen planar RGB 0-1 */
function curves(W, x, w, h){
  const x1 = block(x, w, h, W[0], relu), x2 = block(x1, w, h, W[1], relu), x3 = block(x2, w, h, W[2], relu), x4 = block(x3, w, h, W[3], relu);
  const x5 = block(cat(x3, x4), w, h, W[4], relu), x6 = block(cat(x2, x5), w, h, W[5], relu);
  return block(cat(x1, x6), w, h, W[6], Math.tanh);
}

/* Foto reducida (media por bloques) a planar RGB 0-1 */
function shrink(d, w, h){
  const k = Math.min(1, EST / Math.max(w, h)), ws = Math.max(8, Math.round(w * k)), hs = Math.max(8, Math.round(h * k)), n = ws * hs;
  const x = new Float32Array(3 * n), cnt = new Float32Array(n);
  for(let y = 0; y < h; y++){ const ys = Math.min(hs - 1, (y * hs / h) | 0);
    for(let xx = 0; xx < w; xx++){ const p = ys * ws + Math.min(ws - 1, (xx * ws / w) | 0), i = (y * w + xx) * 4;
      x[p] += d[i] / 255; x[n + p] += d[i + 1] / 255; x[2 * n + p] += d[i + 2] / 255; cnt[p]++; } }
  for(let p = 0; p < n; p++){ x[p] /= cnt[p]; x[n + p] /= cnt[p]; x[2 * n + p] /= cnt[p]; }
  return { x, ws, hs };
}

let memo = null;   // { key, A, ws, hs } — la última estimación
const toLin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);

function enhance(W, d, w, h, p){
  const { x, ws, hs } = shrink(d, w, h);
  let key = ws * 7 + hs; for(let i = 0; i < x.length; i += 97) key = (key * 31 + Math.round(x[i] * 255)) | 0;
  if(!memo || memo.key !== key) memo = { key, A: curves(W, x, ws, hs), ws, hs };
  const { A } = memo, n = w * h, ns = ws * hs;
  // Guía: la luz de la foto a su tamaño
  const Y = new Float32Array(n);
  for(let i = 0, j = 0; i < n; i++, j += 4) Y[i] = (0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]) / 255;
  const r = Math.max(2, Math.round(Math.max(w, h) / 150));
  const up = c => {
    const o = new Float32Array(n), a = A.subarray(c * ns, c * ns + ns);
    for(let y = 0; y < h; y++){
      const fy = Math.min(hs - 1, Math.max(0, (y + 0.5) * hs / h - 0.5)), y0 = fy | 0, y1 = Math.min(hs - 1, y0 + 1), ty = fy - y0;
      for(let xx = 0; xx < w; xx++){
        const fx = Math.min(ws - 1, Math.max(0, (xx + 0.5) * ws / w - 0.5)), x0 = fx | 0, x1 = Math.min(ws - 1, x0 + 1), tx = fx - x0;
        const t = a[y0 * ws + x0] + (a[y0 * ws + x1] - a[y0 * ws + x0]) * tx, u = a[y1 * ws + x0] + (a[y1 * ws + x1] - a[y1 * ws + x0]) * tx;
        o[y * w + xx] = (t + (u - t) * ty + 1) / 2;     // α (−1…1) → 0…1 para el filtro
      }
    }
    const g = guidedFilterAlpha(Y, o, w, h, r, 0.001);
    for(let i = 0; i < n; i++) g[i] = g[i] * 2 - 1;
    return g;
  };
  const k = p.amount / 100, ch = [up(0), up(1), up(2)];
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), gain = new Float32Array(n), out = [R, G, B];
  for(let i = 0, j = 0; i < n; i++, j += 4){
    let yin = 0, yout = 0;
    for(let c = 0; c < 3; c++){
      let v = d[j + c] / 255; const a = Math.max(-1, Math.min(1, ch[c][i] * k));
      for(let t = 0; t < 8; t++) v = v + a * (v * v - v);
      const li = toLin(d[j + c] / 255), lo = toLin(Math.min(1, Math.max(0, v)));
      out[c][i] = lo; const wgt = c === 0 ? 0.2126 : c === 1 ? 0.7152 : 0.0722; yin += wgt * li; yout += wgt * lo;
    }
    gain[i] = Math.min(30, Math.max(1, yout / Math.max(1e-4, yin)));
  }
  finishLifted(d, w, h, R, G, B, gain, { lumaDenoise: 0.7 });
}

export async function aiLowLight(opts = {}){
  const W = await loadWeights();
  const p = { amount: 100, ...opts.init };
  return runAdjust({
    title: "Iluminar con IA Premium 👑", asLayer: true, filterId: "ai-low-light", filterParams: p, previewLimit: 4e5,
    compute: (d, w, h) => { if(p.amount > 0) enhance(W, d, w, h, p); },
    buildBody: ({ preview }) => {
      const b = document.createElement("div");
      b.appendChild(pickerGroup([{ label: "Intensidad", node: slider("Intensidad", 0, 150, p.amount, v => { p.amount = v; preview(); }, "%") }]));
      preview();
      return b;
    }
  }, opts);
}
