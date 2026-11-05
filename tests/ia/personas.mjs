/* ═══════════════════════════════════════════════════════════════
   PRUEBA · análisis de personas (Node puro, sin navegador ni modelos)
   Perfiles y seguridad infantil (F6.9 en pequeño), proporciones, ensamblado de personas, caché por revisión, proveedores
   enchufables y cancelación. Los modelos reales se miden aparte (F2.1/F2.8).
   Uso: node tests/ia/personas.mjs
   ═══════════════════════════════════════════════════════════════ */
import { PROFILE_IDS, BODY_PARAMS, controlsFor, clampTo, sanitize, presetsFor, suggestProfile } from "../../js/ai/people/profiles.js";
import { proportionsFromPose } from "../../js/ai/people/proportions.js";
import { buildPersons } from "../../js/ai/people/assemble.js";
import { createPeopleCache } from "../../js/ai/people/cache.js";
import { analyze, registerProvider } from "../../js/ai/people/analyze.js";

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

/* ── perfiles ── */
const PROHIBIDOS = ["pecho", "cintura", "abdomen", "espalda", "caderas", "gluteos", "musculo", "tono", "pielSuavizar", "bronceado"];
for (const inf of ["nino", "nina"]) {
  const keys = controlsFor(inf).map(c => c.key);
  for (const k of PROHIBIDOS) {
    ok(!keys.includes(k), `${inf}: existe el mando «${k}»`);
    ok(clampTo(inf, k, 5) === null, `${inf}: «${k}» acepta un valor`);
    ok(!(k in sanitize(inf, { [k]: 20 })), `${inf}: sanitize deja pasar «${k}»`);
  }
  for (const c of controlsFor(inf)) {
    const adulto = BODY_PARAMS.find(p => p.key === c.key);
    ok(c.max <= adulto.max && c.min >= adulto.min, `${inf}: el rango de «${c.key}» no es reducido o igual`);
  }
  ok(controlsFor(inf).some(c => c.key === "altura" && c.max < 10), `${inf}: la altura no tiene rango reducido`);
  for (const p of presetsFor(inf)) for (const k of Object.keys(p.values)) ok(!PROHIBIDOS.includes(k), `${inf}: el preset «${p.id}» usa «${k}»`);
}
for (const ad of ["hombre", "mujer"]) {
  ok(controlsFor(ad).length === BODY_PARAMS.length, `${ad}: faltan mandos`);
  ok(clampTo(ad, "pecho", 99) === 20 && clampTo(ad, "pecho", -99) === -20, `${ad}: recorte de pecho`);
  ok(presetsFor(ad).length === 4 && presetsFor("nino").length === 2, "número de presets");
}
ok(PROFILE_IDS.length === 4, "cuatro perfiles");
ok(clampTo("nino", "altura", Infinity) === null && clampTo("hombre", "altura", NaN) === null, "valores no finitos");
ok(BODY_PARAMS[0].max === 20 && controlsFor("nino")[0].max === 3, "controlsFor no modifica el original");

/* ── proporciones y perfil de partida ── */
const pose = (cab, torso, piernas) => ({ puntos: {   // figura vertical simple; cab = alto de cabeza
  nariz: [100, 0 + cab * 0.5, 1], orejaI: [100 - cab * 0.22, cab * 0.4, 1], orejaD: [100 + cab * 0.22, cab * 0.4, 1],
  hombroI: [80, cab * 1.3, 1], hombroD: [120, cab * 1.3, 1], caderaI: [85, cab * 1.3 + torso, 1], caderaD: [115, cab * 1.3 + torso, 1],
  tobilloI: [85, cab * 1.3 + torso + piernas, 1], tobilloD: [115, cab * 1.3 + torso + piernas, 1] } });
const adulto = proportionsFromPose(pose(30, 100, 120)), pequeno = proportionsFromPose(pose(30, 50, 55));
ok(adulto && pequeno && adulto.cabezaAltura < pequeno.cabezaAltura, "la cabeza pesa más en la figura de proporciones infantiles");
ok(suggestProfile(adulto, "mujer") === "mujer" && suggestProfile(adulto) === null, "adulto: respeta la elección");
ok(suggestProfile({ cabezaAltura: 0.25 }, "mujer") === "nina" && suggestProfile({ cabezaAltura: 0.25 }, "hombre") === "nino" && suggestProfile({ cabezaAltura: 0.25 }) === "nino", "proporciones infantiles → perfil infantil");
ok(proportionsFromPose(null) === null && proportionsFromPose({ puntos: {} }).altura === null, "pose vacía");

