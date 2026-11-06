/* ═════════════════════════════════════════════════
   PRUEBA · línea de tiempo del vídeo (operaciones, deshacer y vista). Node, sin navegador. Casos límite incluidos. Uso: node tests/video/timeline.mjs
   ═════════════════════════════════════════════════ */
import { crearProyecto, crearMedio, crearPista, problemas, buscarClip, duracionProyecto, duracionClip, finClip } from "../../plugins/video/project/modelo.js";
import * as T from "../../plugins/video/timeline/ops.js";
import { crearHistorial } from "../../plugins/video/timeline/historial.js";
import { vistaInicial, zoomEn, tAPx, pxAT, desplazar, imantar } from "../../plugins/video/timeline/vista.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const lanza = (f, re, m) => { try { f(); ok(false, m + " (no lanzó)"); } catch (e) { ok(re.test(e.message), m + ": " + e.message); } };
let p = crearProyecto({ fps: 30 }); p.medios.m1 = crearMedio({ nombre: "a.mp4", duracion: 20 }); p.medios.a1 = crearMedio({ nombre: "a.wav", tipo: "audio", duracion: 20 });
p = { ...p, pistas: [crearPista("video", { id: "v1" }), crearPista("video", { id: "v2" }), crearPista("audio", { id: "a1" })] };
p = T.anadirClip(p, "v1", "m1", { dentro: 0, fuera: 10 }); const id1 = p.pistas[0].clips[0].id;
ok(duracionProyecto(p) === 10 && problemas(p).length === 0, "añadir clip");
// dividir
const d = T.dividir(p, id1, 4); const [a, b] = d.pistas[0].clips;
ok(d.pistas[0].clips.length === 2 && a.fuera === 4 && b.dentro === 4 && b.inicio === 4 && b.fuera === 10 && b.id !== a.id && problemas(d).length === 0, "dividir");
ok(p.pistas[0].clips.length === 1, "no modifica el original");
lanza(() => T.dividir(p, id1, 0), /dentro del clip/, "dividir en el borde"); lanza(() => T.dividir(p, id1, 10 - 0.01), /dentro del clip/, "dividir a menos de un fotograma"); lanza(() => T.dividir(p, "zz", 1), /No existe/, "clip inexistente");
// dividir con velocidad
const rapido = T.cambiarVelocidad(p, id1, 2); ok(duracionClip(rapido.pistas[0].clips[0]) === 5, "velocidad 2× acorta");
const dr = T.dividir(rapido, id1, 2); ok(dr.pistas[0].clips[0].fuera === 4 && dr.pistas[0].clips[1].dentro === 4 && finClip(dr.pistas[0].clips[1]) === 5, "dividir con velocidad");
lanza(() => T.cambiarVelocidad(p, id1, 0.1), /entre/, "velocidad fuera de rango"); lanza(() => T.cambiarVelocidad(p, id1, 9), /entre/, "velocidad muy alta");
// recortar
const rc = T.recortar(d, id1, "fin", 3); ok(rc.pistas[0].clips[0].fuera === 3, "recortar fin");
const ri = T.recortar(d, b.id, "inicio", 5); ok(ri.pistas[0].clips[1].inicio === 5 && ri.pistas[0].clips[1].dentro === 5, "recortar inicio");
lanza(() => T.recortar(d, id1, "fin", 5), /solapar/, "recortar hasta solapar"); lanza(() => T.recortar(d, id1, "fin", 0.01), /fotograma/, "clip de menos de un fotograma");
lanza(() => T.recortar(d, b.id, "fin", 25), /más vídeo/, "recortar más allá del medio");
ok(T.recortar(d, id1, "fin", 1 / 30).pistas[0].clips[0].fuera === 1 / 30, "clip de exactamente 1 fotograma");
// mover
const mv = T.mover(d, b.id, 6); ok(mv.pistas[0].clips[1].inicio === 6, "mover"); lanza(() => T.mover(d, b.id, 2), /solapar/, "mover encima"); lanza(() => T.mover(d, b.id, -1), /antes de 0/, "mover a negativo");
const mp = T.mover(d, b.id, 0, "v2"); ok(mp.pistas[1].clips.length === 1 && mp.pistas[0].clips.length === 1 && problemas(mp).length === 0, "mover a otra pista");
lanza(() => T.mover(d, b.id, 0, "a1"), /otro tipo/, "mover a pista de otro tipo"); lanza(() => T.mover(d, b.id, 0, "nada"), /pista/, "pista inexistente");
// eliminar y duplicar
ok(T.eliminar(d, b.id).pistas[0].clips.length === 1, "eliminar"); const du = T.duplicar(p, id1); ok(du.pistas[0].clips.length === 2 && du.pistas[0].clips[1].inicio === 10 && problemas(du).length === 0, "duplicar detrás");
lanza(() => T.duplicar(p, id1, 3), /solapar/, "duplicar encima");
// efectos
let e = T.ponerEfecto(p, id1, "sensor", { grano: 40 }); const ef = e.pistas[0].clips[0].efectos[0];
ok(ef.efecto === "sensor" && ef.activo && ef.params.grano === 40, "poner efecto");
e = T.ajustarEfecto(e, id1, ef.id, { params: { grano: 70 } }); ok(e.pistas[0].clips[0].efectos[0].params.grano === 70, "ajustar efecto");
ok(T.ajustarEfecto(e, id1, ef.id, { activo: false }).pistas[0].clips[0].efectos[0].activo === false, "desactivar efecto");
lanza(() => T.ajustarEfecto(e, id1, "nada", {}), /efecto/, "efecto inexistente");
const dv = T.dividir(e, id1, 5); ok(dv.pistas[0].clips[1].efectos[0].id !== ef.id && dv.pistas[0].clips[1].efectos[0].params.grano === 70, "dividir copia efectos con id nuevo");
ok(T.quitarEfecto(e, id1, ef.id).pistas[0].clips[0].efectos.length === 0, "quitar efecto");
// historial
const h = crearHistorial(p, 3);
h.hacer(x => T.dividir(x, id1, 4), "Dividir"); h.hacer(x => T.cambiarVelocidad(x, id1, 2), "Velocidad");
ok(h.pasos() === 2 && h.etiquetaDeshacer() === "Velocidad", "historial pasos");
h.deshacer(); ok(h.actual().pistas[0].clips.length === 2 && h.puedeRehacer(), "deshacer"); h.rehacer(); ok(h.actual().pistas[0].clips[0].velocidad === 2, "rehacer");
h.deshacer(); h.hacer(x => T.eliminar(x, id1), "Eliminar"); ok(!h.puedeRehacer(), "hacer tras deshacer borra el futuro");
try { h.hacer(() => { throw new Error("x"); }); } catch {} ok(h.pasos() === 2, "una operación fallida no cambia el historial");
for (let i = 0; i < 6; i++) h.hacer(x => ({ ...x, nombre: "n" + i }), "n"); ok(h.pasos() === 3, "límite de pasos");
for (let i = 0; i < 10; i++) h.deshacer(); ok(!h.puedeDeshacer(), "no deshace más de lo guardado");
const mismo = crearHistorial(p); mismo.hacer(x => x, "nada"); ok(mismo.pasos() === 0, "operación sin cambios no ocupa un paso");
// vista
let v = vistaInicial(10, 600); ok(v.pps > 40 && v.pps < 60 && v.desde === 0, "vista inicial");
const antes = pxAT(v, 300); const z = zoomEn(v, 2, 300); ok(Math.abs(pxAT(z, 300) - antes) < 1e-9 && z.pps === v.pps * 2, "el zoom no mueve el punto de anclaje");
ok(zoomEn(v, 1e9, 0).pps === 2000 && zoomEn(v, 1e-9, 0).pps === 2, "límites de zoom"); ok(desplazar(v, -999).desde === 0, "no desplaza antes de 0");
ok(Math.abs(tAPx(v, pxAT(v, 123)) - 123) < 1e-9, "px ↔ t"); ok(imantar({ pps: 100, desde: 0 }, 2.03, [2], 30) === 2, "imanta al borde"); ok(imantar({ pps: 100, desde: 0 }, 5.5, [2], 30) !== 2, "no imanta si está lejos");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · línea de tiempo"); process.exit(fallos ? 1 : 0);
