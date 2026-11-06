/* ═══════════════════════════════════════════════════════════════
   PRUEBA · el proyecto de vídeo se guarda y se recupera en otra sesión
   Añade un vídeo, espera al autoguardado, recarga la página (otra «sesión») y reabre el editor: el clip, y el vídeo, siguen ahí y la vista previa se pinta. «Nuevo» lo borra.
   Uso: CHROME_EXE=… node tests/video/guardado.mjs   (usa el vídeo que crea tests/video/editor.mjs en la carpeta temporal)
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { abrir } from "../ia/lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const tmp = path.join(os.tmpdir(), "clip-prueba.mp4");
if (!fs.existsSync(tmp)) { console.log("falta", tmp, "(ejecuta antes tests/video/editor.mjs)"); process.exit(1); }
const { page, errs, cerrar } = await abrir("escritorio");
await page.evaluate(async () => { const m = await import("/plugins/video/index.js"); await m.openVideo(); });
const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click('.vid-barra [data-a="anadir"]')]);
await fc.setFiles(tmp);
await page.waitForFunction(() => window.__video?.p().pistas.some(t => t.clips.length), null, { timeout: 30000 });
await page.waitForTimeout(2500);   // autoguardado (1,2 s)
await page.reload(); await page.waitForTimeout(1500);
await page.evaluate(async () => { const m = await import("/plugins/video/index.js"); await m.openVideo(); });
await page.waitForFunction(() => window.__video?.p().pistas.some(t => t.clips.length), null, { timeout: 30000 }).catch(() => {});
ok(await page.evaluate(() => window.__video?.p().pistas.flatMap(t => t.clips).length === 1), "tras recargar, el clip sigue en el proyecto");
await page.evaluate(() => window.__video.rep().buscar(0.5)); await page.waitForTimeout(1000);
const pintado = await page.evaluate(() => { const v = document.querySelector(".fsp.vid .fsp-stage canvas"), d = v.getContext("2d").getImageData(0, 0, v.width, v.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return n; });
ok(pintado > 200, "el vídeo recuperado se pinta en la vista previa (" + pintado + ")");
// «Nuevo» borra el proyecto y lo guardado
await page.click('.vid-barra [data-a="nuevo"]'); await page.locator(".modal button.primary").click({ timeout: 5000 }); await page.waitForTimeout(800);
ok(await page.evaluate(() => window.__video.p().pistas.flatMap(t => t.clips).length === 0), "«Nuevo» vacía el proyecto");
await page.reload(); await page.waitForTimeout(1200);
await page.evaluate(async () => { const m = await import("/plugins/video/index.js"); await m.openVideo(); }); await page.waitForTimeout(1200);
ok(await page.evaluate(() => window.__video.p().pistas.flatMap(t => t.clips).length === 0), "tras «Nuevo» y recargar no reaparece nada");
ok(errs.length === 0, "sin errores " + errs.join("|"));
await cerrar(); console.log(fallos ? `${fallos} fallos` : "OK · guardado del proyecto de vídeo"); process.exit(fallos ? 1 : 0);
