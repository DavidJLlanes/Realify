/* ═══════════════════════════════════════════════════════════════
   IA · SEGMENT ANYTHING (Premium 👑)
   Selección con un toque y Borrador mágico. MobileSAM analiza la foto
   una vez (worker.js › samEncode) y cada toque sólo pide la máscara al
   decodificador de SAM (samDecode), que tarda milisegundos.

   Procesado Premium, «el bueno y el mejor», sobre la máscara de SAM:
     · Bueno: SAM da la máscara a ≤ 1024 px como valores continuos
       (logits). En vez de umbralizarla ahí y ampliar una máscara de
       bloques, se amplían los LOGITS con interpolación bilineal a la
       resolución completa de la foto y sólo después se pasan a alfa con
       una sigmoide: el borde sale liso y con el ancho justo.
     · Mejor: el borde se «engancha» a los contornos reales de la foto
       con un filtro guiado (el mismo de Refinar borde, guiado por la
       luminancia a resolución completa), se quitan las manchas sueltas
       que no tocan ningún punto marcado y se rellenan los agujeros
       pequeños del objeto.
   ═══════════════════════════════════════════════════════════════ */

import { runModel } from "./runtime.js";
import { guidedFilterAlpha, boxBlurFloat } from "../editor/refineedge-math.js";

let seq = 0;

/** Analiza `source` (un lienzo). Devuelve el estado para `samPredict`. */
export async function samPrepare(source){
  const W = source.width, H = source.height, k = 1024 / Math.max(W, H);
  const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high";
  x.drawImage(source, 0, 0, w, h);
  const rgba = x.getImageData(0, 0, w, h).data;
  const key = "sam" + (++seq) + "-" + Date.now();
  await runModel("samEncode", "sam_enc", { rgba, w, h, key }, [rgba.buffer]);
  return { key, W, H, w, h, k, low: null };
}

/** Máscara para los puntos `[{ x, y, pos }]` (coordenadas de la foto).
    Devuelve `{ logits, w, h, score }` a la resolución de análisis. */
export async function samPredict(st, points){
  if(!points.length) return null;
  const coords = [], labels = [];
  for(const p of points){ coords.push(p.x * st.k, p.y * st.k); labels.push(p.pos ? 1 : 0); }
  coords.push(0, 0); labels.push(-1);          // punto de relleno (sin caja)
  // Con más de un punto, la máscara anterior ayuda a SAM a refinar en
  // vez de empezar de cero (su uso interactivo recomendado).
  const maskInput = points.length > 1 && st.low ? st.low.slice() : null;
  const r = await runModel("samDecode", "sam_dec",
    { key: st.key, coords, labels, w: st.w, h: st.h, maskInput },
    maskInput ? [maskInput.buffer] : [], { quiet: true });
  st.low = r.lowRes;
  return { logits: r.logits, w: r.mw, h: r.mh, score: r.score };
}

/** Máscara rápida para la vista previa (0-255, a la resolución de análisis). */
export function previewMask(m){
  const out = new Uint8ClampedArray(m.w * m.h);
  for(let i = 0; i < out.length; i++) out[i] = m.logits[i] > 0 ? 255 : 0;
  return out;
}

/* Componentes conexos de una máscara binaria (4-vecinos). */
function components(bin, w, h){
  const lab = new Int32Array(w * h), sizes = [0];
  const stack = new Int32Array(w * h);
  let n = 0;
  for(let s = 0; s < bin.length; s++){
    if(!bin[s] || lab[s]) continue;
    n++; let top = 0, size = 0; stack[top++] = s; lab[s] = n;
    while(top){
      const p = stack[--top]; size++;
      const x = p % w, y = (p / w) | 0;
      if(x > 0 && bin[p - 1] && !lab[p - 1]){ lab[p - 1] = n; stack[top++] = p - 1; }
      if(x < w - 1 && bin[p + 1] && !lab[p + 1]){ lab[p + 1] = n; stack[top++] = p + 1; }
      if(y > 0 && bin[p - w] && !lab[p - w]){ lab[p - w] = n; stack[top++] = p - w; }
      if(y < h - 1 && bin[p + w] && !lab[p + w]){ lab[p + w] = n; stack[top++] = p + w; }
    }
    sizes.push(size);
  }
  return { lab, sizes };
}

/* «Mejor» (a la resolución de análisis): fuera manchas sueltas que no
   tocan ningún punto positivo; dentro, agujeros pequeños rellenos. */
