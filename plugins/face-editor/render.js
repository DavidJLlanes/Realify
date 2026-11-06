/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CARA · PIEL: PREPARAR Y PINTAR UNA CARA
   Para cada cara: recorte de trabajo, zonas, máscara de piel y planos en luz lineal (prepararCara); y la cadena de las cinco
   etapas de piel con los valores del editor (renderCara). Orden: luz → piel (imperfecciones y tono, ojeras, arrugas, brillos, textura) → ojos → labios y cejas → dientes → pelo → gafas →
   pelos sueltos. Sólo cambia lo que cambia: el resto de píxeles sale con sus bytes originales.
   Entradas: lienzo con la imagen, persona de js/ai/people/analyze.js, valores. Salidas: { crop, … }, ImageData del recorte.
   Límites: recorte limitado a `maxSide` píxeles; si es menor que la cara real, componer() añade sólo la diferencia (delta).
   ═══════════════════════════════════════════════════════════════ */
import { cropFor, toCrop } from "../../js/features/portrait/shared/geometry.js";
import { buildZones } from "../../js/features/portrait/shared/zones.js";
import { skinMask } from "../../js/features/portrait/shared/skin.js";
import { frame } from "../../js/features/portrait/shared/geometry.js";
import { buildRasgos } from "../../js/features/portrait/shared/zones-rasgos.js";
import { mascaraParte, cajaParte } from "../../js/features/portrait/shared/partes.js";
import { pegarRecorte } from "../../js/features/ai-kit/crop-compose.js";
import { toPlanes, fromPlanes } from "../../js/features/portrait/shared/planes.js";
import { stage as relight } from "../../js/features/portrait/face-relight/engine.js";
import { stage as eyes } from "../../js/features/portrait/eyes/engine.js";
import { stage as lips } from "../../js/features/portrait/lips-brows/engine.js";
import { stage as teeth } from "../../js/features/portrait/teeth/engine.js";
import { stage as hair } from "../../js/features/portrait/hair/engine.js";
import { stage as flyaway } from "../../js/features/portrait/flyaway-hair/engine.js";
import { stage as glasses } from "../../js/features/portrait/glasses-glare/engine.js";
import { stage as even } from "../../js/features/portrait/skin-even/engine.js";
import { stage as circles } from "../../js/features/portrait/skin-dark-circles/engine.js";
import { stage as wrinkles, mapaSurcos } from "../../js/features/portrait/skin-wrinkles/engine.js";
import { stage as shine } from "../../js/features/portrait/skin-shine/engine.js";
import { stage as texture } from "../../js/features/portrait/skin-texture/engine.js";
import { stage as forma } from "../../js/features/portrait/face-shape/engine.js";

/* Luz primero (cambia el nivel de la cara); después la piel (la textura la última de ellas, para que nada la borre); después los rasgos; los
   pelos sueltos al final, que sólo tocan el fondo. */
const ETAPAS = [relight, even, circles, wrinkles, shine, texture, eyes, lips, teeth, hair, glasses, flyaway, forma];      // la forma va la última: los demás motores miran la cara original

export function prepararCara(src, persona, maxSide){
  const pts = persona.cara.puntos, crop = cropFor(pts, src.width, src.height, maxSide, cajaParte(persona.partes, "pelo"));
  const cv = document.createElement("canvas"); cv.width = crop.W; cv.height = crop.H;
  const x = cv.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high";
  x.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.W, crop.H);
  const rgba = x.getImageData(0, 0, crop.W, crop.H);
  const zonas = { ...buildZones(pts, crop), ...buildRasgos(pts, crop) }, F = frame(pts).F * crop.k, base = toPlanes(rgba.data, crop.W, crop.H);
  const refinar = { Y: base.Y, radio: F * 0.02 }, mascaras = {};          // pelo, gafas y persona del modelo de partes, ajustadas a los bordes reales
  for(const n of ["pelo", "gafas", "persona"]){ const m = mascaraParte(persona.partes, n, crop, refinar); if(m) mascaras[n] = m; }
  return { crop, rgba, puntos: pts.map(q => toCrop(q, crop)), zonas, piel: skinMask(persona.partes, zonas, crop, F), base, F, mascaras, profundidad: null, cache: {} };
}

export function renderCara(prep, values){
  const { W, H } = prep.crop, b = prep.base;
  const ctx = { W, H, R: Float32Array.from(b.R), G: Float32Array.from(b.G), B: Float32Array.from(b.B), Y: Float32Array.from(b.Y),
    F: prep.F, puntos: prep.puntos, zonas: prep.zonas, piel: prep.piel, mascaras: prep.mascaras, profundidad: prep.profundidad, cache: prep.cache };
  if((values.arrugas_int || 0) > 0 && !prep.cache.surcos) mapaSurcos({ ...b, F: prep.F, cache: prep.cache });   // los surcos se miden en la foto original
  for(const e of ETAPAS) e(ctx, values);
  const tmp = new Uint8ClampedArray(W * H * 4), out = new Uint8ClampedArray(prep.rgba.data);
  fromPlanes(ctx, tmp);
  for(let i = 0; i < W * H; i++){
    if(Math.abs(ctx.R[i] - b.R[i]) + Math.abs(ctx.G[i] - b.G[i]) + Math.abs(ctx.B[i] - b.B[i]) < 2e-4) continue;
    out[i * 4] = tmp[i * 4]; out[i * 4 + 1] = tmp[i * 4 + 1]; out[i * 4 + 2] = tmp[i * 4 + 2];
  }
  return new ImageData(out, W, H);
}

/** Pone el resultado de una cara en `dest` (lienzo a tamaño de la foto); ver pegarRecorte. */
export function componer(dest, prep, out){ pegarRecorte(dest, prep.crop, prep.rgba, out); }