/* ── ensamblado ── */
const caras = [{ x: 90, y: 5, w: 40, h: 40, score: 0.9, eyes: [[1, 1], [2, 2]], nose: [3, 3], mouth: [[4, 4], [5, 5]] },
  { x: 400, y: 20, w: 30, h: 30, score: 0.8, eyes: [], nose: [0, 0], mouth: [] }];
const p0 = pose(40, 100, 120); p0.puntos.nariz = [110, 25, 1];
const ps = buildPersons(caras, { poses: [p0], manos: [{ lado: "D", puntos: [[420, 200]], x: 410, y: 190, w: 20, h: 20 }],
  landmarks: [{ cara: 1, puntos: [[1, 2]] }], partes: [{ persona: 0, w: 4, h: 4, mascaras: { pelo: new Uint8Array(16) } }] }, 800, 600);
ok(ps.length === 2 && ps[0].pose && !ps[1].pose, "la pose va a la persona de la cara que contiene la nariz");
ok(ps[0].proporciones && ps[1].proporciones === null, "proporciones sólo con pose");
ok(ps[1].manos.length === 1 && ps[0].manos.length === 0, "la mano va a la persona más cercana");
ok(ps[1].cara.puntos && ps[0].partes && ps[0].partes.mascaras.pelo.length === 16, "puntos de cara y partes");
ok(ps[1].caja.x >= 0 && ps[1].caja.x + ps[1].caja.w <= 800, "la caja estimada se queda dentro de la foto");

/* ── caché ── */
{
  const c = createPeopleCache(); let n = 0;
  const calc = async () => { n++; await new Promise(r => setTimeout(r, 5)); return { v: n }; };
  const [a, b] = await Promise.all([c.getOrCompute("bueno", calc), c.getOrCompute("bueno", calc)]);
  ok(n === 1 && a === b, "dos herramientas a la vez comparten una pasada");
  ok((await c.getOrCompute("bueno", calc)) === a && n === 1, "la segunda petición sale de la caché");
  await c.getOrCompute("mejor", calc);
  ok(n === 2 && c.get("bueno") === c.get("mejor"), "«mejor» sirve para «bueno»");
  c.bump();
  ok(c.get("bueno") === null, "un cambio del documento invalida");
  const lenta = c.getOrCompute("bueno", async () => { await new Promise(r => setTimeout(r, 20)); return { v: "vieja" }; });
  c.bump();
  await lenta;
  ok(c.get("bueno") === null, "un análisis que acaba tras un cambio no se guarda");
}

/* ── analyze: proveedores y cancelación ── */
{
  const cache = createPeopleCache(); let llamadas = 0;
  const src = { width: 800, height: 600 };
  const r0 = await analyze(src, { faces: caras, cache });
  ok(r0.personas.length === 2 && r0.personas.every(p => p.pose === null), "sin proveedores: sólo caras y cajas");
  registerProvider("poses", async ({ caras: cs, quality }) => { llamadas++; return [p0]; });
  cache.bump();
  const r1 = await analyze(src, { faces: caras, cache, quality: "mejor" });
  const r2 = await analyze(src, { faces: caras, cache, quality: "bueno" });
  ok(r1.personas[0].pose && llamadas === 1 && r2 === r1, "el proveedor se llama una vez y se reutiliza");
  cache.bump();
  const ac = new AbortController(); ac.abort();
  let abortado = false;
  try { await analyze(src, { faces: caras, cache, signal: ac.signal }); } catch (e) { abortado = e.name === "AbortError"; }
  ok(abortado, "la cancelación lanza AbortError");
  let malo = false;
  try { registerProvider("rayos-x", () => {}); } catch { malo = true; }
  ok(malo, "tipo de proveedor desconocido");
}

console.log(fallos ? "personas: FALLO" : "personas: OK");
process.exit(fallos ? 1 : 0);
