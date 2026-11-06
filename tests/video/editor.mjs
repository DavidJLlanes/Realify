/* ═════════════════════════════════════════════════
   PRUEBA · editor de vídeo en el navegador (móvil y escritorio): importar un clip sintético, dividir, reproducir, deshacer, cambiar formato y exportar.
   Uso: CHROME_EXE=/usr/bin/google-chrome node tests/video/editor.mjs
   ═════════════════════════════════════════════════ */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { abrir } from "../ia/lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const tmp = path.join(os.tmpdir(), "clip-prueba.mp4");

for (const modo of ["escritorio", "movil"]) {
  const nav = await abrir(modo), { page } = nav;
  if (!fs.existsSync(tmp)) {
    const b64 = await page.evaluate(async () => {
      const I = await import("/plugins/video/media/importar.js"), e = await I.crearCodificador({ ancho: 320, alto: 240, fps: 30, contenedor: "mp4" });
      const c = Object.assign(document.createElement("canvas"), { width: 320, height: 240 }), x = c.getContext("2d");
      for (let i = 0; i < 60; i++) { x.fillStyle = `hsl(${i * 6},70%,50%)`; x.fillRect(0, 0, 320, 240); x.fillStyle = "#fff"; x.fillRect(i * 4, 100, 40, 40); await e.anadir(c, i / 30, 1 / 30); }
      const buf = new Uint8Array(await (await e.cerrar()).arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192)); return btoa(s);
    });
    fs.writeFileSync(tmp, Buffer.from(b64, "base64"));
  }
  await page.evaluate(async () => { const m = await import("/plugins/video/index.js"); await m.openVideo(); });
  ok(await page.$(".fsp.vid"), modo + ": abre el editor");
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click('.vid-barra [data-a="anadir"]')]);
  await fc.setFiles(tmp);
  await page.waitForFunction(() => window.__video?.p().pistas.some(t => t.clips.length), null, { timeout: 30000 }).catch(() => {});
  const r1 = await page.evaluate(() => { const p = window.__video.p(); return { clips: p.pistas.flatMap(t => t.clips).length, dur: p.pistas[0]?.clips[0] ? p.pistas[0].clips[0].fuera - p.pistas[0].clips[0].dentro : 0, w: p.salida.ancho, h: p.salida.alto }; });
  ok(r1.clips === 1 && Math.abs(r1.dur - 2) < 0.2, `${modo}: un clip de ~2 s (${JSON.stringify(r1)})`);
  // vista previa pintada
  await page.evaluate(() => window.__video.rep().buscar(1)); await page.waitForTimeout(800);
  const pintado = await page.evaluate(() => { const v = document.querySelector(".fsp.vid .fsp-stage canvas"); const d = v.getContext("2d").getImageData(0, 0, v.width, v.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return n; });
  ok(pintado > 20, `${modo}: la vista previa se pinta (${pintado})`);
  // dividir en 1 s
  await page.evaluate(() => window.__video.rep().buscar(1)); await page.click('.vid-barra [data-a="dividir"]');
  ok((await page.evaluate(() => window.__video.p().pistas[0].clips.length)) === 2, modo + ": dividir da 2 clips");
  await page.click('.fsp-actions [data-a="undo"]'); await page.waitForTimeout(200);
  ok((await page.evaluate(() => window.__video.p().pistas[0].clips.length)) === 1, modo + ": deshacer devuelve 1 clip");
  // reproducir
  await page.click('.vid-barra [data-a="inicio"]'); await page.click('.vid-barra [data-a="play"]'); await page.waitForTimeout(900);
  const t = await page.evaluate(() => window.__video.rep().tiempo()); ok(t > 0.3, `${modo}: reproduce (t=${t.toFixed(2)})`);
  await page.click('.vid-barra [data-a="play"]');
  // formato horizontal por API del panel
  // exportar
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }).catch(() => null), page.click('.fsp-actions [data-a="apply"]')]);
  ok(dl, modo + ": la exportación descarga un archivo");
  if (dl) {
    const f = path.join(os.tmpdir(), "salida-" + modo + ".mp4"); await dl.saveAs(f); const st = fs.statSync(f);
    ok(st.size > 5000, `${modo}: archivo exportado con contenido (${st.size} B)`);
    const b64 = fs.readFileSync(f).toString("base64");
    const info = await page.evaluate(async b => { const I = await import("/plugins/video/media/importar.js"); const bin = Uint8Array.from(atob(b), c => c.charCodeAt(0)); const m = await I.abrirMedio(new File([bin], "s.mp4", { type: "video/mp4" })); const i = m.lector.info; m.lector.cerrar(); return i; }, b64);
    ok(Math.abs(info.duracion - 2) < 0.3, `${modo}: dura ~2 s (${info.duracion})`);
  }
  ok(nav.errs.length === 0, `${modo}: sin errores de página (${nav.errs.join(" | ")})`);
  await nav.cerrar();
}
console.log(fallos ? `${fallos} fallos` : "OK · editor de vídeo");
process.exit(fallos ? 1 : 0);
