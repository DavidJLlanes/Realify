/* ═══════════════════════════════════════════════════════════════
   ESCENA · MÁSCARAS DE LA ESCENA
   Qué es cielo, agua, follaje, edificios (clases de ADE20K del modelo DeepLab que ya viaja con la web), el sujeto (persona) y la piel (partes
   del modelo de personas), llevados a la escala de trabajo como Float32Array 0-1. Entradas: lienzo de la foto y tamaño de trabajo.
   Salidas: mascaraClases(), mascaraSujeto(), mascaraPiel(); CATEGORIAS = { tipo: [nombres en inglés de ADE20K] }.
   ═══════════════════════════════════════════════════════════════ */
import { CLASSES } from "../../../ai/textclasses.js";

export const CATEGORIAS = {
  cielo: ["sky"], agua: ["water", "sea", "river", "lake", "waterfall", "swimming pool", "fountain"],
  follaje: ["tree", "grass", "plant", "field", "flower", "palm"], edificios: ["building", "house", "skyscraper", "tower"]
};
/* Canales del modelo: el de la clase i (0-149) es i + 1 */
export const canales = nombres => nombres.map(n => CLASSES.findIndex(c => c[0] === n) + 1).filter(c => c > 0);

function aFloat(u8, sw, sh, W, H){
  const out = new Float32Array(W * H);
  for(let y = 0; y < H; y++){ const fy = Math.min(sh - 1.001, Math.max(0, (y + 0.5) * sh / H - 0.5)), y0 = fy | 0, ty = fy - y0;
    for(let x = 0; x < W; x++){ const fx = Math.min(sw - 1.001, Math.max(0, (x + 0.5) * sw / W - 0.5)), x0 = fx | 0, tx = fx - x0, i = y0 * sw + x0;
      out[y * W + x] = ((u8[i] * (1 - tx) + u8[i + 1] * tx) * (1 - ty) + (u8[i + sw] * (1 - tx) + u8[i + sw + 1] * tx) * ty) / 255; } }
  return out;
}

/** Unión de clases de ADE20K. Devuelve { mascara: Float32 W×H, hay } */
export async function mascaraClases(src, nombres, W, H, titulo){
  const { segmentClasses } = await import("../../../filters/segment/segment.js");
  const r = await segmentClasses(src, canales(nombres), titulo);
  return { mascara: aFloat(r.mask, src.width, src.height, W, H), hay: r.found };
}

export async function mascaraSujeto(src, W, H){
  const { segmentPerson } = await import("../../../filters/segment/segment.js");
  const r = await segmentPerson(src); let c = 0; for(let i = 0; i < r.mask.length; i += 7) if(r.mask[i] > 127) c++;
  return { mascara: aFloat(r.mask, src.width, src.height, W, H), hay: c > 20 };
}

/** Piel de todas las personas (partes del modelo de personas) */
export async function mascaraPiel(src, W, H){
  const { analyze } = await import("../../../ai/people/analyze.js"), { mascaraParte } = await import("../../portrait/shared/partes.js");
  const res = await analyze(src, { quality: "mejor", kinds: ["landmarks", "poses", "partes"] }), k = W / src.width, crop = { x: 0, y: 0, w: src.width, h: src.height, k, W, H };
  const out = new Float32Array(W * H); let hay = false;
  for(const p of res.personas){ const m = p.partes && mascaraParte(p.partes, "piel", crop); if(!m) continue; hay = true; for(let i = 0; i < out.length; i++) if(m[i] > out[i]) out[i] = m[i]; }
  return { mascara: out, hay };
}
