/* ═══════════════════════════════════════════════════════════════
   PRUEBA · motores de la Fase 4 (Node, sin navegador)
   Escenas sintéticas para: luz en la cara, ojos (luz, color, blanco), labios y cejas, dientes, pelo, pelos sueltos y reflejos en gafas.
   Comprueba que cada motor cambia lo que debe, conserva lo que debe (luminosidad, exposición, pupila, fondo) y no toca lo demás.
   Uso: node tests/ia/retrato/rasgos-motor.mjs
   ═══════════════════════════════════════════════════════════════ */
import { luma } from "../../../js/features/portrait/shared/planes.js";
import { oklab } from "../../../js/features/ai-kit/oklab.js";
import { stage as relight } from "../../../js/features/portrait/face-relight/engine.js";
import { stage as ojos } from "../../../js/features/portrait/eyes/engine.js";
import { stage as labios } from "../../../js/features/portrait/lips-brows/engine.js";
import { stage as dientes } from "../../../js/features/portrait/teeth/engine.js";
import { stage as pelo } from "../../../js/features/portrait/hair/engine.js";
import { stage as sueltos } from "../../../js/features/portrait/flyaway-hair/engine.js";
import { stage as gafas } from "../../../js/features/portrait/glasses-glare/engine.js";

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const W = 300, H = 300, n = W * H, F = 200;
const cero = () => new Float32Array(n);
const elipse = (cx, cy, rx, ry) => { const m = cero(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; m[y * W + x] = d <= 1 ? 1 : 0; } return m; };
const rect = (x0, y0, x1, y1) => { const m = cero(); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = 1; return m; };
const lienzo = (r, g, b) => { const p = { W, H, R: new Float32Array(n).fill(r), G: new Float32Array(n).fill(g), B: new Float32Array(n).fill(b), Y: cero() }; luma(p); return p; };
const mk = (p, zonas = {}, mascaras = {}) => ({ ...p, F, cache: {}, profundidad: null, mascaras, zonas: { ovalo: elipse(150, 150, 70, 90), cuello: cero(), iris: cero(), esclera: cero(), labios: cero(), boca: cero(), cejas: cero(), ...zonas } });
const media = (a, m) => { let s = 0, c = 0; for (let i = 0; i < n; i++) if (m[i] > 0.5) { s += a[i]; c++; } return s / c; };
const lab = (p, m) => { const o = new Float32Array(3); return oklab(media(p.R, m), media(p.G, m), media(p.B, m), o); };

/* 1 · Luz: la izquierda de la foto recibe más luz; la exposición de la cara se conserva y el color no cambia */
{
  const c = mk(lienzo(0.5, 0.38, 0.3)), izq = rect(80, 100, 130, 200), der = rect(170, 100, 220, 200), cara = c.zonas.ovalo;
  const m0 = media(c.Y, cara), r0 = media(c.R, cara) / media(c.G, cara);
  relight(c, { luz_int: 100, luz_azim: -70, luz_alt: 20, luz_suave: 30 });
  ok(media(c.Y, izq) > media(c.Y, der) * 1.12, `luz: la izquierda debería ser más clara que la derecha (${media(c.Y, izq).toFixed(3)} vs ${media(c.Y, der).toFixed(3)})`);
  ok(Math.abs(media(c.Y, cara) / m0 - 1) < 0.08, "luz: cambió demasiado la exposición media de la cara");
  ok(Math.abs(media(c.R, cara) / media(c.G, cara) - r0) < 0.01, "luz: cambió el color de la piel");
  const d = mk(lienzo(0.5, 0.38, 0.3)); relight(d, { luz_int: 100, luz_azim: 70, luz_alt: 20, luz_suave: 30 });
  ok(media(d.Y, der) > media(d.Y, izq) * 1.12, "luz: con acimut positivo la derecha debería ser más clara");
  const e = mk(lienzo(0.5, 0.38, 0.3)), y0 = Float32Array.from(e.Y); relight(e, { luz_int: 0 }); ok(e.Y.every((v, i) => v === y0[i]), "luz: con intensidad 0 cambió algo");
}

