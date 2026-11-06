/* ═════════════════════════════════════════════════
   PRUEBA · proyecto de vídeo (modelo, validación y migraciones). Node, sin navegador. Uso: node tests/video/proyecto.mjs
   ═════════════════════════════════════════════════ */
import fs from "node:fs";
import { crearProyecto, crearMedio, crearPista, crearClip, duracionClip, duracionProyecto, problemas, huella, buscarClip, clipEn, tiempoEnMedio } from "../../plugins/video/project/modelo.js";
import { abrirProyecto, aTexto } from "../../plugins/video/project/migrar.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const p0 = crearProyecto({ nombre: "t" }); p0.medios.m1 = crearMedio({ nombre: "a.mp4", duracion: 10 });
const t = crearPista("video", { id: "v1" }); t.clips.push(crearClip({ id: "c1", medio: "m1", inicio: 0, dentro: 2, fuera: 6, velocidad: 2 }));
const p = { ...p0, pistas: [t] };
ok(duracionClip(t.clips[0]) === 2 && duracionProyecto(p) === 2, "duración con velocidad");
ok(problemas(p).length === 0, "proyecto válido: " + problemas(p));
ok(tiempoEnMedio(t.clips[0], 1) === 4 && clipEn(t, 1.5)?.id === "c1" && clipEn(t, 2) === null, "tiempo en medio y clipEn");
ok(huella({ name: "a.mp4", size: 5, lastModified: 7 }) === "a.mp4|5|7", "huella");
const mal = structuredClone(p); mal.pistas[0].clips.push(crearClip({ id: "c2", medio: "m1", inicio: 1, dentro: 0, fuera: 3 })); mal.pistas[0].clips.push(crearClip({ id: "c3", medio: "zz", dentro: 0, fuera: 1, inicio: 50 }));
ok(problemas(mal).some(x => /solape/.test(x)) && problemas(mal).some(x => /medio desconocido/.test(x)), "detecta solape y medio desconocido");
// ida y vuelta
const r = abrirProyecto(aTexto(p)); ok(!r.soloLectura && r.avisos.length === 0 && JSON.stringify(r.proyecto) === JSON.stringify(p), "ida y vuelta sin cambios");
// migración v0 → v1
const v0 = JSON.parse(fs.readFileSync(new URL("./fixtures/proyecto-v0.json", import.meta.url)));
const m = abrirProyecto(v0); ok(m.proyecto.schemaVersion === 1 && m.proyecto.pistas[0].clips.length === 3 && Object.keys(m.proyecto.medios).length === 2, "migra v0: " + JSON.stringify(m.avisos));
ok(m.proyecto.salida.fps === 30 && m.proyecto.pistas[0].clips[2].medio === m.proyecto.pistas[0].clips[0].medio, "misma a.mp4 comparte medio");
ok(problemas(m.proyecto).length === 0, "migrado válido: " + problemas(m.proyecto));
ok(JSON.stringify(v0).includes('"archivo"'), "la migración no modifica el original");
// versión futura
const f = abrirProyecto({ ...p, schemaVersion: 99 }); ok(f.soloLectura && /más nueva/.test(f.avisos[0]), "versión futura sólo lectura");
// basura
for (const x of ["no json", "[]", "{}", "null", JSON.stringify({ foo: 1 })]) { let e = null; try { abrirProyecto(x); } catch (er) { e = er.message; } ok(e && /proyecto/.test(e), "rechaza " + x); }
ok(buscarClip(p, "c1").pista.id === "v1" && buscarClip(p, "nada") === null, "buscarClip");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · proyecto de vídeo"); process.exit(fallos ? 1 : 0);
