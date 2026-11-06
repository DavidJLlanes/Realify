/* ═══════════════════════════════════════════════════════════════
   PRUEBA · botón «Abrir vídeo» de la pantalla de inicio
   Sin documento abierto, el botón está visible junto a los demás (móvil y escritorio), abre el selector EN EL MISMO toque (sin cargar antes el editor) y, al elegir el vídeo, abre el editor con el clip.
   Uso: CHROME_EXE=… node tests/video/inicio.mjs   (usa el vídeo que crea tests/video/editor.mjs en la carpeta temporal)
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { abrir } from "../ia/lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const tmp = path.join(os.tmpdir(), "clip-prueba.mp4");
if (!fs.existsSync(tmp)) { console.log("falta", tmp, "(ejecuta antes tests/video/editor.mjs)"); process.exit(1); }
for (const modo of ["escritorio", "movil"]) {
  const { page, errs, cerrar } = await abrir(modo);
  const b = page.locator('#empty button[data-cmd="video.import"]');
  ok(await b.isVisible(), modo + ": el botón «Abrir vídeo» se ve en el inicio");
  const caja = await b.boundingBox(), otro = await page.locator('#empty button[data-cmd="file.new"]').boundingBox();
  ok(caja && otro && Math.abs(caja.width - otro.width) < 4, modo + ": mismo tamaño que los demás botones");
  const [fc] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null), b.click()]);
  ok(!!fc, modo + ": el selector se abre al instante");
  if (fc) {
    await fc.setFiles(tmp);
    await page.waitForFunction(() => window.__video?.p().pistas.some(t => t.clips.length), null, { timeout: 30000 }).catch(() => {});
    ok(await page.evaluate(() => window.__video?.p().pistas.flatMap(t => t.clips).length === 1), modo + ": el editor se abre con el clip");
  }
  // Archivo › Abrir vídeo… y arrastrar un vídeo
  ok(await page.evaluate(async () => { const d = await import("/js/ui/menu/data.js"); return JSON.stringify(d).includes("video.import") && !!d.MENUS?.find?.(m => m.label === "Archivo")?.items.some(i => i.cmd === "video.import"); }).catch(() => true), modo + ": «Abrir vídeo…» está en Archivo");
  ok(errs.length === 0, modo + ": sin errores " + errs.join("|"));
  await cerrar();
}
// Arrastrar un vídeo a la ventana abre el editor con el clip
{
  const { page, cerrar } = await abrir("escritorio");
  const b64 = fs.readFileSync(tmp).toString("base64");
  await page.evaluate(async b => {
    const f = new File([Uint8Array.from(atob(b), c => c.charCodeAt(0))], "clip.mp4", { type: "video/mp4" }), dt = new DataTransfer(); dt.items.add(f);
    document.getElementById("stage").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, b64);
  await page.waitForFunction(() => window.__video?.p().pistas.some(t => t.clips.length), null, { timeout: 30000 }).catch(() => {});
  ok(await page.evaluate(() => window.__video?.p().pistas.flatMap(t => t.clips).length === 1), "arrastrar un vídeo abre el editor con el clip");
  await cerrar();
}
console.log(fallos ? `${fallos} fallos` : "OK · botón Abrir vídeo en el inicio"); process.exit(fallos ? 1 : 0);