/* 2 · Ojos: iris marrón → azul sin cambiar la luminosidad; la pupila no se tiñe; el blanco gana luz y pierde amarillo */
{
  const base = lienzo(0.9, 0.85, 0.7), iris = elipse(150, 150, 20, 20), pupila = elipse(150, 150, 7, 7), esclera = rect(100, 140, 125, 160);
  for (let i = 0; i < n; i++) if (iris[i]) { base.R[i] = 0.12; base.G[i] = 0.07; base.B[i] = 0.04; } for (let i = 0; i < n; i++) if (pupila[i]) { base.R[i] = base.G[i] = base.B[i] = 0.004; }
  luma(base);
  const anillo = cero(); for (let i = 0; i < n; i++) anillo[i] = iris[i] && !elipse(150, 150, 10, 10)[i] ? 1 : 0;
  const c = mk(base, { iris, esclera });
  const L0 = lab(base, anillo)[0], p0 = media(base.Y, pupila), r0 = lab(base, esclera);
  ojos(c, { ojos_color: "azul", ojos_color_int: 100, ojos_luz: 0, ojos_blanco: 0 });
  const t = lab(c, anillo);
  ok(Math.hypot(t[1], t[2]) > 0.04 && Math.atan2(t[2], t[1]) * 180 / Math.PI < -60, `ojos: el iris no se vuelve azul (a=${t[1].toFixed(3)} b=${t[2].toFixed(3)})`);
  ok(Math.abs(t[0] - L0) < 0.05, "ojos: el cambio de color alteró la luminosidad del iris");
  ok(media(c.Y, pupila) < p0 * 2 + 0.01, "ojos: la pupila se aclaró");
  const d = mk(base, { iris, esclera }); ojos(d, { ojos_blanco: 100, ojos_color: "natural" });
  const r1 = lab(d, esclera); ok(r1[0] > r0[0] && Math.hypot(r1[1], r1[2]) < Math.hypot(r0[1], r0[2]) * 0.8, "ojos: el blanco no gana luz ni pierde color");
  const e = mk(base, { iris, esclera }), y0 = Float32Array.from(e.Y); ojos(e, { ojos_color: "natural", ojos_luz: 0, ojos_blanco: 0 }); ok(e.Y.every((v, i) => v === y0[i]), "ojos: sin cambios pedidos cambió algo");
}

/* 3 · Labios y cejas: más croma en los labios sin tocar la piel; la ceja con hueco se rellena */
{
  const base = lienzo(0.55, 0.4, 0.34), lab_ = rect(120, 200, 180, 220), ceja = rect(100, 80, 200, 92);
  for (let i = 0; i < n; i++) { if (lab_[i]) { base.R[i] = 0.5; base.G[i] = 0.2; base.B[i] = 0.2; } if (ceja[i]) { base.R[i] = 0.14; base.G[i] = 0.1; base.B[i] = 0.08; } }
  for (let y = 80; y < 92; y++) for (let x = 140; x < 150; x++) { base.R[y * W + x] = 0.2; base.G[y * W + x] = 0.14; base.B[y * W + x] = 0.11; }   // hueco
  luma(base);
  const c = mk(base, { labios: lab_, cejas: ceja }), piel = rect(20, 20, 60, 60), L0 = lab(base, lab_), hueco = rect(141, 82, 149, 90), y0 = media(base.Y, hueco);
  labios(c, { labios_int: 100, labios_def: 0, cejas_huecos: 100 });
  ok(Math.hypot(...lab(c, lab_).slice(1)) > Math.hypot(L0[1], L0[2]) * 1.15, "labios: no aumenta el croma");
  ok(Math.abs(media(c.Y, piel) - media(base.Y, piel)) < 1e-6, "labios: tocó la piel");
  ok(media(c.Y, hueco) < y0 * 0.8, `cejas: el hueco no se rellena (${y0.toFixed(4)} → ${media(c.Y, hueco).toFixed(4)})`);
}

/* 4 · Dientes: los dientes amarillos pierden amarillo; las encías rojas no cambian */
{
  const base = lienzo(0.4, 0.2, 0.2), boca = rect(100, 150, 200, 190), dien = rect(110, 155, 190, 175), encia = rect(110, 180, 190, 188);
  for (let i = 0; i < n; i++) if (dien[i]) { base.R[i] = 0.85; base.G[i] = 0.75; base.B[i] = 0.5; } luma(base);
  const c = mk(base, { boca }), b0 = lab(base, dien)[2], e0 = media(base.R, encia);
  dientes(c, { dientes_int: 100 });
  ok(lab(c, dien)[2] < b0 * 0.6, "dientes: no quita el amarillo");
  ok(lab(c, dien)[0] >= lab(base, dien)[0], "dientes: oscureció los dientes");
  ok(Math.abs(media(c.R, encia) - e0) < 1e-4, "dientes: tocó las encías");
}

