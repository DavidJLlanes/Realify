/* ═════════════════════════════════════════════════
   PRUEBA · motor de fotogramas, caché, renderizado y reproductor (Node, con lienzos falsos y reloj falso). Uso: node tests/video/render.mjs
   ═════════════════════════════════════════════════ */
import { crearProyecto, crearMedio, crearPista, finClip } from "../../plugins/video/project/modelo.js";
import * as T from "../../plugins/video/timeline/ops.js";
import { crearMotor } from "../../plugins/video/render/motor.js";
import { crearCache } from "../../plugins/video/render/cache.js";
import { renderizar } from "../../plugins/video/render/aplicar.js";
import { crearReproductor } from "../../plugins/video/render/reproductor.js";
import { crearRegistroEfectos } from "../../plugins/video/effects/registro.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

// proyecto: dos medios; pista 1 con A (0-4) y pista 2 con B (2-6) encima
let p = crearProyecto({ fps: 10 }); p.medios.A = crearMedio({ nombre: "a", duracion: 10, ancho: 100, alto: 50, fps: 10 }); p.medios.B = crearMedio({ nombre: "b", duracion: 10, ancho: 50, alto: 50, fps: 10 });
p = { ...p, pistas: [crearPista("video", { id: "v1" }), crearPista("video", { id: "v2" }), crearPista("audio", { id: "a1" })] };
p = T.anadirClip(p, "v1", "A", { dentro: 0, fuera: 4 }); p = T.anadirClip(p, "v2", "B", { dentro: 0, fuera: 4 }); const cB = p.pistas[1].clips[0].id; p = T.mover(p, cB, 2);
// fabricación falsa: un lienzo es { width, height, ops:[] }
const fab = { lienzo: (w, h) => ({ width: w, height: h, ops: [] }), rellenar: (d, c) => d.ops.push(["rellenar", c]), dibujar: (d, o, x, y, w, h) => d.ops.push(["dibujar", o.nombre, +x.toFixed(1), +y.toFixed(1), +w.toFixed(1), +h.toFixed(1)]) };
let abiertos = 0, cerrados = 0, decodificados = 0; const liberados = [];
const abrirLector = async (id, ancho) => { abiertos++; return { fotograma: async t => { decodificados++; return { lienzo: { nombre: `${id}@${t.toFixed(1)}`, width: id === "A" ? 100 : 50, height: 50 }, t }; }, cerrar: () => { cerrados++; } }; };
const efectos = crearRegistroEfectos(); let preparados = 0, desechados = 0;
efectos.registrar({ id: "marca", version: 1, nombre: "Marca", params: [], carga: async () => ({ crear: () => ({ prepare: async () => { preparados++; }, process: (f, pr, t) => ({ ...f, nombre: f.nombre + "+" + pr.k }), dispose: () => { desechados++; } }) }) });
efectos.registrar({ id: "roto", version: 1, nombre: "Roto", params: [], carga: async () => ({ crear: () => ({ process: () => { throw new Error("falla"); } }) }) });
const motor = crearMotor({ proyecto: () => p, abrirLector, efectos, fabrica: fab, cacheMax: 4 });
let f = await motor.fotograma(1, { ancho: 200, alto: 100 }); ok(f.ops.filter(o => o[0] === "dibujar").length === 1 && f.ops[0][0] === "rellenar", "t=1: sólo suena la pista de abajo");
ok(f.ops[1][1] === "A@1.0" && f.ops[1][4] === 200 && f.ops[1][5] === 100, "encaja A (100×50) en 200×100: " + JSON.stringify(f.ops[1]));
f = await motor.fotograma(3, { ancho: 200, alto: 100 }); const d = f.ops.filter(o => o[0] === "dibujar"); ok(d.length === 2 && d[0][1] === "A@3.0" && d[1][1] === "B@1.0", "t=3: B encima, con su tiempo propio (3-2=1): " + JSON.stringify(d));
ok(d[1][4] === 100 && d[1][2] === 50, "B cuadrada va centrada con barras: " + JSON.stringify(d[1]));
f = await motor.fotograma(5, { ancho: 200, alto: 100 }); ok(f.ops.filter(o => o[0] === "dibujar").length === 1 && f.ops.find(o => o[0] === "dibujar")[1] === "B@3.0", "t=5: sólo B");
f = await motor.fotograma(8, { ancho: 200, alto: 100 }); ok(f.ops.every(o => o[0] === "rellenar"), "t=8: negro, no hay clips");
const antes = decodificados; await motor.fotograma(5, { ancho: 200, alto: 100 }); ok(decodificados === antes, "el mismo fotograma sale de la caché");
ok(abiertos === 2, "un lector por medio y ancho: " + abiertos);
// efectos
p = T.ponerEfecto(p, p.pistas[0].clips[0].id, "marca", { k: "x" }); p = T.ponerEfecto(p, p.pistas[0].clips[0].id, "roto"); p = T.ponerEfecto(p, p.pistas[0].clips[0].id, "no-existe");
f = await motor.fotograma(1, { ancho: 200, alto: 100 }); ok(f.ops.find(o => o[0] === "dibujar")[1] === "A@1.0+x", "el efecto se aplica: " + JSON.stringify(f.ops.find(o => o[0] === "dibujar")));
ok(motor.errores.some(e => /roto/.test(e)) && preparados === 1, "un efecto roto se salta y se anota; los otros siguen");
await motor.fotograma(1.1, { ancho: 200, alto: 100 }); ok(preparados === 1, "el efecto se prepara una sola vez");
// medio imposible de abrir
const m2 = crearMotor({ proyecto: () => p, abrirLector: async () => { throw new Error("sin códec"); }, efectos, fabrica: fab }); f = await m2.fotograma(1, { ancho: 20, alto: 10 }); ok(f.ops.every(o => o[0] === "rellenar") && /sin códec/.test(m2.errores[0]), "medio que no abre → negro y aviso");
await motor.cerrar(); ok(cerrados === 2 && desechados === 1, `cerrar libera lectores (${cerrados}) y efectos (${desechados})`);
// caché
const lib = []; const c = crearCache(2, v => lib.push(v)); c.set("a", 1); c.set("b", 2); c.get("a"); c.set("c", 3); ok(c.get("b") === undefined && lib.join() === "2" && c.tamano() === 2, "LRU saca el menos usado y lo libera"); c.clear(); ok(lib.length === 3, "clear libera todo");
// renderizar
const q = T.eliminar(p, p.pistas[1].clips[0].id); const m3 = crearMotor({ proyecto: () => q, abrirLector, efectos: crearRegistroEfectos(), fabrica: fab }); const recibidos = []; let cerrado = false, cancelado = false, prog = 0;
const cod = { anadir: async (l, t, dur) => { recibidos.push([+t.toFixed(2), +dur.toFixed(2)]); }, cerrar: async () => { cerrado = true; return "blob"; }, cancelar: async () => { cancelado = true; } };
const r = await renderizar({ motor: m3, codificador: cod, ancho: 20, alto: 10, fps: 10, desde: 0, hasta: 2, alProgreso: n => { prog = n; } }); ok(r === "blob" && recibidos.length === 20 && recibidos[19][0] === 1.9 && recibidos[0][1] === 0.1 && prog === 20 && cerrado, "renderiza 20 fotogramas a 10 fps");
const ac = new AbortController(); let n = 0; const cod2 = { ...cod, anadir: async () => { if (++n === 5) ac.abort(); }, cancelar: async () => { cancelado = true; } };
try { await renderizar({ motor: m3, codificador: cod2, ancho: 20, alto: 10, fps: 10, hasta: 3, senal: ac.signal }); ok(false, "debía cancelarse"); } catch (e) { ok(e.cancelado && cancelado && n === 5, "cancelar para a tiempo y cancela el codificador"); }
const cod3 = { ...cod, anadir: async () => { throw new Error("disco lleno"); }, cancelar: async () => { cancelado = false; } }; try { await renderizar({ motor: m3, codificador: cod3, ancho: 20, alto: 10, fps: 10, hasta: 1 }); } catch (e) { ok(/disco/.test(e.message) && cancelado === false, "un error del codificador sube y se cancela"); }
// reproductor con reloj falso
let reloj = 0; const progs = []; const programar = fn => progs.push(fn); const pintados = []; let lento = false;
const motorFalso = { fotograma: async (t) => { if (lento) await new Promise(r => setTimeout(r, 30)); return { t }; } };
const rp = crearReproductor({ motor: motorFalso, duracion: () => 1, pintar: (l, t) => pintados.push(+t.toFixed(2)), ancho: 10, alto: 10, ahora: () => reloj, programar });
await rp.buscar(0.5); ok(pintados.join() === "0.5" && rp.tiempo() === 0.5, "buscar pinta ese instante");
rp.play(); ok(rp.reproduciendo() && progs.length === 1, "play programa el bucle");
reloj = 100; progs.shift()(); await new Promise(r => setTimeout(r, 5)); ok(Math.abs(rp.tiempo() - 0.6) < 1e-9, "avanza con el reloj: " + rp.tiempo());
lento = true; reloj = 200; progs.shift()(); reloj = 300; progs.shift()(); reloj = 350; progs.shift()(); await new Promise(r => setTimeout(r, 120));
ok(pintados.length <= 4 && Math.abs(rp.tiempo() - 0.85) < 1e-9, `salta fotogramas si el render es lento (pintó ${pintados.length}, t=${rp.tiempo()})`);
reloj = 2000; progs.shift()(); await new Promise(r => setTimeout(r, 120)); ok(!rp.reproduciendo() && rp.tiempo() === 1, "se para solo al final");
rp.play(); ok(rp.tiempo() === 0 || rp.reproduciendo(), "reproducir desde el final vuelve a empezar"); rp.pause(); ok(!rp.reproduciendo(), "pausa"); rp.cerrar();
console.log(fallos ? `FALLOS: ${fallos}` : "OK · motor de render"); process.exit(fallos ? 1 : 0);
