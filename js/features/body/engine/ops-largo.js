/* ═══════════════════════════════════════════════════════════════
   CUERPO · MANDOS DE LARGO, CABEZA Y POSTURA (puro, sin DOM)
   Altura, proporción piernas/torso, largo de brazos, piernas y cuello, tamaño de cabeza, manos, pies y postura. Cada mando mueve
   articulaciones (se suman en el acumulador, acum.js) y el campo MLS reparte el resto. Un 1 del mando = un 1 % de la longitud afectada.
   Entradas: esqueleto, valores sanos y acumulador. Salida: nada (rellena el acumulador).
   ═══════════════════════════════════════════════════════════════ */
import { dist, unit } from "./esqueleto.js";

const p = (v, k) => (v[k] || 0) / 100;
const por = (d, s) => [d[0] * s, d[1] * s];
const sum = (...vs) => vs.reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);

export function opsLargo(e, v, a){
  const u = e.u, arriba = por(e.eje, -1), abajo = e.eje, tobillo = e.tobillo, pivote = tobillo || e.Hc;
  const piernas = [["I", e.caderaI, e.rodillaI, e.tobilloI], ["D", e.caderaD, e.rodillaD, e.tobilloD]];

  /* Altura: estiramiento vertical alrededor del pivote (tobillos); lo de arriba sube más */
  const s = p(v, "altura") * 0.5, alt = pt => por(arriba, Math.max(0, (pt[0] - pivote[0]) * arriba[0] + (pt[1] - pivote[1]) * arriba[1]) * s);
  if(s) for(const [k, q] of Object.entries({ S: e.S, hI: e.hombroI, hD: e.hombroD, cI: e.codoI, cD: e.codoD, mI: e.munecaI, mD: e.munecaD, rI: e.rodillaI, rD: e.rodillaD, Hc: e.Hc, kI: e.caderaI, kD: e.caderaD })) if(q) a.mover(k, q, alt(q));
  /* Desplazamiento de la cabeza = suma de lo que le hacen varios mandos */
  const cabeza = sum(por(arriba, u * p(v, "cuelloLargo") * 0.5), por(abajo, u * p(v, "cuelloAdelante") * 0.3), por(arriba, u * p(v, "erguir") * 0.4), e.cabeza && s ? alt(e.cabeza.c) : [0, 0]);

  /* Hombros y torso: postura (erguir sube, «caídos» baja) */
  const hombros = sum(por(arriba, u * p(v, "erguir") * 0.3), por(abajo, u * p(v, "hombrosPostura") * 0.5));
  a.mover("S", e.S, hombros); a.mover("hI", e.hombroI, hombros); a.mover("hD", e.hombroD, hombros);
  a.mover("cI", e.codoI, por(hombros, 0.5)); a.mover("cD", e.codoD, por(hombros, 0.5));

  /* Proporción piernas/torso: la pelvis sube y las piernas se alargan */
  const pt = por(arriba, u * p(v, "piernasTorso") * 0.5);
  for(const [k, q] of Object.entries({ Hc: e.Hc, kI: e.caderaI, kD: e.caderaD })) a.mover(k, q, pt);
  a.mover("rI", e.rodillaI, por(pt, 0.5)); a.mover("rD", e.rodillaD, por(pt, 0.5));

  /* Largo de las piernas (los tobillos y los pies bajan) */
  for(const [l, c, r, t] of piernas){
    if(!c || !r || !t) continue;
    const L = dist(c, r) + dist(r, t), d = por(abajo, L * p(v, "piernaLargo"));
    a.mover("t" + l, t, d); a.mover("r" + l, r, por(d, 0.5));
    const pie = [t[0] + (t[0] - r[0]) * 0.18, t[1] + (t[1] - r[1]) * 0.18];
    a.anillo("pie" + l, pie, u * 0.1, p(v, "pies"), d, 6);
  }

  /* Largo de los brazos y manos */
  for(const [l, h, c, m] of [["I", e.hombroI, e.codoI, e.munecaI], ["D", e.hombroD, e.codoD, e.munecaD]]){
    if(!h || !m) continue;
    const d = por(unit(h, m), dist(h, m) * p(v, "brazoLargo"));
    a.mover("m" + l, m, d); if(c) a.mover("c" + l, c, por(d, 0.5));
    const mano = [m[0] + (m[0] - (c || h)[0]) * 0.22, m[1] + (m[1] - (c || h)[1]) * 0.22];
    a.anillo("mano" + l, mano, u * 0.09, p(v, "manos"), d, 6);
  }

  /* Cabeza: desplazamiento y tamaño (anillo con el centro y 8 puntos) */
  if(e.cabeza && (Math.abs(cabeza[0]) + Math.abs(cabeza[1]) > 1e-6 || p(v, "cabeza"))) a.anillo("cab", e.cabeza.c, e.cabeza.r, p(v, "cabeza"), cabeza, 8);
}
