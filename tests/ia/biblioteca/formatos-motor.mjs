/* ═════════════════════════════════════════════════
   PRUEBA · formatos para redes y nombres del ZIP (motor, Node). Uso: node tests/ia/biblioteca/formatos-motor.mjs
   ═════════════════════════════════════════════════ */
import { planFormato, FORMATOS } from "../../../js/features/library/shared/formatos-redes.js";
import { nombreUnico } from "../../../plugins/batch/salida.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
let p = planFormato("ig-cuadrado", 4000, 3000); ok(p.w === 1080 && p.h === 1080 && p.sw === 3000 && p.sh === 3000 && p.sx === 500 && p.sy === 0, "cuadrado " + JSON.stringify(p));
p = planFormato("historia", 3000, 4000); ok(p.w === 1080 && p.h === 1920 && p.sh === 4000 && p.sw === 2250 && p.sx === 375, "historia " + JSON.stringify(p));
p = planFormato("x", 800, 800); ok(p.w === 800 && p.h === 450 && p.sw === 800 && p.sh === 450 && p.sy === 175, "no amplía " + JSON.stringify(p));
p = planFormato("web", 6000, 4000); ok(p.w === 2048 && p.h === 1365 && p.sw === 6000, "web " + JSON.stringify(p));
p = planFormato("web", 1000, 500); ok(p.w === 1000 && p.h === 500, "web no amplía");
p = planFormato("original", 123, 77); ok(p.w === 123 && p.h === 77 && p.sw === 123, "original");
ok(FORMATOS.length >= 6 && FORMATOS[0].id === "original", "lista");
const u = new Set(), d = { nombre: "IMG 1", n: 1, ancho: 10, alto: 5, fecha: new Date(2026, 0, 2) };
ok(nombreUnico("{nombre}", d, u) === "img-1" && nombreUnico("{nombre}", d, u) === "img-1-2" && nombreUnico("{fecha}_{n}", { ...d, n: 7 }, u) === "2026-01-02_007", "nombres únicos");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · formatos y nombres"); process.exit(fallos ? 1 : 0);
