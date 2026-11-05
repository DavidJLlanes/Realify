/* ═══════════════════════════════════════════════════════════════
   EDITOR DE ROPA · PIXELES
   Une el motor de js/features/clothing/ con los lienzos. `prepararVista` baja la foto a la escala de trabajo y la pasa a luz lineal;
   `capa` calcula las etapas sobre una copia y devuelve un lienzo RGBA cuyo alfa es la máscara (así sólo se pinta la prenda y el resto de la foto
   queda intacto). Las máscaras de personas se sacan de las partes del modelo y las de tela, de los toques (SAM si hay, crecimiento por color
   si no). Entradas: foto, escala, máscaras y valores. Salidas: prep, máscaras Float32 y lienzos.
   ═══════════════════════════════════════════════════════════════ */
import { toPlanes, fromPlanes } from "../../js/features/portrait/shared/planes.js";
import { mascaraPrenda } from "../../js/features/clothing/shared/mascara.js";
import { crecerRegion } from "../../js/features/clothing/shared/region.js";
import { etapas, hayCambioRopa } from "../../js/features/clothing/engine/index.js";

export { hayCambioRopa };
const lienzo = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

export function prepararVista(src, maxSide){
  const k = Math.min(1, maxSide / Math.max(src.width, src.height)), W = Math.max(1, Math.round(src.width * k)), H = Math.max(1, Math.round(src.height * k));
  const c = lienzo(W, H), x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H);
  return { k, W, H, rgba: d.data, base: toPlanes(d.data, W, H), crop: { x: 0, y: 0, w: src.width, h: src.height, k, W, H }, cache: new Map() };
}

export function mascaraPersona(prep, persona, prenda = "todo"){
  const clave = "p" + persona.caja.x + "," + persona.caja.y + prenda;
  if(!prep.cache.has(clave)) prep.cache.set(clave, mascaraPrenda(persona.partes, prep.crop, prep.base.Y, prenda));
  return prep.cache.get(clave);
}

/* Una máscara de SAM (logits a baja resolución en un marco) llevada a la escala de trabajo */
function desdeSam(m, prep, srcW, srcH){
  const out = new Float32Array(prep.W * prep.H), { logits, w, h } = m;
  for(let y = 0; y < prep.H; y++) for(let x = 0; x < prep.W; x++){
    const fx = Math.min(w - 1.001, Math.max(0, (x + 0.5) / prep.W * w - 0.5)), fy = Math.min(h - 1.001, Math.max(0, (y + 0.5) / prep.H * h - 0.5)), a = fx | 0, b = fy | 0, tx = fx - a, ty = fy - b;
    const l = (logits[b * w + a] * (1 - tx) + logits[b * w + a + 1] * tx) * (1 - ty) + (logits[(b + 1) * w + a] * (1 - tx) + logits[(b + 1) * w + a + 1] * tx) * ty;
    out[y * prep.W + x] = 1 / (1 + Math.exp(-l * 1.5));
  }
  return out;
}

/** Máscara de las telas tocadas: unión de «añade» menos los «quita». Cada toque { x, y (foto), modo, tol, sam (logits) }. */
export function mascaraTelas(prep, toques, src){
  const out = new Float32Array(prep.W * prep.H);
  for(const t of toques){
    const x = t.x * prep.k, y = t.y * prep.k;
    let m = t.sam ? desdeSam(t.sam, prep, src.width, src.height) : crecerRegion(prep.base, x, y, t.tol);
    if(t.sam){ const g = crecerRegion(prep.base, x, y, Math.min(100, t.tol + 30)); for(let i = 0; i < m.length; i++) m[i] *= g[i] > 0.05 ? 1 : 0.0; }   // SAM propone el borde; el color evita que se vaya a otra cosa
    if(t.modo === "sub") for(let i = 0; i < out.length; i++) out[i] *= 1 - m[i];
    else for(let i = 0; i < out.length; i++) out[i] = Math.max(out[i], m[i]);
  }
  return out;
}

/** Lienzo RGBA con la prenda retocada (alfa = máscara). null si no hay nada que hacer. */
export function capa(prep, mascara, v){
  if(!mascara || !hayCambioRopa(v)) return null;
  const { W, H, base } = prep, p = { W, H, R: Float32Array.from(base.R), G: Float32Array.from(base.G), B: Float32Array.from(base.B), Y: Float32Array.from(base.Y) };
  etapas(p, mascara, v);
  const c = lienzo(W, H), x = c.getContext("2d"), d = x.createImageData(W, H);
  fromPlanes(p, d.data);
  for(let i = 0; i < W * H; i++) d.data[i * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, mascara[i])));
  x.putImageData(d, 0, 0);
  return c;
}
