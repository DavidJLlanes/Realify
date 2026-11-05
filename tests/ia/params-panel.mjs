/* ═══════════════════════════════════════════════════════════════
   PRUEBA · js/ui/kit/params-panel.js (Node puro, sin navegador)
   Valores por defecto, parámetros por perfil, rangos propios, validación y paso a secciones. Incluye la comprobación de
   seguridad de la F6.9 en pequeño: un perfil infantil NO puede alcanzar un parámetro de adulto ni por esquema ni por valores.
   Uso: node tests/ia/params-panel.mjs
   ═══════════════════════════════════════════════════════════════ */
import { defaultsOf, paramsFor, validate, toSections, appliesTo } from "../../js/ui/kit/params-panel.js";

const P = [
  { key: "altura", label: "Altura", type: "range", min: -10, max: 10, def: 0, group: "silueta", ranges: { nino: [-3, 3], nina: [-3, 3] } },
  { key: "hombros", label: "Hombros", type: "range", min: -20, max: 20, def: 0, group: "torso" },
  { key: "pecho", label: "Pecho", type: "range", min: -20, max: 20, def: 0, group: "torso", only: ["hombre", "mujer"] },
  { key: "simetria", label: "Simetría", type: "toggle", def: true, group: "silueta" },
  { key: "estilo", label: "Estilo", type: "seg", options: [["a", "A"], ["b", "B"]], def: "a" }
];
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok(eq(defaultsOf(P, "hombre"), { altura: 0, hombros: 0, pecho: 0, simetria: true, estilo: "a" }), "defaults de adulto");
ok(eq(defaultsOf(P, "nino"), { altura: 0, hombros: 0, simetria: true, estilo: "a" }), "defaults infantil sin «pecho»");
ok(paramsFor(P, "nina").find(p => p.key === "altura").max === 3, "rango propio del perfil infantil");
ok(paramsFor(P, "mujer").find(p => p.key === "altura").max === 10, "rango completo en adultos");
ok(P[0].max === 10, "paramsFor no modifica el original");
ok(!appliesTo(P[2], "nino") && appliesTo(P[2], "mujer") && appliesTo(P[2], null), "appliesTo");

let v = validate(P, { altura: 99, pecho: 5, hombros: 1 }, "nino");
ok(eq(v.values, { altura: 3, hombros: 1 }) && eq(v.rejected, ["pecho"]), "infantil: recorta altura, rechaza pecho → " + JSON.stringify(v));
v = validate(P, { altura: -99, pecho: 99 }, "hombre");
ok(eq(v.values, { altura: -10, pecho: 20 }) && v.rejected.length === 0, "adulto: recorta al rango");
v = validate(P, { altura: "x", simetria: 1, estilo: "z" }, "mujer");
ok(eq(v.rejected, ["altura", "simetria", "estilo"]), "tipos y opciones no válidos → " + JSON.stringify(v));

const G = [{ id: "silueta", label: "Silueta" }, { id: "torso", label: "Torso" }, { id: "vacio", label: "Vacío" }];
let s = toSections(P, G, "hombre");
ok(eq(s.map(x => x.id), ["silueta", "torso"]) && s[1].props.length === 2, "secciones adulto (grupo vacío oculto)");
ok(!("group" in s[0].props[0]) && !("only" in s[1].props[1]) && !("ranges" in s[0].props[0]), "las claves propias del esquema no llegan a mountControls");
s = toSections(P, G, "nino");
ok(s[1].props.length === 1 && s[1].props[0].key === "hombros", "secciones infantil sin «pecho»");
ok(s[0].props.some(p => p.key === "estilo"), "sin grupo → va al primero");
console.log(fallos ? "params-panel: FALLO" : "params-panel: OK");
process.exit(fallos ? 1 : 0);
