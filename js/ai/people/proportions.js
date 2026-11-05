/* ═══════════════════════════════════════════════════════════════
   PERSONAS · PROPORCIONES (puro, sin DOM)
   Calcula, a partir de los puntos de pose (formato COCO de 17: nariz, ojos, orejas, hombros, codos, muñecas, caderas,
   rodillas, tobillos), las medidas que usan los perfiles y el editor de cuerpo. No estima edad ni sexo: son sólo razones
   geométricas. Si faltan puntos devuelve null en esa medida.
   Entradas: pose = { puntos: { nombre: [x, y, confianza] } }. Salida: { cabezaAltura, hombrosCaderas, piernasTorso, altura, … }.
   ═══════════════════════════════════════════════════════════════ */

export const COCO = ["nariz", "ojoI", "ojoD", "orejaI", "orejaD", "hombroI", "hombroD", "codoI", "codoD",
  "munecaI", "munecaD", "caderaI", "caderaD", "rodillaI", "rodillaD", "tobilloI", "tobilloD"];

const MIN_CONF = 0.3;
const pt = (p, n) => { const v = p[n]; return v && (v[2] ?? 1) >= MIN_CONF ? v : null; };
const mid = (a, b) => a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : a || b || null;
const dist = (a, b) => a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : null;
const ratio = (a, b) => a != null && b ? a / b : null;

export function proportionsFromPose(pose){
  const p = pose && pose.puntos;
  if(!p) return null;
  const hombros = mid(pt(p, "hombroI"), pt(p, "hombroD"));
  const caderas = mid(pt(p, "caderaI"), pt(p, "caderaD"));
  const tobillos = mid(pt(p, "tobilloI"), pt(p, "tobilloD")) || mid(pt(p, "rodillaI"), pt(p, "rodillaD"));
  const orejas = mid(pt(p, "orejaI"), pt(p, "orejaD"));
  const nariz = pt(p, "nariz");
  const cabeza = orejas && nariz ? dist(orejas, nariz) * 2.2 : null;        // alto aproximado de la cabeza (oreja-nariz × 2,2)
  const torso = dist(hombros, caderas);
  const piernas = dist(caderas, tobillos);
  const topeCabeza = hombros && cabeza ? [hombros[0], hombros[1] - cabeza * 1.15] : null;
  const altura = dist(topeCabeza, tobillos);
  return {
    altura,
    cabezaAltura: ratio(cabeza, altura),
    piernasTorso: ratio(piernas, torso),
    hombrosCaderas: ratio(dist(pt(p, "hombroI"), pt(p, "hombroD")), dist(pt(p, "caderaI"), pt(p, "caderaD")))
  };
}
