/* Prueba del motor de composición: zona libre para texto y propuestas de recorte (sin DOM). */
import { zonaTexto, texturaDe } from "../../../js/features/compose/engine/zona-texto.js";
import { colocarTexto } from "../../../js/features/compose/text-placement/engine.js";
const el = new Proxy(function(){}, { get: () => el, apply: () => el, set: () => true });
globalThis.document = { getElementById: () => el, createElement: () => el, querySelector: () => el, addEventListener(){}, body: el, documentElement: el }; globalThis.window = globalThis; globalThis.localStorage = { getItem: () => null, setItem(){} };
const { cropProposals } = await import("../../../js/features/smartcrop.js");
let fallos = 0; const ok = (c, m) => { console.log((c ? "OK    " : "FALLO ") + m); if(!c) fallos++; };
const gw = 100, gh = 80, imp = new Float32Array(gw * gh), lum = new Float32Array(gw * gh).fill(0.2);
// Sujeto en el centro-izquierda, cielo claro arriba derecha
for(let y = 20; y < 70; y++) for(let x = 10; x < 60; x++) imp[y * gw + x] = 1;
for(let y = 0; y < 30; y++) for(let x = 60; x < 100; x++) lum[y * gw + x] = 0.9;
const z = zonaTexto(imp, texturaDe(lum, gw, gh), lum, gw, gh, 25, 8);
ok(z && !(z.x < 60 && z.y + z.h > 20 && z.x + z.w > 10 && z.y < 70), "la zona no pisa al sujeto");
ok(z && z.x >= 0 && z.y >= 0 && z.x + z.w <= gw && z.y + z.h <= gh, "la zona cabe en la foto");
// Texto sobre fondo claro → oscuro
const claro = new Float32Array(gw * gh).fill(0.9), cz = zonaTexto(new Float32Array(gw * gh), texturaDe(claro, gw, gh), claro, gw, gh, 20, 6);
ok(cz && cz.claro === false, "fondo claro → texto oscuro");
const osc = new Float32Array(gw * gh).fill(0.1), oz = zonaTexto(new Float32Array(gw * gh), texturaDe(osc, gw, gh), osc, gw, gh, 20, 6);
ok(oz && oz.claro === true, "fondo oscuro → texto claro");
// Textura alta se evita
const tx = new Float32Array(gw * gh).fill(0.5); for(let y = 0; y < gh; y++) for(let x = 0; x < 50; x++) tx[y * gw + x] = (x >> 1) % 2 ? 0.1 : 0.9;
const tz = zonaTexto(new Float32Array(gw * gh), texturaDe(tx, gw, gh), tx, gw, gh, 20, 6);
ok(tz && tz.x >= 45, "evita la zona con textura");
const r = colocarTexto({ imp, lum, gw, gh, prop: 4, altoRel: 0.1, fotoW: 1000, fotoH: 800 });
ok(r && r.w <= 1 && r.h > 0, "colocarTexto devuelve fracciones");
// Propuestas de recorte
const M = { imp: new Float32Array(gw * gh), gw, gh, k: 1, faces: [] };
for(let y = 10; y < 30; y++) for(let x = 10; x < 30; x++) M.imp[y * gw + x] = 1;
for(let y = 40; y < 70; y++) for(let x = 60; x < 90; x++) M.imp[y * gw + x] = 0.8;
const ps = cropProposals(M, 1, 100, 80, 3);
ok(ps.length >= 2 && ps.length <= 3, "hasta 3 propuestas (" + ps.length + ")");
const iou = (a, b) => { const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if(w <= 0 || h <= 0) return 0; const i = w * h; return i / (a.w * a.h + b.w * b.h - i); };
ok(ps.every((p, i) => ps.every((q, j) => i >= j || iou(p, q) < 0.56)), "propuestas distintas entre sí");
console.log(JSON.stringify(ps));
process.exit(fallos ? 1 : 0);
