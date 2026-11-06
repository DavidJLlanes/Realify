/* ═══════════════════════════════════════════════════════════════
   PRUEBA · el menú IA, el cajón y ☰ muestran el mismo árbol (F1.8)
   Comprueba, en escritorio y en móvil: cada comando IA aparece UNA sola vez; el orden es el mismo en el menú, en la pestaña IA
   del cajón y en ☰; los chips del cajón son los submenús (+ «Todo») y filtran; los submenús vacíos no se ven; «Vídeo» queda
   oculto mientras no tenga entradas; las funciones de manifiesto salen en sus pestañas afines (y nunca en Básicos/Automáticos).
   Uso: node tests/ia/menu-ia.mjs
   ═══════════════════════════════════════════════════════════════ */
import { abrir, documentoDePrueba } from "./lib/navegador.mjs";

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Árbol esperado, leído de los datos (lo que ve la persona sale de aquí). */
async function arbol(page) {
  return page.evaluate(async () => {
    const { MENUS } = await import("/js/ui/menu.js");
    const { MANIFESTS } = await import("/js/ui/menu/ia/manifests.js");
    const ia = MENUS.find(m => m.label === "Inteligencia Artificial");
    const subs = ia.items.filter(i => i.submenu).map(i => ({ label: i.label, id: i.iaId, cmds: i.submenu.filter(x => x.cmd).map(x => x.cmd), labels: i.submenu.filter(x => x.cmd).map(x => x.label) }));
    return { subs, video: MENUS.find(m => m.label === "Vídeo")?.items.length ?? -1,
      manifiestos: MANIFESTS.map(m => ({ cmd: m.cmd, tabs: m.tabs || [] })) };
  });
}

/* ── escritorio ── */
{
  const e = await abrir("escritorio");
  const t = await arbol(e.page);
  const todos = t.subs.flatMap(s => s.cmds);
  ok(todos.length === new Set(todos).size, "algún comando IA está repetido en el menú: " + todos.filter((c, i) => todos.indexOf(c) !== i));
  ok(t.subs.every(s => s.cmds.length), "hay un submenú vacío en el menú");
  ok(t.subs.length <= 13, "más de 13 submenús");
  const raices = await e.page.$$eval(".menu-root", b => b.map(x => x.textContent.trim()));
  ok(raices.includes("Inteligencia Artificial"), "falta el menú IA en la barra");
  ok(!raices.includes("Vídeo") || t.video > 0, "«Vídeo» aparece en la barra sin tener entradas");
  await e.page.evaluate(() => [...document.querySelectorAll(".menu-root")].find(b => b.textContent.trim() === "Inteligencia Artificial").click());
  await e.page.waitForTimeout(200);
  const filas = await e.page.$$eval(".menu-pop > .menu-item-parent", b => b.map(x => x.textContent.replace("›", "").trim()));
  ok(igual(filas, t.subs.map(s => s.label)), "el menú de escritorio no lista los submenús en orden: " + filas);
  // abre el primero y comprueba sus entradas
  await e.page.evaluate(() => document.querySelector(".menu-pop > .menu-item-parent").click());
  await e.page.waitForTimeout(150);
  const hijos = await e.page.$$eval(".menu-sub .menu-item", b => b.map(x => x.querySelector("span:not(.mi):not(.k)").textContent.trim()));
  ok(igual(hijos, t.subs[0].labels.map(l => l.trim())), "las entradas del primer submenú no coinciden: " + hijos);
  ok(e.errs.length === 0, "errores de página (escritorio): " + e.errs.join("; "));
  await e.cerrar();
}

