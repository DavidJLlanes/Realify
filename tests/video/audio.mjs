/* ═════════════════════════════════════════════════
   PRUEBA · audio y exportación: mezcla pura (Node), presets, y en el navegador un vídeo con sonido: importar, mezclar, exportar con sonido y volver a leerlo. Uso: CHROME_EXE=… node tests/video/audio.mjs
   ═════════════════════════════════════════════════ */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { crearProyecto, crearMedio, crearPista } from "../../plugins/video/project/modelo.js";
import * as T from "../../plugins/video/timeline/ops.js";
import { mezclar, segmentos, hayAudio } from "../../plugins/video/audio/mezcla.js";
import { mezclarVentana } from "../../plugins/video/audio/mezclador.js";
import { PRESETS, aplicarPreset } from "../../plugins/video/export/lista.js";
import { abrir } from "../ia/lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

// proyecto: medio de 4 s con audio (tono constante 0,5) y otro sin audio
const TASA = 1000, tono = (v, seg) => ({ canales: [new Float32Array(seg * TASA).fill(v)], tasa: TASA, t0: 0 });
let p = crearProyecto({ fps: 10 }); p.medios.A = crearMedio({ nombre: "a", duracion: 4, ancho: 10, alto: 10, fps: 10, audio: true }); p.medios.B = crearMedio({ nombre: "b", duracion: 4, ancho: 10, alto: 10, fps: 10 });
p = { ...p, pistas: [crearPista("video", { id: "v1" })] }; p = T.anadirClip(p, "v1", "A", { dentro: 0, fuera: 4 });
ok(hayAudio(p) && segmentos(p, 0, 10).length === 1, "detecta el audio");
let m = mezclar(p, { desde: 0, hasta: 4, tasa: TASA, pcm: () => tono(0.5, 4) });
ok(Math.abs(m.canales[0][2000] - 0.5) < 1e-6 && m.canales[1][2000] === m.canales[0][2000], "mono se reparte a los dos canales con su nivel");
ok(m.canales[0][0] < 0.2 && m.canales[0][3999] < 0.2, "fundido en los bordes (sin chasquido)");
const id = p.pistas[0].clips[0].id;
let q = T.cambiarVolumen(p, id, 0.5); m = mezclar(q, { desde: 0, hasta: 4, tasa: TASA, pcm: () => tono(0.5, 4) }); ok(Math.abs(m.canales[0][2000] - 0.25) < 1e-6, "volumen 50 %");
q = T.cambiarVolumen(p, id, 0); ok(!hayAudio(q), "volumen 0 = sin audio");
q = T.cambiarVolumen(p, id, 2); m = mezclar(q, { desde: 0, hasta: 4, tasa: TASA, pcm: () => tono(0.9, 4) }); ok(m.canales[0][2000] === 1, "se recorta a ±1");
let threw = false; try { T.cambiarVolumen(p, id, 3); } catch { threw = true; } ok(threw, "volumen fuera de rango da error");
// velocidad 2×: el clip dura 2 s; tono con rampa para ver que lee más rápido
const rampa = { canales: [Float32Array.from({ length: 4 * TASA }, (_, i) => i / (4 * TASA))], tasa: TASA, t0: 0 };
q = T.cambiarVelocidad(p, id, 2); m = mezclar(q, { desde: 0, hasta: 3, tasa: TASA, pcm: () => rampa });
ok(Math.abs(m.canales[0][500] - 0.25) < 0.01 && m.canales[0][2500] === 0, "2×: a 0,5 s suena lo del segundo 1; pasados 2 s, silencio");
// ventana a mitad y clip movido: el audio sigue al clip
q = T.mover(p, id, 1); m = mezclar(q, { desde: 0, hasta: 2, tasa: TASA, pcm: () => tono(0.5, 4) }); ok(m.canales[0][500] === 0 && m.canales[0][1500] > 0.4, "el audio sigue al clip movido");
// dividir: dos clips, mezcla continua en el corte
q = T.dividir(p, id, 2); m = mezclar(q, { desde: 0, hasta: 4, tasa: TASA, pcm: () => tono(0.5, 4) }); ok(m.canales[0][1990] > 0.4 || m.canales[0][2010] > 0.4, "tras dividir sigue sonando");
// mezclador con lector falso: sólo pide el tramo necesario
let pedidos = []; const lector = { audio: async (a, b) => { pedidos.push([+a.toFixed(2), +b.toFixed(2)]); return tono(0.5, 4); } };
await mezclarVentana({ proyecto: T.dividir(p, id, 2), lectorDe: async () => lector, desde: 2.5, hasta: 3, tasa: TASA }); ok(pedidos.length === 1 && pedidos[0][0] >= 2.4 && pedidos[0][1] <= 3.1, "pide sólo el tramo de la ventana " + JSON.stringify(pedidos));
// presets
ok(PRESETS.length >= 6 && new Set(PRESETS.map(x => x.id)).size === PRESETS.length, "presets con id único");
for (const x of PRESETS) ok(x.ancho % 2 === 0 && x.alto % 2 === 0 && ["mp4", "webm"].includes(x.contenedor) && x.bitrate > 0 && x.fps > 0, "preset válido " + x.id);
ok(aplicarPreset("youtube").salida.ancho === 1920 && aplicarPreset("web").contenedor === "webm", "aplicarPreset");

