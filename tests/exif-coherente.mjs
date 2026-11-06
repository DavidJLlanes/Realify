/* ═══════════════════════════════════════════════════════════════
   PRUEBA · EXIF coherente con la simulación (F11.8, sin fecha ni lugar inventados)
   Comprueba en Node (código puro): el ISO sigue al ruido pedido, la focal a la distorsión, la apertura al desenfoque, la velocidad al arrastre (con el triángulo de exposición cerrado) y los tamaños de la cámara.
   Uso: node tests/exif-coherente.mjs
   ═══════════════════════════════════════════════════════════════ */
import { rollExif, BODY_BY_ID, LENS_BY_ID, BODIES, LENSES, ISOS, mountCheck, shSec } from "../js/exif/db.js";
import { shotHints, cameraSizes, sizeNote } from "../js/filters/camera/exifshot.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const st = o => Object.fromEntries(Object.entries(o).map(([k, p]) => [k, { on: true, p }]));
const B = "canon_90d", L = "canon_efs_18_135", body = BODY_BY_ID[B], lens = LENS_BY_ID[L];

const med = (f, n = 40) => { const a = Array.from({ length: n }, f).sort((x, y) => x - y); return a[n >> 1]; };
const isoBajo = med(() => rollExif(B, L, "portrait_day", shotHints(st({ sensor: { shot: 3, read: 2 } }))).iso);
const isoAlto = med(() => rollExif(B, L, "portrait_day", shotHints(st({ sensor: { shot: 90, read: 80 } }))).iso);
ok(isoBajo <= 200 && isoAlto >= 6400 && isoAlto <= body.iso, `ISO sigue al ruido (${isoBajo} → ${isoAlto}, tope ${body.iso})`);
const fAng = med(() => rollExif(B, L, "portrait_day", shotHints(st({ distort: { amt: 90 }, vignette: { amt: 60 } }))).focal), fTele = med(() => rollExif(B, L, "portrait_day", shotHints(st({ distort: { amt: 2 }, vignette: { amt: 2 } }))).focal);
ok(fAng < 40 && fTele > 80 && fAng >= lens.fmin && fTele <= lens.fmax, `la focal sigue a la distorsión (${fAng} mm → ${fTele} mm)`);
const apAb = med(() => rollExif(B, L, "landscape_day", shotHints(st({ dof: { bokeh: 80 } }))).aperture), apCe = med(() => rollExif(B, L, "portrait_day", shotHints(st({ soft: { amt: 90 } }))).aperture);
ok(apAb <= lens.amax && apCe >= 8, `la apertura sigue al desenfoque y a la nitidez (f/${apAb} → f/${apCe})`);
let mal = 0, mas = 0; const sh0 = [], sh1 = [];
for (let i = 0; i < 60; i++) {
  for (const h of [shotHints(st({ motion: { amt: 90 } })), shotHints(st({ sensor: { shot: 50, read: 50 } })), null]) {
    const r = rollExif(B, L, "portrait_day", h), ev = Math.log2(r.aperture * r.aperture / (shSec(r.shutter) * r.iso / 100));
    if (r.iso < 50 || r.iso > body.iso || r.aperture < lens.amin - 0.01) mal++;
    if (h?.lento > 0.3) sh1.push(shSec(r.shutter)); if (h === null) sh0.push(shSec(r.shutter));
    if (!(ev > -6 && ev < 20)) mal++;
  }
}
ok(mal === 0, `valores siempre dentro de lo que el cuerpo y el objetivo dan (${mal} fuera)`);
const m = a => a.sort((x, y) => x - y)[a.length >> 1];
ok(m(sh1) > m(sh0), `con arrastre marcado la velocidad es más lenta (${(1 / m(sh1)).toFixed(0)} frente a ${(1 / m(sh0)).toFixed(0)} de mediana)`);
const tam = cameraSizes(body); ok(tam.length === 3 && tam.every(s => Math.abs(s.w / s.h - 1.5) < 0.01), "los tres tamaños son 3:2");
ok(sizeNote(body, tam[0].w, tam[0].h) === null && sizeNote(body, tam[1].h, tam[1].w) === null, "un tamaño real de la cámara (también vertical) no da aviso");
ok(/no es 3:2/.test(sizeNote(body, 1024, 1024)) && /escribe/.test(sizeNote(body, 4000, 2667)), "1024×1024 avisa de que no es 3:2");
ok(!("date" in shotHints(st({}))), "las pistas no tocan fecha ni lugar");
// Base de datos: ids únicos, sensor y píxeles con la misma proporción, ISO de la serie y al menos un objetivo que monte
ok(new Set(BODIES.map(b => b.id)).size === BODIES.length && new Set(LENSES.map(l => l.id)).size === LENSES.length, "ids únicos");
ok(BODIES.every(b => Math.abs(b.sw / b.sh - b.px[0] / b.px[1]) < 0.03 && ISOS.includes(b.iso) && b.y >= 2006), "cuerpos: proporción de sensor, ISO y año coherentes");
ok(BODIES.every(b => LENSES.some(l => mountCheck(b, l) === "ok")), "todo cuerpo tiene al menos un objetivo de su montura");
ok(BODIES.length >= 60 && ["Canon", "NIKON CORPORATION", "SONY", "FUJIFILM", "Apple", "samsung", "Google"].every(m => BODIES.some(b => (b.make || "Canon") === m)), `base de datos ampliada (${BODIES.length} cuerpos, ${LENSES.length} objetivos, 7 marcas)`);
const moviles = BODIES.filter(b => b.crop);
ok(moviles.length === 7 && moviles.every(b => { const l = LENSES.find(x => x.mount === b.mount); const eq = l.fmin * b.crop; return eq > 22 && eq < 30 && mountCheck(b, l) === "ok"; }), "móviles: objetivo fijo con focal equivalente de 22 a 30 mm");
ok(BODIES.filter(b => !b.crop).every(b => LENSES.filter(l => mountCheck(b, l) === "ok").length >= 2), "cada cámara tiene al menos 2 objetivos de su montura");
ok(mountCheck(BODY_BY_ID.sony_a7m3, LENS_BY_ID.sony_e_35_18) === "crop" && mountCheck(BODY_BY_ID.nikon_d7200, LENS_BY_ID.nikon_z_50_18) === "bad" && mountCheck(BODY_BY_ID.iphone12, LENS_BY_ID.iphone13_wide) === "bad", "monturas: Sony E en A7 recorta, Z no monta en réflex, el móvil sólo su objetivo");
ok(sizeNote(BODY_BY_ID.iphone15pro, 4032, 3024) === null && /4:3/.test(sizeNote(BODY_BY_ID.iphone15pro, 1024, 1536) || ""), "tamaño de móvil: 4032×3024 sin aviso; 2:3 avisa de 4:3");
ok(Array.from({ length: 30 }, () => rollExif("pixel7", "pixel7_main", "landscape_day", shotHints(st({ dof: { bokeh: 90 } })))).every(r => r.aperture === LENS_BY_ID.pixel7_main.amin && r.focal === LENS_BY_ID.pixel7_main.fmin), "móvil: diafragma y focal fijos");
console.log(fallos ? `${fallos} fallos` : "OK · EXIF coherente con la simulación"); process.exit(fallos ? 1 : 0);