/* ── móvil ── */
{
  const m = await abrir("movil");
  const t = await arbol(m.page);
  const esperado = t.subs.flatMap(s => s.cmds);
  await documentoDePrueba(m.page);
  await m.page.locator("#toolsHandle").click({ timeout: 5000 });
  await m.page.waitForTimeout(600);
  await m.page.evaluate(() => document.querySelector('#toolDrawer .td-tab[data-cat="ia"]').click());
  await m.page.waitForTimeout(250);
  const leer = () => m.page.$$eval("#toolDrawer .td-sec, #toolDrawer .td-item", els => els.map(e => e.classList.contains("td-sec") ? "§" + e.textContent.trim() : e.querySelector(".td-label").textContent.trim()));
  const todo = await leer();
  ok(igual(todo.filter(x => x[0] === "§"), t.subs.map(s => "§" + s.label)), "las secciones de la pestaña IA no son los submenús en orden");
  ok(todo.filter(x => x[0] !== "§").length === esperado.length, `la pestaña IA tiene ${todo.filter(x => x[0] !== "§").length} entradas y el menú ${esperado.length}`);
  const chips = await m.page.$$eval("#toolDrawer .td-chip", b => b.map(x => x.textContent.trim()));
  ok(igual(chips, ["Todo", ...t.subs.map(s => s.label)]), "los chips no son «Todo» + los submenús: " + chips);
  // un chip filtra a su submenú; con búsqueda se busca en todos
  const n = Math.min(2, t.subs.length - 1);
  await m.page.evaluate(i => document.querySelectorAll("#toolDrawer .td-chip")[i].click(), n + 1);
  await m.page.waitForTimeout(200);
  const f = await leer();
  ok(f.filter(x => x[0] === "§").length === 1 && f[0] === "§" + t.subs[n].label, "el chip no filtra a su submenú: " + f.slice(0, 3));
  ok(f.length - 1 === t.subs[n].cmds.length, "el chip muestra un número de entradas distinto al del submenú");
  await m.page.evaluate(() => document.querySelector('#toolDrawer .td-chip').click());
  await m.page.waitForTimeout(150);
  await m.page.fill("#toolDrawer .td-search input", "cielo");
  await m.page.waitForTimeout(200);
  ok((await leer()).length > 0, "la búsqueda no encuentra «cielo» en la pestaña IA");
  await m.page.fill("#toolDrawer .td-search input", "");
  // cada comando IA nuevo sale en sus pestañas afines y nunca en Básicos/Automáticos
  for (const mf of t.manifiestos) {
    ok(!mf.tabs.includes("basicos") && !mf.tabs.includes("auto"), `${mf.cmd} declara basicos o auto`);
    for (const tab of ["todos", ...mf.tabs]) {
      await m.page.evaluate(id => document.querySelector(`#toolDrawer .td-tab[data-cat="${id}"]`).click(), tab);
      await m.page.waitForTimeout(150);
      ok((await leer()).length > 0, `${mf.cmd}: la pestaña ${tab} está vacía`);
    }
  }
  const tabs = await m.page.$$eval("#toolDrawer .td-tab", b => b.map(x => x.dataset.cat));
  ok(tabs.includes("video") === (t.video > 0), "la pestaña «Vídeo» se ve sin entradas (o falta con ellas)");
  await m.page.evaluate(() => document.querySelector("#toolsHandle").click());
  await m.page.waitForTimeout(300);

  // ☰: un título por submenú, entradas en el mismo orden
  await m.page.evaluate(() => document.querySelector("#mobilebarMenu")?.click());
  await m.page.waitForTimeout(300);
  const lista = await m.page.$$eval(".menu-pop .section-label, .menu-pop .menu-item", els => els.map(e => e.classList.contains("section-label") ? "§" + e.textContent.trim() : e.querySelector("span:not(.mi):not(.k)")?.textContent.trim()));
  const i0 = lista.indexOf("§Inteligencia Artificial");
  ok(i0 >= 0, "☰ no tiene la sección «Inteligencia Artificial» (¿cambió el botón del menú?)");
  if (i0 >= 0) {
    const resto = lista.slice(i0 + 1);
    const fin = resto.findIndex(x => x === "§Vídeo" || x === "§Análisis");   // la sección de IA acaba donde empieza la siguiente (Vídeo, desde F15.8)
    const ia = resto.slice(0, fin < 0 ? undefined : fin);
    ok(igual(ia.filter(x => x[0] === "§"), t.subs.map(s => "§" + s.label)), "☰: los títulos de submenú no coinciden: " + ia.filter(x => x[0] === "§"));
    ok(ia.filter(x => x[0] !== "§").length === esperado.length, "☰: número de entradas IA distinto del menú");
    ok(!ia.some(x => x && x.includes(": ")), "☰: las entradas IA llevan prefijo «Grupo: »");
    ok(!lista.includes("§Vídeo") || t.video > 0, "☰ muestra «Vídeo» sin entradas");
  }
  ok(m.errs.length === 0, "errores de página (móvil): " + m.errs.join("; "));
  await m.cerrar();
}

console.log(fallos ? "menú IA: FALLO" : "menú IA: OK");
process.exit(fallos ? 1 : 0);