// navegador: vídeo con sonido de punta a punta
const tmp = path.join(os.tmpdir(), "clip-sonido.mp4"), nav = await abrir("escritorio"), { page } = nav;
const b64 = await page.evaluate(async () => {
  const I = await import("/plugins/video/media/importar.js"), e = await I.crearCodificador({ ancho: 320, alto: 240, fps: 30, contenedor: "mp4", audio: true });
  const c = Object.assign(document.createElement("canvas"), { width: 320, height: 240 }), x = c.getContext("2d");
  for (let i = 0; i < 60; i++) { x.fillStyle = `hsl(${i * 6},70%,50%)`; x.fillRect(0, 0, 320, 240); await e.anadir(c, i / 30, 1 / 30); }
  const s = new Float32Array(96000); for (let i = 0; i < s.length; i++) s[i] = 0.4 * Math.sin(2 * Math.PI * 440 * i / 48000); await e.anadirAudio([s, s], 48000);
  const buf = new Uint8Array(await (await e.cerrar()).arrayBuffer()); let t = ""; for (let i = 0; i < buf.length; i += 8192) t += String.fromCharCode(...buf.subarray(i, i + 8192)); return btoa(t);
});
fs.writeFileSync(tmp, Buffer.from(b64, "base64"));
await page.evaluate(async () => { await (await import("/plugins/video/index.js")).openVideo(); });
const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click('.vid-barra [data-a="anadir"]')]); await fc.setFiles(tmp);
await page.waitForFunction(() => window.__video?.p().pistas.some(t => t.clips.length), null, { timeout: 30000 }).catch(() => {});
ok(await page.evaluate(() => Object.values(window.__video.p().medios).every(m => m.audio === true)), "el medio importado marca que tiene audio");
// preset desde el panel de escritorio
await page.evaluate(async () => { const T = await import("/plugins/video/timeline/ops.js"), V = window.__video, c = V.p().pistas[0].clips[0]; V.hist.hacer(p => T.cambiarVolumen(p, c.id, 0.8), "vol"); });
// exportar con la interfaz y volver a leer el archivo
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }).catch(() => null), page.click('.fsp-actions [data-a="apply"]')]);
ok(dl, "la exportación descarga"); if (dl) {
  const f = path.join(os.tmpdir(), "salida-sonido.mp4"); await dl.saveAs(f); const b = fs.readFileSync(f).toString("base64");
  const info = await page.evaluate(async b64 => {
    const M = await import("/js/vendor/mediabunny/mediabunny.min.mjs"), bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), inp = new M.Input({ source: new M.BlobSource(new Blob([bin])), formats: M.ALL_FORMATS }), a = await inp.getPrimaryAudioTrack();
    if (!a) return { audio: false }; let max = 0, n = 0; for await (const w of new M.AudioBufferSink(a).buffers(0.3, 1.5)) { const d = w.buffer.getChannelData(0); for (let i = 0; i < d.length; i++) max = Math.max(max, Math.abs(d[i])); n += d.length; }
    return { audio: true, codec: a.codec, max, dur: await inp.computeDuration() };
  }, b);
  ok(info.audio, "el archivo exportado tiene pista de sonido"); ok(info.max > 0.2 && info.max < 0.45, `el tono suena al volumen del clip (80 % de 0,4 ≈ 0,32): ${info.max?.toFixed(3)}`); ok(Math.abs(info.dur - 2) < 0.3, "dura ~2 s (" + info.dur + ")");
  console.log("audio exportado:", JSON.stringify(info));
}
ok(nav.errs.length === 0, "sin errores de página: " + nav.errs.join(" | "));
await nav.cerrar();
console.log(fallos ? `${fallos} fallos` : "OK · audio y exportación"); process.exit(fallos ? 1 : 0);
