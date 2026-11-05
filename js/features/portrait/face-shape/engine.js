/* ═══════════════════════════════════════════════════════════════
   FORMA DE LA CARA · MOTOR (puro, sin DOM)
   Mandíbula, mentón, anchura de la cara, nariz, ojos y labios por deformación (js/features/warp/): los 478 puntos de la malla dan los puntos
   que se mueven (siempre pocos píxeles: un 1 del mando = un 1 % del ancho de la cara F, con un tope) y el resto de la malla actúa de ancla, así
   que la cara no se desfigura. Se aplica al final de la cadena (los demás motores miran la cara original). Si el campo se plegaría, se reduce.
   Entradas: ctx { W, H, R, G, B, Y, F, puntos (malla en píxeles del recorte) } y valores. Salida: modifica ctx (planos nuevos).
   ═══════════════════════════════════════════════════════════════ */
import { campoMLS, limitar, deformarPlanos, Acum } from "../../warp/index.js";
import { IDX } from "../shared/landmarks.js";

const MAND = { 58: 1, 132: 1, 172: 0.8, 136: 0.7, 150: 0.45, 149: 0.3, 288: 1, 361: 1, 397: 0.8, 365: 0.7, 379: 0.45, 378: 0.3 };
const MENT = [152, 148, 176, 377, 400, 175, 199, 428];
const CARA = [234, 127, 162, 93, 454, 356, 389, 323, 132, 58, 361, 288];
const NARIZ = [129, 358, 98, 327, 49, 279, 48, 278];
const UP = [0, 37, 39, 267, 269, 40, 270], LOW = [17, 84, 181, 314, 405, 91, 321];

export const hayForma = v => ["forma_cara", "forma_mandibula", "forma_menton", "forma_nariz", "forma_ojos", "forma_labios"].some(k => v[k]);
const media = (P, ids) => { let x = 0, y = 0; for(const i of ids){ x += P[i][0]; y += P[i][1]; } return [x / ids.length, y / ids.length]; };

export function manosForma(P, F, v){
  const a = new Acum(), p = k => (v[k] || 0) / 100, c = media(P, IDX.ovalo);
  const eje = [P[152][0] - P[10][0], P[152][1] - P[10][1]], L = Math.hypot(...eje) || 1, ab = [eje[0] / L, eje[1] / L], lat = [-ab[1], ab[0]];
  /* s > 0 acerca el punto al eje de la cara (estrecha); s < 0 lo aleja (ensancha) */
  const lateral = (i, s) => { const d = (P[i][0] - c[0]) * lat[0] + (P[i][1] - c[1]) * lat[1], lado = d >= 0 ? 1 : -1; a.add("p" + i, P[i], -lado * s * lat[0], -lado * s * lat[1]); };
  for(const [i, w] of Object.entries(MAND)) if(p("forma_mandibula")) lateral(+i, -p("forma_mandibula") * F * 0.14 * w);
  for(const i of CARA) if(p("forma_cara")) lateral(i, -p("forma_cara") * F * 0.1);
  for(const i of MENT) if(p("forma_menton")) a.add("p" + i, P[i], ab[0] * p("forma_menton") * F * 0.12, ab[1] * p("forma_menton") * F * 0.12);
  const cn = P[1];
  for(const i of NARIZ) if(p("forma_nariz")){ const d = (P[i][0] - cn[0]) * lat[0] + (P[i][1] - cn[1]) * lat[1], s = d >= 0 ? 1 : -1; a.add("p" + i, P[i], lat[0] * s * p("forma_nariz") * F * 0.06, lat[1] * s * p("forma_nariz") * F * 0.06); }
  if(p("forma_ojos")) for(const ids of [IDX.ojoD, IDX.ojoI]){ const e = media(P, ids), r = Math.hypot(P[ids[0]][0] - P[ids[8]][0], P[ids[0]][1] - P[ids[8]][1]) * 0.6; a.anillo("ojo" + ids[0], e, r, p("forma_ojos") * 0.5, [0, 0], 8); }
  if(p("forma_labios")){
    const h = Math.hypot(P[0][0] - P[17][0], P[0][1] - P[17][1]) + F * 0.04;
    for(const i of UP) a.add("p" + i, P[i], -ab[0] * h * p("forma_labios") * 0.35, -ab[1] * h * p("forma_labios") * 0.35);
    for(const i of LOW) a.add("p" + i, P[i], ab[0] * h * p("forma_labios") * 0.35, ab[1] * h * p("forma_labios") * 0.35);
  }
  /* Anclas: el resto del contorno, los ojos, la boca y la nariz se quedan donde están, para que el cambio no se escape */
  const fijos = [...IDX.ovalo, 1, 6, 9, 61, 291, ...IDX.ceja_D.slice(0, 3), ...IDX.ceja_I.slice(0, 3)];
  const manos = a.lista(); const hay = new Set(a.m.keys());
  for(const i of fijos) if(!hay.has("p" + i)) manos.push({ x: P[i][0], y: P[i][1], tx: P[i][0], ty: P[i][1] });
  return manos;
}

export function stage(ctx, v){
  if(!hayForma(v)) return;
  const { W, H, F, puntos } = ctx; if(!puntos) return;
  const manos = manosForma(puntos, F, v);
  if(!manos.some(m => Math.hypot(m.tx - m.x, m.ty - m.y) > 1e-6)) return;
  const campo = limitar(campoMLS(W, H, manos, { paso: 4, alpha: 1.5, modo: "similitud" })).campo;
  const [R, G, B] = deformarPlanos([ctx.R, ctx.G, ctx.B], W, H, campo);
  ctx.R = R; ctx.G = G; ctx.B = B;
  for(let i = 0; i < R.length; i++) ctx.Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
}
