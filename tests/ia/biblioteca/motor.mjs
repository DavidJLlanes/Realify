/* Prueba del motor de selección rápida (sin DOM): hash perceptual, duplicados, ojos cerrados, puntuación y composición. */
import { dHash, hamming, grupos, ojosCerrados, puntuar, mejores, composicion } from "../../../plugins/culling/engine.js";
let fallos = 0; const ok = (c, m) => { console.log((c ? "OK    " : "FALLO ") + m); if(!c) fallos++; };
const imagen = (f, ruido = 0) => { const g = new Float32Array(72); let s = 3; for(let i = 0; i < 72; i++){ s = (s * 16807) % 2147483647; g[i] = f(i % 9, (i / 9) | 0) + ruido * (s / 2147483647 - 0.5); } return g; };
const a = dHash(imagen((x, y) => Math.sin(x * 0.9) + y * 0.2)), b = dHash(imagen((x, y) => Math.sin(x * 0.9) + y * 0.2, 0.05)), c = dHash(imagen((x, y) => Math.cos(y * 1.7) * 2 - x * 0.3));
ok(a.length === 16 && /^[0-9a-f]+$/.test(a), "hash de 16 cifras hex " + a);
ok(hamming(a, a) === 0 && hamming(a, b) <= 6, "la misma imagen con ruido casi no cambia (" + hamming(a, b) + " bits)");
ok(hamming(a, c) > 12, "una imagen distinta se aleja (" + hamming(a, c) + " bits)");
const g = grupos([a, b, c, a], 10); ok(g.length === 1 && g[0].length === 3 && !g[0].includes(2), "agrupa los duplicados y deja fuera la distinta " + JSON.stringify(g));
const ojo = (abierto) => { const p = Array.from({ length: 478 }, () => [0, 0]); const set = (ids, h) => { p[ids[0]] = [0, 0]; p[ids[3]] = [10, 0]; p[ids[1]] = [3, -h]; p[ids[5]] = [3, h]; p[ids[2]] = [7, -h]; p[ids[4]] = [7, h]; }; set([33, 160, 158, 133, 153, 144], abierto); set([362, 385, 387, 263, 373, 380], abierto); return p; };
ok(ojosCerrados(ojo(2)) === false && ojosCerrados(ojo(0.4)) === true && ojosCerrados(null) === null, "ojos abiertos / cerrados / sin cara");
const buena = puntuar({ nitidez: 400, pasos: 9, quemado: 0.002, negro: 0.01, ojos: false, compo: 0.8 }), borrosa = puntuar({ nitidez: 4, pasos: 9, quemado: 0.002, negro: 0.01, ojos: false, compo: 0.8 });
ok(buena.puntos > 75 && borrosa.puntos < buena.puntos - 25 && borrosa.motivos.includes("desenfocada"), `nítida ${buena.puntos} vs borrosa ${borrosa.puntos} (${borrosa.motivos})`);
const cerr = puntuar({ nitidez: 400, pasos: 9, quemado: 0, negro: 0, ojos: true, compo: 0.8 }); ok(cerr.puntos < buena.puntos * 0.7 && cerr.motivos.includes("ojos cerrados"), "ojos cerrados bajan la nota " + cerr.puntos);
const quem = puntuar({ nitidez: 400, pasos: 9, quemado: 0.2, negro: 0, ojos: null, compo: null }); ok(quem.puntos < buena.puntos && quem.motivos.includes("luces quemadas"), "luces quemadas bajan la nota " + quem.puntos);
ok(JSON.stringify(mejores([50, 90, 70], [[0, 1, 2]])) === "[1]", "elige la mejor del grupo");
const imp = (cx, cy) => { const w = 30, h = 20, m = new Float32Array(w * h); for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) m[y * w + x] = Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / 8)); return [m, w, h]; };
ok(composicion(...imp(10, 6.7)) > composicion(...imp(2, 2)) && composicion(...imp(10, 6.7)) > 0.8, "un sujeto en un tercio compone mejor que uno en la esquina");
process.exit(fallos ? 1 : 0);
