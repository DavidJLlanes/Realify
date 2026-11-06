/* ═══════════════════════════════════════════════════════════════
   VÍDEO · MEDICIÓN DE RENDIMIENTO DEL EDITOR (F15.9)
   En el navegador de desarrollo (Chromium sin ventana, GPU por software: PEOR que un móvil con GPU, MEJOR en CPU que un móvil modesto) mide: ms por fotograma de cada efecto a 480 px (vista previa) y a
   1080×1920 (exportación), y la velocidad de exportación de un clip de 3 s sin efectos y con efecto de color. También comprueba que el arranque de la web NO carga nada del módulo de vídeo.
   Uso: CHROME_EXE=/usr/bin/google-chrome node tools/video/rendimiento.mjs   ·   Salida: docs/video-medidas/rendimiento-desarrollo.json y un resumen. Límite: no es un móvil.
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import http from "node:http";
import { abrir } from "../../tests/ia/lib/navegador.mjs";

const nav = await abrir("escritorio"), { page } = nav;
// arranque: ¿se pidió algo de plugins/video? (la página ya cargó en abrir(); se mira el rendimiento de recursos)
const arranque = await page.evaluate(() => performance.getEntriesByType("resource").map(r => r.name).filter(n => /plugins\/video|mediabunny/.test(n)));
const r = await page.evaluate(async () => {
  const L = await import("/plugins/video/effects/lista.js"), R = await import("/plugins/video/effects/registro.js"), reg = R.crearRegistroEfectos(); L.registrarTodos(reg);
  const ms = async (fn, n) => { await fn(); const t0 = performance.now(); for (let i = 0; i < n; i++) await fn(i); return +((performance.now() - t0) / n).toFixed(1); };
  const marco = (w, h) => { const c = Object.assign(document.createElement("canvas"), { width: w, height: h }), x = c.getContext("2d"), g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#c33"); g.addColorStop(1, "#36c"); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = "#fff"; x.fillRect(w * .3, h * .3, w * .3, h * .3); return c; };
  const out = { efectos: {} }, alfaDe = async () => { const n = 512, a = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) a[y * n + x] = x > 150 && x < 360 ? 1 : 0; return { alfa: a, n }; };
  const casos = [["color", { exposicion: 0.5, saturacion: 20, temperatura: 20 }], ["sensor", { dosis: 100 }], ["camaras", { estilo: "vhs", intensidad: 100 }], ["estabilizar", { fuerza: 60, recorte: 8 }], ["fondo(sin modelo)", { modo: "desenfoque", fuerza: 70, estable: 55 }]];
  for (const [w, h, etiqueta] of [[270, 480, "vista previa 270×480"], [1080, 1920, "salida 1080×1920"]]) {
    const src = marco(w, h);
    for (const [id, params] of casos) {
      let inst; try { inst = id.startsWith("fondo") ? (await import("/plugins/video/effects/fondo/efecto.js")).crear({ alfaDe }) : await reg.instanciar(id, { ancho: w, alto: h, fps: 30 }); inst.prepare?.({ fps: 30 }); out.efectos[id] = out.efectos[id] || {}; out.efectos[id][etiqueta] = await ms(async i => inst.process(src, params, (i || 0) / 30), w > 500 ? 5 : 15); }
      catch (e) { out.efectos[id] = { ...(out.efectos[id] || {}), [etiqueta]: "error: " + e.message }; } finally { inst?.dispose?.(); }
    }
  }
  // exportación de extremo a extremo: 3 s a 30 fps, 720×1280, sin efectos
  const I = await import("/plugins/video/media/importar.js"), E = await import("/plugins/video/ui/exportar.js"), P = await import("/plugins/video/project/modelo.js"), T = await import("/plugins/video/timeline/ops.js"), M = await import("/plugins/video/ui/motor-dom.js");
  const cod = await I.crearCodificador({ ancho: 320, alto: 240, fps: 30, contenedor: "mp4" }), c = marco(320, 240); for (let i = 0; i < 90; i++) await cod.anadir(c, i / 30, 1 / 30);
  const archivo = new File([await cod.cerrar()], "p.mp4", { type: "video/mp4" }), ab = await I.abrirMedio(archivo, { ancho: 720 });
  for (const [nombre, efecto] of [["sin efectos", null], ["con color", ["color", { exposicion: 0.4 }]]]) {
    let p = P.crearProyecto({ ancho: 720, alto: 1280, fps: 30 }); p.medios.m = { ...ab.medio }; p = { ...p, pistas: [P.crearPista("video", { id: "v" })] }; p = T.anadirClip(p, "v", "m", {}); if (efecto) p = T.ponerEfecto(p, p.pistas[0].clips[0].id, efecto[0], efecto[1]);
    const t0 = performance.now(), res = await E.exportarProyecto({ proyecto: p, movil: false, contenedor: "mp4", sonido: false, lectorDe: async () => null, motorDe: (pr, ancho) => M.motorDom({ proyecto: () => pr, lectorDe: async () => ({ fotograma: t => ab.lector.fotograma(t), cerrar(){} }), cacheMax: 4 }) });
    out["exportar 3 s 720×1280 " + nombre] = { segundos: +((performance.now() - t0) / 1000).toFixed(2), ms_por_fotograma: +((performance.now() - t0) / 90).toFixed(1), codec: res.codec, bytes: res.blob.size };
  }
  out.memoriaJS_MB = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  return out;
});
r.arranqueCargaVideo = arranque; r.nota = "Chromium sin ventana, GPU por software. Orientativo: un móvil con GPU será más rápido en WebGL y más lento en CPU."; r.fecha = new Date().toISOString().slice(0, 10);
fs.mkdirSync("docs/video-medidas", { recursive: true }); fs.writeFileSync("docs/video-medidas/rendimiento-desarrollo.json", JSON.stringify(r, null, 1));
console.log("arranque carga vídeo:", arranque.length ? arranque : "nada (bien)"); console.log(JSON.stringify(r.efectos, null, 1)); console.log(JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k.startsWith("exportar"))), null, 1), "memoria JS MB:", r.memoriaJS_MB);
await nav.cerrar();
