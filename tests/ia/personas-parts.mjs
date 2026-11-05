/* ═══════════════════════════════════════════════════════════════
   PRUEBA · Seleccionar partes: motor puro (Node)
   Compone máscaras por persona a tamaño del documento: bilineal, unión de personas, filtro por persona, borde suave y cajas
   que salen de la foto. Uso: node tests/ia/personas-parts.mjs
   ═══════════════════════════════════════════════════════════════ */
import { composeParts } from "../../js/features/people/parts-select/engine.js";
import { PARTES, PARAMS, personasRef } from "../../js/features/people/parts-select/params.js";
import { GRUPOS } from "../../js/ai/people/groups.js";

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

// Persona con una máscara 8×8 de «pelo»: mitad izquierda llena, sobre una caja de 40×40 que empieza en (10, 10)
const m1 = new Uint8Array(64); for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) m1[y * 8 + x] = 255;
const p1 = { partes: { caja: { x: 10, y: 10, w: 40, h: 40 }, w: 8, h: 8, mascaras: { pelo: m1, cara: new Uint8Array(64) } } };
const m2 = new Uint8Array(16).fill(255);
const p2 = { partes: { caja: { x: 60, y: 60, w: 30, h: 30 }, w: 4, h: 4, mascaras: { pelo: m2 } } };
const W = 100, H = 100;

let r = composeParts([p1, p2], { parte: "pelo", persona: "todas", suavidad: 10 }, W, H);
ok(r.mask.length === W * H, "tamaño de la máscara");
ok(r.mask[30 * W + 15] === 255 && r.mask[30 * W + 45] === 0, "mitad izquierda dentro y derecha fuera");
ok(r.mask[75 * W + 75] === 255 && r.mask[5 * W + 5] === 0, "segunda persona y fuera de las cajas");
ok(r.cubierto > 0.1 && r.cubierto < 0.4, "fracción cubierta " + r.cubierto);

r = composeParts([p1, p2], { parte: "pelo", persona: "1" }, W, H);
ok(r.mask[30 * W + 15] === 0 && r.mask[75 * W + 75] === 255, "filtra por persona");
r = composeParts([p1, p2], { parte: "cara", persona: "todas" }, W, H);
ok(r.cubierto === 0, "una parte vacía no cubre nada");
r = composeParts([p1], { parte: "gafas" }, W, H);
ok(r.cubierto === 0, "una parte que el análisis no tiene");

// Borde: más suavidad = transición más ancha
const cuenta = s => { const m = composeParts([p1], { parte: "pelo", suavidad: s }, W, H).mask; let c = 0; for (const v of m) if (v > 5 && v < 250) c++; return c; };
ok(cuenta(40) > cuenta(0), "más suavidad, borde más ancho");

// Caja que sale de la foto: no escribe fuera ni falla
const p3 = { partes: { caja: { x: 90, y: 90, w: 40, h: 40 }, w: 4, h: 4, mascaras: { pelo: m2 } } };
r = composeParts([p3], { parte: "pelo" }, W, H);
ok(r.mask[95 * W + 95] === 255 && r.mask.length === W * H, "caja parcialmente fuera de la foto");

// Interfaz: las partes del menú existen como grupo del proveedor y las personas se rellenan
for (const [k] of PARTES) ok(k in GRUPOS, `la parte «${k}» no es un grupo del proveedor`);
personasRef.n = 3;
const opciones = PARAMS.find(p => p.key === "persona").options();
ok(opciones.length === 4 && opciones[0][0] === "todas" && opciones[3][1] === "Persona 3", "lista de personas dinámica");
ok(PARAMS.length <= 4, "una función simple tiene como máximo 4 mandos");

console.log(fallos ? "partes: FALLO" : "partes: OK");
process.exit(fallos ? 1 : 0);
