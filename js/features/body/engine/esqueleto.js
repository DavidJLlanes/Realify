/* ═══════════════════════════════════════════════════════════════
   CUERPO · ESQUELETO (puro, sin DOM)
   De los 17 puntos de pose de una persona saca lo que usan los mandos: hombros, caderas, rodillas, tobillos, codos, muñecas, la cabeza
   (centro y radio) y la unidad `u` = largo del torso (hombros → caderas). Los puntos con poca confianza se descartan; lo que falta
   queda en null y el motor se salta los mandos que lo necesitan (por ejemplo, las piernas si la foto acaba en la cintura).
   Entradas: persona de js/ai/people (pose y cara). Salida: esqueleto, o null si no se ven los hombros. Si faltan las caderas (retrato a medio cuerpo) se
   estiman a 1,4 anchos de hombros: valen los mandos de cabeza, cuello, hombros, torso alto y brazos; los de piernas no hacen nada.
   ═══════════════════════════════════════════════════════════════ */
const MIN = 0.3;
const pt = (p, n) => { const v = p[n]; return v && (v[2] ?? 1) >= MIN ? [v[0], v[1]] : null; };
const mid = (a, b) => a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : a || b || null;
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export function distSeg(p, a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}
export const unit = (a, b) => { const d = dist(a, b) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };

export function esqueleto(persona){
  const p = persona && persona.pose && persona.pose.puntos; if(!p) return null;
  const e = { hombroI: pt(p, "hombroI"), hombroD: pt(p, "hombroD"), caderaI: pt(p, "caderaI"), caderaD: pt(p, "caderaD"),
    codoI: pt(p, "codoI"), codoD: pt(p, "codoD"), munecaI: pt(p, "munecaI"), munecaD: pt(p, "munecaD"),
    rodillaI: pt(p, "rodillaI"), rodillaD: pt(p, "rodillaD"), tobilloI: pt(p, "tobilloI"), tobilloD: pt(p, "tobilloD") };
  e.S = mid(e.hombroI, e.hombroD); e.Hc = mid(e.caderaI, e.caderaD);
  if(!e.S) return null;
  if(!e.Hc && e.hombroI && e.hombroD){                              // retrato que acaba en el pecho: las caderas se estiman con la proporción del cuerpo
    const w = dist(e.hombroI, e.hombroD), l = unit(e.hombroI, e.hombroD), ab = l[0] > 0 || (l[0] === 0 && l[1] >= 0) ? [-l[1], l[0]] : [l[1], -l[0]];
    e.Hc = [e.S[0] + ab[0] * w * 1.4, e.S[1] + ab[1] * w * 1.4]; e.estimado = true;
  }
  if(!e.Hc) return null;
  e.u = dist(e.S, e.Hc); if(e.u < 8) return null;
  e.eje = unit(e.S, e.Hc);                                           // hacia abajo, siguiendo el torso
  e.lado = [-e.eje[1], e.eje[0]];                                    // perpendicular al torso
  const caja = persona.cara && persona.cara.caja;
  const c = caja ? [caja.x + caja.w / 2, caja.y + caja.h / 2] : pt(p, "nariz");
  e.cabeza = c ? { c, r: caja ? Math.max(caja.w, caja.h) * 0.62 : e.u * 0.3 } : null;
  e.cuello = e.cabeza ? lerp(e.S, e.cabeza.c, 0.45) : null;
  e.tobillo = mid(e.tobilloI, e.tobilloD);
  return e;
}
