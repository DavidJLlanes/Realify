/* ═══════════════════════════════════════════════════════════════
   PRUEBA · Buscador global («Buscar herramienta»)
   Escritorio: campo tras Ayuda, resultados con ruta y al elegir se ejecuta. Móvil: el cajón busca en todas las pestañas aunque se esté en
   otra. Uso: node tests/ia/buscador.mjs
   ═══════════════════════════════════════════════════════════════ */
import { abrir, documentoDePrueba } from "./lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { console.log((c ? "OK    " : "FALLO ") + m); if(!c) fallos++; };

{ const { page, errs, cerrar } = await abrir("escritorio"); await documentoDePrueba(page);
  const campo = page.locator("#globalSearch input");
  ok(await campo.count() === 1 && await campo.getAttribute("placeholder") === "Buscar herramienta", "escritorio: campo con el texto «Buscar herramienta»");
  ok(await page.evaluate(() => { const r = document.getElementById("menuRoots"), s = document.getElementById("globalSearch"); return r.nextElementSibling === s; }), "escritorio: va justo después de los menús (tras Ayuda)");
  await campo.fill("viñeteado");
  const items = await page.locator(".gsearch-item").allInnerTexts();
  ok(items.some(t => /Viñeteado/i.test(t)), "escritorio: «viñeteado» encuentra el filtro (" + items.length + " resultados)");
  await campo.fill("esponja");
  ok((await page.locator(".gsearch-item").allInnerTexts()).some(t => /Esponja/i.test(t)), "escritorio: «esponja» encuentra la herramienta");
  await page.locator(".gsearch-item", { hasText: "Esponja" }).first().dispatchEvent("mousedown");
  ok(await page.evaluate(async () => (await import("/js/editor/tools/tools.js")).current?.id === "sponge" || document.querySelector('[data-tool="sponge"].on') !== null), "escritorio: elegirla activa la herramienta");
  ok(errs.length === 0, "escritorio: sin errores " + errs.join("|")); await cerrar(); }

{ const { page, errs, cerrar } = await abrir("movil"); await documentoDePrueba(page);
  await page.locator("#toolsHandle").click(); await page.waitForTimeout(600);
  await page.locator('#toolDrawer .td-tab[data-cat="ia"]').click(); await page.waitForTimeout(200);
  await page.fill("#toolDrawer .td-search input", "viñeteado"); await page.waitForTimeout(300);
  const t = await page.locator("#toolDrawer .td-item").allInnerTexts();
  ok(t.some(x => /Viñeteado/i.test(x)), "móvil: desde la pestaña IA, «viñeteado» (que no es de IA) aparece (" + t.length + ")");
  await page.fill("#toolDrawer .td-search input", "esponja"); await page.waitForTimeout(300);
  ok((await page.locator("#toolDrawer .td-item").allInnerTexts()).some(x => /Esponja/i.test(x)), "móvil: «esponja» aparece");
  ok(errs.length === 0, "móvil: sin errores " + errs.join("|")); await cerrar(); }
process.exit(fallos ? 1 : 0);
