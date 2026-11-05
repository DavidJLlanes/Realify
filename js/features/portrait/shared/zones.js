/* ═══════════════════════════════════════════════════════════════
   RETRATO · ZONAS DE LA PIEL (puro, sin DOM)
   A partir de los 478 puntos de la cara dibuja máscaras suaves (0-1) a la resolución del recorte: frente, entrecejo, ojos (patas de
   gallo), ojeras, mejilla de referencia, surcos nasogenianos, comisuras y cuello, y la zona que NUNCA se toca (ojos, cejas, labios).
   Entradas: puntos de la foto y el recorte (geometry.cropFor). Salida: { ovalo, frente, entrecejo, ojos, ojeras, mejilla, surcos,
   comisuras, cuello, excluir } con Float32Array(W·H) cada una. Las manos no están aún (ver README).
   ═══════════════════════════════════════════════════════════════ */
import { IDX } from "./landmarks.js";
import { frame, toCrop } from "./geometry.js";
import { fillPolygon, strokePath, subtract, union } from "./raster.js";
import { gauss } from "./blur.js";

const cadena = (P, ids, crop) => ids.map(i => toCrop(P[i], crop));
const mover = (pts, v) => pts.map(p => [p[0] + v[0], p[1] + v[1]]);
function elipse(cx, cy, rx, ry, n = 20){ return Array.from({ length: n }, (_, i) => [cx + rx * Math.cos(i / n * 6.2832), cy + ry * Math.sin(i / n * 6.2832)]); }

/** Banda bajo el párpado inferior: de la cadena del párpado hasta `hasta` anchos de cara más abajo (empezando en `desde`). */
function banda(lid, down, desde, hasta){
  const a = mover(lid, [down[0] * desde, down[1] * desde]), b = mover(lid, [down[0] * hasta, down[1] * hasta]).reverse();
  return [...a, ...b];
}

export function buildZones(pts, crop){
  const { W, H } = crop, { F, up, P } = frame(pts), Fc = F * crop.k;
  const down = [-up[0] * Fc, -up[1] * Fc];            // «un ancho de cara hacia abajo», en píxeles del recorte
  const soft = Math.max(1, Fc * 0.02);
  const C = ids => cadena(P, ids, crop);
  const ovalo = fillPolygon(W, H, C(IDX.ovalo), soft);

  // zona que no se toca: ojos, cejas y labios con un margen
  const prohibido = union([IDX.ojoD, IDX.ojoI, IDX.ceja_D, IDX.ceja_I, IDX.labios].map(ids => fillPolygon(W, H, C(ids), Fc * 0.03)));
  const excluir = gauss(prohibido, W, H, Fc * 0.015);

  // frente: el óvalo por encima de las cejas
  const cejas = [...C(IDX.ceja_D), ...C(IDX.ceja_I)].sort((a, b) => a[0] - b[0]);
  const topCeja = x => { let best = Infinity; for(const p of cejas) if(Math.abs(p[0] - x) < Fc * 0.06) best = Math.min(best, p[1]); return Number.isFinite(best) ? best : Math.min(...cejas.map(p => p[1])); };
  let frente = new Float32Array(W * H);
  for(let x = 0; x < W; x++){ const lim = topCeja(x) - Fc * 0.03; for(let y = 0; y < Math.min(H, lim); y++) frente[y * W + x] = ovalo[y * W + x]; }
  frente = gauss(frente, W, H, soft * 1.5);

  const p9 = toCrop(P[IDX.nariz.entrecejo], crop);
  const entrecejo = fillPolygon(W, H, elipse(p9[0], p9[1], Fc * 0.1, Fc * 0.13), soft);

  // ojos (patas de gallo) y ojeras
  const lidD = C([33, 7, 163, 144, 145, 153, 154, 155, 133]), lidI = C([362, 382, 381, 380, 374, 373, 390, 249, 263]);
  const out = (corner, dir) => elipse(corner[0] + dir * Fc * 0.07, corner[1] + down[1] * 0.04, Fc * 0.09, Fc * 0.11);
  const ojos = union([fillPolygon(W, H, out(lidD[0], -1), soft), fillPolygon(W, H, out(lidI[lidI.length - 1], 1), soft)]);
  const ojeras = union([fillPolygon(W, H, banda(lidD, down, 0.015, 0.1), soft), fillPolygon(W, H, banda(lidI, down, 0.015, 0.1), soft)]);
  const mejilla = union([fillPolygon(W, H, banda(lidD, down, 0.13, 0.22), soft * 2), fillPolygon(W, H, banda(lidI, down, 0.13, 0.22), soft * 2)]);

  // surcos nasogenianos (ala de la nariz → comisura, un poco más allá) y comisuras (hacia abajo)
  const pt = i => toCrop(P[i], crop);
  const sur = (ala, com) => { const a = pt(ala), c = pt(com); return strokePath(W, H, [a, c, [c[0] + (c[0] - a[0]) * 0.15, c[1] + (c[1] - a[1]) * 0.15]], Fc * 0.05, soft); };
  const surcos = union([sur(IDX.nariz.alaD, IDX.boca.comisuraD), sur(IDX.nariz.alaI, IDX.boca.comisuraI)]);
  const marion = c => { const a = pt(c); return strokePath(W, H, [a, [a[0] + down[0] * 0.08, a[1] + down[1] * 0.08]], Fc * 0.045, soft); };
  const comisuras = union([marion(IDX.boca.comisuraD), marion(IDX.boca.comisuraI)]);

  // cuello: del borde de la mandíbula hacia abajo, un poco más estrecho
  const mand = C([172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397]);
  const mid = [(mand[0][0] + mand[mand.length - 1][0]) / 2, (mand[0][1] + mand[mand.length - 1][1]) / 2];
  const baja = mover(mand, [down[0] * 0.9, down[1] * 0.9]).map(p => [mid[0] + (p[0] - mid[0]) * 0.85, p[1]]);
  const cuello = subtract(fillPolygon(W, H, [...mand, ...baja.reverse()], soft * 1.5), ovalo);

  return { ovalo, frente, entrecejo, ojos, ojeras, mejilla, surcos, comisuras, cuello, excluir };
}