/* 5 · Pelo: gira el color sin cambiar la luminosidad; fuera del pelo no cambia */
{
  const base = lienzo(0.4, 0.4, 0.4), pl = elipse(150, 80, 60, 40);
  for (let i = 0; i < n; i++) if (pl[i]) { base.R[i] = 0.28; base.G[i] = 0.17; base.B[i] = 0.08; } luma(base);
  const c = mk(base, {}, { pelo: pl }), a0 = lab(base, pl), fuera = rect(10, 200, 60, 280), f0 = media(base.R, fuera);
  pelo(c, { pelo_tono: 120, pelo_sat: 0 });
  const a1 = lab(c, pl), h0 = Math.atan2(a0[2], a0[1]) * 180 / Math.PI, h1 = Math.atan2(a1[2], a1[1]) * 180 / Math.PI;
  const dh = Math.abs(((h1 - h0 + 540) % 360) - 180);
  ok(Math.abs(dh - 60) < 15 || Math.abs(((h1 - h0 + 360) % 360) - 120) < 15, `pelo: el tono no gira unos 120° (${((h1 - h0 + 360) % 360).toFixed(0)}°)`);
  ok(Math.abs(a1[0] - a0[0]) < 0.03, "pelo: el cambio de tono alteró la luminosidad");
  ok(Math.abs(media(c.R, fuera) - f0) < 1e-6, "pelo: tocó lo que no es pelo");
  const d = mk(base, {}, { pelo: pl }); pelo(d, { pelo_brillo: 100 }); ok(lab(d, pl)[0] >= a0[0], "pelo: el brillo oscureció el pelo");
}

/* 6 · Pelos sueltos: una línea fina oscura sobre el fondo desaparece; la persona no cambia */
{
  const base = lienzo(0.6, 0.62, 0.66), persona = elipse(150, 170, 70, 110), linea = cero();
  for (let y = 100; y < 220; y++) { const x = Math.round(226 + (y - 100) * 0.05); for (let d = -1; d <= 0; d++) linea[y * W + x + d] = 1; }   // a ~15 px del borde de la persona
  for (let i = 0; i < n; i++) { if (persona[i]) { base.R[i] = 0.3; base.G[i] = 0.22; base.B[i] = 0.18; } if (linea[i]) { base.R[i] = 0.12; base.G[i] = 0.1; base.B[i] = 0.1; } } luma(base);
  const c = mk(base, {}, { persona }), y0 = media(base.Y, linea), fondo = media(base.Y, rect(20, 20, 60, 60)), per = rect(130, 160, 170, 200), p0 = media(base.Y, per);
  sueltos(c, { pelos_int: 100 });
  ok(Math.abs(media(c.Y, linea) - fondo) < Math.abs(y0 - fondo) * 0.4, `pelos sueltos: la línea sigue ahí (${y0.toFixed(3)} → ${media(c.Y, linea).toFixed(3)}, fondo ${fondo.toFixed(3)})`);
  ok(Math.abs(media(c.Y, per) - p0) < 1e-6, "pelos sueltos: tocó a la persona");
}

/* 7 · Gafas: un brillo en el cristal se apaga; el resto del cristal no cambia mucho */
{
  const base = lienzo(0.5, 0.5, 0.5), lente = rect(100, 100, 200, 160), brillo = elipse(130, 130, 7, 7);
  for (let i = 0; i < n; i++) { if (lente[i]) { base.R[i] = base.G[i] = base.B[i] = 0.15; } if (brillo[i]) { base.R[i] = base.G[i] = base.B[i] = 0.9; } } luma(base);
  const c = mk(base, {}, { gafas: lente }), b0 = media(base.Y, elipse(130, 130, 4, 4)), cristal = rect(170, 140, 190, 155), g0 = media(base.Y, cristal);
  gafas(c, { gafas_int: 100 });
  ok(media(c.Y, elipse(130, 130, 4, 4)) < b0 * 0.45, "gafas: el brillo no se atenúa");
  ok(Math.abs(media(c.Y, cristal) - g0) < 0.02, "gafas: cambió el cristal");
}

console.log(fallos ? "rasgos (motor): FALLO" : "rasgos (motor): OK");
process.exit(fallos ? 1 : 0);
