/* ═══════════════════════════════════════════════════════════════
   RETRATO · RASGOS DE LA CARA (puro, sin DOM)
   Máscaras suaves (0-1) a la resolución del recorte de los rasgos que retocan Ojos, Labios y cejas y Dientes: ojo abierto, iris (un
   disco por ojo, recortado por los párpados), esclera (el blanco), labios (contorno menos interior), interior de la boca y cejas.
   Entradas: puntos de la foto (478, los 10 últimos son los iris) y el recorte. Salida: { ojos, iris, esclera, labios, boca, cejas, iris_c }.
   ═══════════════════════════════════════════════════════════════ */
import { IDX } from "./landmarks.js";
import { frame, toCrop } from "./geometry.js";
import { fillPolygon, subtract, union, multiply } from "./raster.js";

export const BOCA_INTERIOR = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
const disco = (c, r, n = 24) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos(i / n * 6.2832), c[1] + r * Math.sin(i / n * 6.2832)]);

export function buildRasgos(pts, crop){
  const { W, H } = crop, Fc = frame(pts).F * crop.k, soft = Math.max(0.7, Fc * 0.006);
  const C = ids => ids.map(i => toCrop(pts[i], crop));
  const ojoD = fillPolygon(W, H, C(IDX.ojoD), soft), ojoI = fillPolygon(W, H, C(IDX.ojoI), soft), ojos = union([ojoD, ojoI]);
  const irisDe = (centro, borde) => {
    const c = toCrop(pts[centro], crop), r = borde.reduce((s, i) => s + Math.hypot(toCrop(pts[i], crop)[0] - c[0], toCrop(pts[i], crop)[1] - c[1]), 0) / borde.length;
    return { c, r };
  };
  const a = irisDe(468, [469, 470, 471, 472]), b = irisDe(473, [474, 475, 476, 477]);
  const iris = multiply(union([fillPolygon(W, H, disco(a.c, a.r), soft), fillPolygon(W, H, disco(b.c, b.r), soft)]), ojos);
  const esclera = subtract(ojos, union([fillPolygon(W, H, disco(a.c, a.r * 1.08), soft), fillPolygon(W, H, disco(b.c, b.r * 1.08), soft)]));
  const boca = fillPolygon(W, H, C(BOCA_INTERIOR), soft);
  const labios = subtract(fillPolygon(W, H, C(IDX.labios), soft), boca);
  const cejas = union([fillPolygon(W, H, C(IDX.ceja_D), soft), fillPolygon(W, H, C(IDX.ceja_I), soft)]);
  return { ojos, iris, esclera, labios, boca, cejas, irisR: Math.min(a.r, b.r) };
}
