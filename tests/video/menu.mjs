/* ═════════════════════════════════════════════════
   PRUEBA · menú «Vídeo» (F15.8): barra de escritorio, ☰ y pestaña del cajón con el mismo contenido y orden, y los comandos video.* abren el editor (sin documento abierto).
   Uso: CHROME_EXE=… node tests/video/menu.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../ia/lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

{ // escritorio
  const e = await abrir("escritorio"), { page } = e;
  const datos = await page.evaluate(async () => { const { MENUS } = await import("/js/ui/menu.js"), v = MENUS.find(m => m.label === "Vídeo"); return { cmds: v.items.map(i => i.cmd), labels: v.items.map(i => i.label) }; });
  ok(datos.cmds.join() === "video.edit,video.import", "el menú tiene sus dos entradas en orden: " + datos.cmds);
  const raices = await page.$$eval(".menu-root", b => b.map(x => x.textContent.trim()));
  ok(raices.includes("Vídeo") && raices.indexOf("Vídeo") === raices.indexOf("Inteligencia Artificial") + 1, "«Vídeo» está en la barra junto a «Inteligencia Artificial»: " + raices);
  await page.evaluate(() => [...document.querySelectorAll(".menu-root")].find(b => b.textContent.trim() === "Vídeo").click()); await page.waitForTimeout(200);
  const filas = await page.$$eval(".menu-pop .menu-item", b => b.map(x => x.querySelector("span:not(.mi):not(.k)")?.textContent.trim()));
  ok(filas.join("|") === datos.labels.join("|"), "la barra lista las entradas del menú: " + filas);
  await page.evaluate(() => [...document.querySelectorAll(".menu-pop .menu-item")].find(b => b.textContent.includes("Editor de vídeo")).click()); await page.waitForTimeout(800);
  ok(await page.$(".fsp.vid"), "«Editor de vídeo…» abre el editor sin documento abierto");
  await page.evaluate(() => document.querySelector(".fsp.vid .fsp-close").click()); await page.waitForTimeout(200);
  ok(!(await page.$(".fsp.vid")), "el editor se cierra");
  // importar abre el selector de archivos
  await page.evaluate(() => [...document.querySelectorAll(".menu-root")].find(b => b.textContent.trim() === "Vídeo").click()); await page.waitForTimeout(200);
  const [fc] = await Promise.all([page.waitForEvent("filechooser", { timeout: 8000 }).catch(() => null), page.evaluate(() => [...document.querySelectorAll(".menu-pop .menu-item")].find(b => b.textContent.includes("Importar vídeo")).click())]);
  ok(fc, "«Importar vídeo…» pide los archivos al abrir");
  ok(e.errs.length === 0, "sin errores (escritorio): " + e.errs.join(" | ")); await e.cerrar();
}
{ // móvil: pestaña del cajón
  const m = await abrir("movil"), { page } = m;
  await page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(300, 200, { name: "p" }); D.addLayer({ name: "Fondo" }); });
  await page.locator("#toolsHandle").click({ timeout: 5000 }); await page.waitForTimeout(600);
  const tabs = await page.$$eval("#toolDrawer .td-tab", b => b.map(x => x.dataset.cat));
  ok(tabs[tabs.length - 1] === "video", "«Vídeo» es la última pestaña del cajón: " + tabs.slice(-3));
  await page.evaluate(() => document.querySelector('#toolDrawer .td-tab[data-cat="video"]').click()); await page.waitForTimeout(250);
  const items = await page.$$eval("#toolDrawer .td-item .td-label", b => b.map(x => x.textContent.trim()));
  ok(items.join("|") === "Editor de vídeo|Importar vídeo", "la pestaña tiene las mismas entradas y orden: " + items);
  await page.evaluate(() => [...document.querySelectorAll("#toolDrawer .td-item")].find(b => b.textContent.includes("Editor de vídeo")).click()); await page.waitForTimeout(900);
  ok(await page.$(".fsp.vid"), "desde el cajón se abre el editor");
  ok(m.errs.length === 0, "sin errores (móvil): " + m.errs.join(" | ")); await m.cerrar();
}
console.log(fallos ? `${fallos} fallos` : "OK · menú de vídeo"); process.exit(fallos ? 1 : 0);
