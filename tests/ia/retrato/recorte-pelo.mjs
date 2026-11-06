/* ═════════════════════════════════════════════════
   PRUEBA · el recorte de la cara incluye el pelo largo (motor puro, sin navegador)
   Error que cubre: el color del pelo sólo cambiaba hasta el borde del recorte (línea recta). Comprueba que cropFor() con la caja del pelo
   llega hasta donde acaba el pelo y que sin ella queda como antes. Uso: node tests/ia/retrato/recorte-pelo.mjs
   ═════════════════════════════════════════════════ */
import { cropFor } from "../../../js/features/portrait/shared/geometry.js";
import { cajaParte } from "../../../js/features/portrait/shared/partes.js";
import { IDX } from "../../../js/features/portrait/shared/landmarks.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const pts = Array.from({ length: 478 }, () => [500, 400]);
pts[234] = [450, 400]; pts[454] = [550, 400]; pts[IDX.nariz.frente] = [500, 330]; pts[IDX.boca.mentón] = [500, 480];     // cara de 100 px de ancho
const sin = cropFor(pts, 1000, 1600, 1600);
const pelo = { x0: 380, y0: 250, x1: 640, y1: 900 };                                                                  // el pelo cae hasta y = 900
const con = cropFor(pts, 1000, 1600, 1600, pelo);
ok(sin.y + sin.h < 900, "sin pelo el recorte debería quedar corto (" + (sin.y + sin.h) + ")");
ok(con.y + con.h >= 900, "con la caja del pelo el recorte debe llegar a 900 (" + (con.y + con.h) + ")");
ok(con.x <= 380 && con.x + con.w >= 640, "el recorte no cubre el ancho del pelo");
const m = new Uint8Array(10 * 10); for(let y = 2; y < 8; y++) for(let x = 3; x < 6; x++) m[y * 10 + x] = 255;
const b = cajaParte({ w: 10, h: 10, caja: { x: 100, y: 200, w: 100, h: 100 }, mascaras: { pelo: m } }, "pelo");
ok(b && b.x0 === 130 && b.x1 === 160 && b.y0 === 220 && b.y1 === 280, "cajaParte: " + JSON.stringify(b));
console.log(fallos ? `${fallos} FALLOS` : "OK"); process.exit(fallos ? 1 : 0);