function cleanBinary(m, points, st){
  const { w, h } = m, n = w * h, bin = new Uint8Array(n);
  for(let i = 0; i < n; i++) bin[i] = m.logits[i] > 0 ? 1 : 0;
  const fg = components(bin, w, h);
  const keep = new Uint8Array(fg.sizes.length);
  let total = 0; for(let i = 1; i < fg.sizes.length; i++) total += fg.sizes[i];
  for(const p of points){
    if(!p.pos) continue;
    const x = Math.min(w - 1, Math.max(0, Math.round(p.x * st.k))), y = Math.min(h - 1, Math.max(0, Math.round(p.y * st.k)));
    // El punto puede caer justo fuera: se busca el componente más cercano en un radio pequeño
    for(let r = 0, found = false; r <= 6 && !found; r++)
      for(let dy = -r; dy <= r && !found; dy++) for(let dx = -r; dx <= r && !found; dx++){
        const xx = x + dx, yy = y + dy;
        if(xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const l = fg.lab[yy * w + xx]; if(l){ keep[l] = 1; found = true; }
      }
  }
  // Un componente grande (≥ 15 % del total) se queda aunque no tenga punto
  for(let i = 1; i < fg.sizes.length; i++) if(fg.sizes[i] >= total * 0.15) keep[i] = 1;
  if(!keep.some(Boolean)) return bin;
  for(let i = 0; i < n; i++) bin[i] = fg.lab[i] && keep[fg.lab[i]] ? 1 : 0;
  // Agujeros: componentes del fondo que no tocan el borde y son pequeños
  const inv = new Uint8Array(n); for(let i = 0; i < n; i++) inv[i] = bin[i] ? 0 : 1;
  const bg = components(inv, w, h), border = new Uint8Array(bg.sizes.length);
  for(let x = 0; x < w; x++){ border[bg.lab[x]] = 1; border[bg.lab[(h - 1) * w + x]] = 1; }
  for(let y = 0; y < h; y++){ border[bg.lab[y * w]] = 1; border[bg.lab[y * w + w - 1]] = 1; }
  let area = 0; for(let i = 0; i < n; i++) area += bin[i];
  // No rellenar un hueco donde se marcó un punto negativo
  const negHole = new Uint8Array(bg.sizes.length);
  for(const p of points){
    if(p.pos) continue;
    const x = Math.min(w - 1, Math.max(0, Math.round(p.x * st.k))), y = Math.min(h - 1, Math.max(0, Math.round(p.y * st.k)));
    negHole[bg.lab[y * w + x]] = 1;
  }
  for(let i = 0; i < n; i++){
    const l = bg.lab[i];
    if(l && !border[l] && !negHole[l] && bg.sizes[l] < area * 0.02) bin[i] = 1;
  }
  return bin;
}

/** Máscara final a la resolución de la foto (Uint8, 0-255), con el
    procesado Premium. `rgba` = píxeles de la foto a tamaño completo. */
export function finalMask(m, points, st, rgba){
  const { w, h } = m, W = st.W, H = st.H, N = W * H;
  // Mejor: limpieza a la resolución de análisis (barata) y se aplica
  // sobre los logits: fuera de lo que se queda, fondo seguro.
  const bin = cleanBinary(m, points, st);
  const L = new Float32Array(w * h);
  for(let i = 0; i < L.length; i++){
    const v = m.logits[i];
    // Dentro/fuera seguros tras la limpieza (con la pendiente de abajo,
    // ±1,5 da un alfa de 0,998 / 0,002)
    L[i] = bin[i] ? Math.max(v, 1.5) : Math.min(v, -1.5);
  }
  // Bueno: logits ampliados con interpolación bilineal y sigmoide
  const alpha = new Float32Array(N), sx = w / W, sy = h / H;
  for(let y = 0; y < H; y++){
    const fy = Math.min(h - 1, Math.max(0, (y + 0.5) * sy - 0.5)), y0 = fy | 0, y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < W; x++){
      const fx = Math.min(w - 1, Math.max(0, (x + 0.5) * sx - 0.5)), x0 = fx | 0, x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      const a = L[y0 * w + x0] + (L[y0 * w + x1] - L[y0 * w + x0]) * tx;
      const b = L[y1 * w + x0] + (L[y1 * w + x1] - L[y1 * w + x0]) * tx;
      const v = a + (b - a) * ty;
      // Pendiente ×4: los logits de SAM son pequeños (±1-3 cerca del
      // borde) y una sigmoide sin más dejaba el interior al 60-90 %
      alpha[y * W + x] = 1 / (1 + Math.exp(-4 * v));
    }
  }
  // Mejor: filtro guiado por la luminancia de la foto (el borde sigue
  // los contornos reales), sólo si hay foto a tamaño completo
  let out = alpha;
  if(rgba && rgba.length >= N * 4){
    const I = new Float32Array(N);
    for(let i = 0, j = 0; i < N; i++, j += 4) I[i] = (rgba[j] * 0.2126 + rgba[j + 1] * 0.7152 + rgba[j + 2] * 0.0722) / 255;
    const r = Math.max(2, Math.round(Math.max(W, H) / 700));
    const g = guidedFilterAlpha(I, alpha, W, H, r, 0.0015);
    // Sólo en una franja alrededor del borde (±2r): dentro y fuera se
    // queda la decisión de SAM, así el filtro no crea halos lejos del objeto
    const band = boxBlurFloat(alpha, W, H, r * 2);
    out = new Float32Array(N);
    for(let i = 0; i < N; i++){
      const b = band[i];
      out[i] = b > 0.995 || b < 0.005 ? alpha[i] : Math.min(1, Math.max(0, g[i]));
    }
  }
  const mask = new Uint8ClampedArray(N);
  for(let i = 0; i < N; i++) mask[i] = Math.round(out[i] * 255);
  return mask;
}
