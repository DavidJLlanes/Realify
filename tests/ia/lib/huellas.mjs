/* ═══════════════════════════════════════════════════════════════
   PRUEBAS IA · HUELLAS DEL MENÚ Y DEL CAJÓN
   Lee, tal como los ve la persona, el menú «Inteligencia Artificial» (escritorio) y todas las pestañas del cajón
   «Herramientas» (móvil), en orden. Sirve para la línea base y para comprobar que lo que no se debe tocar no cambia.
   Salidas: menuIA() → lista de entradas · cajon() → { pestañas, contenido por pestaña }.
   ═══════════════════════════════════════════════════════════════ */

/** Entradas del menú IA tal como están en MENUS: etiqueta, comando, corona y ayuda (con encabezados de sección). */
export async function menuIA(page) {
  return page.evaluate(async () => {
    const { MENUS } = await import("/js/ui/menu.js");
    const ia = MENUS.find(m => m.label === "Inteligencia Artificial");
    const plano = items => items.map(i => i.items || i.submenu
      ? { label: i.label, hijos: plano(i.items || i.submenu) }
      : i.sep ? { sep: true }
      : i.header ? { header: i.header }
      : { cmd: i.cmd, label: i.label, premium: !!i.premium, help: i.help || "" });
    return { barra: MENUS.map(m => m.label), ia: plano(ia.items) };
  });
}

import { documentoDePrueba } from "./navegador.mjs";

/** Contenido de cada pestaña del cajón: secciones y entradas en orden, con corona y estado. */
export async function cajon(page) {
  await documentoDePrueba(page);   // el tirador del cajón sólo aparece con un documento abierto
  await page.locator("#toolsHandle").click({ timeout: 5000 });
  await page.waitForTimeout(700);
  const ids = await page.$$eval("#toolDrawer .td-tab", ts => ts.map(t => ({ id: t.dataset.cat, texto: t.textContent.trim() })));
  const contenido = {};
  for (const { id } of ids) {
    await page.evaluate(id => document.querySelector(`#toolDrawer .td-tab[data-cat="${id}"]`).click(), id);
    await page.waitForTimeout(200);
    contenido[id] = await page.$$eval("#toolDrawer .td-sec, #toolDrawer .td-item", els => els.map(e =>
      e.classList.contains("td-sec") ? { seccion: e.textContent.trim() }
        : { etiqueta: e.querySelector(".td-label")?.textContent.trim(), corona: !!e.querySelector(".td-crown"), auto: e.classList.contains("td-auto") }));
  }
  return { pestanas: ids, contenido };
}
