/* ═════════════════════════════════════════════════
   PRUEBA · asistente (motor, Node): esquema desde los manifiestos, intérprete de órdenes y validación del plan.
   Uso: node tests/ia/asistente/motor.mjs
   ═════════════════════════════════════════════════ */
import { construirEsquema, CLASICAS } from "../../../js/features/assistant/engine/esquema.js";
import { interpretar } from "../../../js/features/assistant/engine/interprete.js";
import { validarPlan, describirPaso, MAX_PASOS } from "../../../js/features/assistant/engine/validar.js";
import { MANIFESTS } from "../../../js/ui/menu/ia/manifests.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const E = construirEsquema(MANIFESTS);
ok(CLASICAS.every(t => E.has(t.id)), "clásicas"); ok(E.has("ai.dehaze") && E.has("ai.skyEnhance") && E.has("ai.highlightRecovery"), "IA desde manifiestos");
ok(!E.has("ai.culling") && !E.has("ai.searchPhotos") && !E.has("ai.photoReport") && !E.has("ai.myStyles"), "sin editores ni informes ni textos");
console.log("herramientas:", E.size);
const t = (txt) => interpretar(txt);
let r = t("hazla más cálida y con grano de película");
ok(r.pasos.length === 2 && r.pasos[0].herramienta === "wb" && r.pasos[0].valores.temp > 0 && r.pasos[1].herramienta === "grano" && r.sinEntender.length === 0, "cálida y grano " + JSON.stringify(r));
r = t("un poco más fría"); ok(r.pasos[0].valores.temp < 0 && Math.abs(r.pasos[0].valores.temp) < 25, "poco fría " + JSON.stringify(r));
r = t("muy luminosa y con mucho contraste"); ok(r.pasos.some(p => p.herramienta === "exposure" && p.valores.ev > 0.8) && r.pasos.some(p => p.herramienta === "bc" && p.valores.contrast >= 40), "luminosa " + JSON.stringify(r));
r = t("menos saturación"); ok(r.pasos[0].herramienta === "hsl" && r.pasos[0].valores.sat < 0, "menos saturación " + JSON.stringify(r));
r = t("quita la neblina y mejora el cielo"); ok(r.pasos.map(p => p.herramienta).join() === "ai.dehaze,ai.skyEnhance", "neblina y cielo " + JSON.stringify(r));
r = t("ponla en blanco y negro"); ok(r.pasos.length === 1 && r.pasos[0].herramienta === "gray", "byn");
r = t("sin grano"); ok(r.pasos.length === 0, "sin grano no añade grano");
r = t("hazme un café"); ok(r.pasos.length === 0 && r.sinEntender.length >= 1, "no entendido " + JSON.stringify(r));
let v = validarPlan({ pasos: [{ herramienta: "wb", valores: { temp: 500 } }, { herramienta: "rm -rf", valores: {} }, { herramienta: "exposure", valores: { ev: "abc" } }, { herramienta: "wb", valores: { color: 3, tint: -20 } }] }, E);
ok(v.pasos.length === 2 && v.pasos[0].valores.temp === 100 && v.pasos[1].valores.tint === -20 && !("color" in v.pasos[1].valores), "validación " + JSON.stringify(v));
ok(v.rechazados.length === 2 && v.ajustes.length === 2, "motivos " + JSON.stringify(v.rechazados));
ok(validarPlan({ pasos: Array.from({ length: 12 }, () => ({ herramienta: "gray" })) }, E).pasos.length === MAX_PASOS, "máximo de pasos");
ok(validarPlan(null, E).pasos.length === 0 && validarPlan({ pasos: "x" }, E).rechazados.length === 1, "plan inválido");
ok(/Temperatura \+30/.test(describirPaso({ herramienta: "wb", valores: { temp: 30 } }, E)), "describir");
const dev = interpretar("hazla más cálida y con grano de película"); ok(validarPlan(dev, E).pasos.length === 2 && validarPlan(dev, E).rechazados.length === 0, "lo interpretado pasa la validación");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · asistente (motor)"); process.exit(fallos ? 1 : 0);
