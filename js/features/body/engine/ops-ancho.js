/* ═══════════════════════════════════════════════════════════════
   CUERPO · MANDOS DE ANCHO Y GROSOR (puro, sin DOM)
   Silueta, torso, caderas, brazos, piernas, cuello, muñecas, rodillas y tobillos: cada mando se convierte en cortes (secciones.js) del
   cuerpo cuyos bordes se acercan o se alejan del eje. Un 1 del mando = un 1 % de ancho. Los mandos que el perfil no tiene llegan como 0.
   Entradas: contexto { e, m, W, H } (esqueleto, máscara de la persona y tamaño de trabajo) y valores sanos. Salida: lista de manos.
   ═══════════════════════════════════════════════════════════════ */
import { seccion, manosGrosor } from "./secciones.js";
import { campana } from "./campana.js";
import { lerp, unit, distSeg } from "./esqueleto.js";

const p = (v, k) => (v[k] || 0) / 100;

export function opsAncho({ e, m, W, H }, v, a){
  const u = e.u, out = [], brazos = [[e.hombroI, e.codoI], [e.codoI, e.munecaI], [e.hombroD, e.codoD], [e.codoD, e.munecaD]].filter(s => s[0] && s[1]);
  const delgado = p(v, "delgado");
  const corte = (c, n, lim, pct, evitar) => { if(Math.abs(pct) < 1e-4) return; const s = seccion(m, W, H, c, n, lim, evitar); if(s) out.push(...manosGrosor(s, pct)); };

  /* Torso y pelvis: de los hombros (t = 0) a las caderas (t = 1) y un poco más allá */
  const evitarBrazo = (x, y) => brazos.some(([s0, s1]) => distSeg([x, y], s0, s1) < 0.13 * u);
  for(let t = 0.08; t <= 1.31; t += 0.1){
    const pct = delgado + p(v, "pecho") * campana(t, 0.25, 0.25) + p(v, "cintura") * campana(t, 0.65, 0.25) + p(v, "abdomen") * campana(t, 0.78, 0.22)
      + p(v, "espalda") * 0.5 * campana(t, 0.2, 0.3) + p(v, "caderas") * campana(t, 1.0, 0.3) + p(v, "gluteos") * 0.6 * campana(t, 1.12, 0.25);
    corte(lerp(e.S, e.Hc, t), e.lado, u * 1.1, pct, evitarBrazo);
  }

  /* Hombros: cada hombro se aleja o se acerca del centro */
  for(const h of [e.hombroI, e.hombroD]){ if(!h) continue; const d = unit(e.S, h); a.add(h === e.hombroI ? "hI" : "hD", h, d[0] * u * 0.5 * p(v, "hombros"), d[1] * u * 0.5 * p(v, "hombros")); }

  /* Brazos: por hueso, evitando el torso */
  const evitarTorso = (x, y) => distSeg([x, y], e.S, e.Hc) < 0.2 * u;
  for(const [s0, s1, k] of [[e.hombroI, e.codoI, 0], [e.codoI, e.munecaI, 1], [e.hombroD, e.codoD, 0], [e.codoD, e.munecaD, 1]]){
    if(!s0 || !s1) continue;
    const d = unit(s0, s1), n = [-d[1], d[0]];
    for(const t of [0.25, 0.5, 0.75]) corte(lerp(s0, s1, t), n, u * 0.3, p(v, "brazoGrosor") + delgado * 0.5, evitarTorso);
    if(k === 1 && p(v, "munecas")) corte(lerp(s0, s1, 0.95), n, u * 0.2, p(v, "munecas"), evitarTorso);
  }

  /* Piernas: muslo (cadera → rodilla) y pantorrilla (rodilla → tobillo), sin tragarse la otra pierna */
  for(const [c0, r, t0, o0, o1] of [[e.caderaI, e.rodillaI, e.tobilloI, e.caderaD, e.rodillaD], [e.caderaD, e.rodillaD, e.tobilloD, e.caderaI, e.rodillaI]]){
    const evitar = o0 && o1 ? (x, y) => distSeg([x, y], o0, o1) < 0.1 * u : null;
    if(c0 && r){ const d = unit(c0, r), n = [-d[1], d[0]]; for(const t of [0.2, 0.4, 0.6, 0.8]) corte(lerp(c0, r, t), n, u * 0.5, p(v, "musloGrosor") + delgado * 0.8, evitar); if(p(v, "rodillas")) corte(r, n, u * 0.4, p(v, "rodillas"), evitar); }
    if(r && t0){ const d = unit(r, t0), n = [-d[1], d[0]]; for(const t of [0.2, 0.4, 0.6, 0.8]) corte(lerp(r, t0, t), n, u * 0.4, p(v, "pantorrilla") * campana(t, 0.3, 0.7) + delgado * 0.8, evitar); if(p(v, "tobillos")) corte(lerp(r, t0, 0.95), n, u * 0.3, p(v, "tobillos"), evitar); }
  }

  /* Cuello */
  if(e.cuello && e.cabeza && p(v, "cuelloGrosor")) for(const t of [0.25, 0.5, 0.75]) corte(lerp(e.S, e.cabeza.c, t * 0.8), e.lado, u * 0.4, p(v, "cuelloGrosor"), null);
  return out;
}
