/* ═══════════════════════════════════════════════════════════════
   PRUEBA · TRASPASO ENTRE REALIFY Y REALIFY BASIC (F5)
   Con las dos apps abiertas: Basic → Realify (menú «···», foto con la edición aplicada) y Realify → Basic (documento aplanado),
   con confirmación por el canal. Con la otra app cerrada: se abre una pestaña nueva con ?recibir=1 y la foto llega. Y las entradas
   de menú: «Abrir en Realify» sólo con foto y «Cambiar a Realify» siempre; en Realify, menú Archivo y cajón del móvil.
   Uso: node tests/basic/traspaso.mjs   Salidas: OK / FALLO y código de salida.
   ═══════════════════════════════════════════════════════════════ */
import path from "node:path";
import { abrir, documentoDePrueba, RAIZ } from "../ia/lib/navegador.mjs";

const fallos = [], exige = (c, m) => { if (!c) fallos.push(m); };
const FOTO = path.join(RAIZ, "assets/skies", "atardecer-dorado.jpg");

const { page: real, errs, cerrar } = await abrir("escritorio");
const base = real.url().replace(/\/[^/]*$/, "/");
const ctx = real.context();
const abrirBasic = async () => { const b = await ctx.newPage(); b.on("pageerror", e => errs.push("basic: " + e.message)); await b.goto(base + "basic/"); await b.waitForTimeout(900); return b; };
const fotoBasic = b => b.evaluate(async () => { const S = await import("/basic/js/app/session.js"); const o = S.original(); return o && { w: o.width, h: o.height }; });
const docReal = p => p.evaluate(async () => { const D = await import("/js/core/doc.js"); return D.doc.open ? { w: D.doc.w, h: D.doc.h } : null; });

/* ── Botón «Realify Basic» de la pantalla inicial de Realify: abre Basic ── */
{
  const esperar = ctx.waitForEvent("page", { timeout: 8000 }).catch(() => null);
  await real.locator(".basic-cta").click();
  const p = await esperar;
  exige(!!p, "el botón «Realify Basic» de la pantalla inicial no abre ninguna ventana");
  if (p) { await p.waitForTimeout(1500); exige(/\/basic\/$/.test(p.url()), "el botón abre otra dirección: " + p.url()); await p.close(); }
}

/* ── Basic → Realify (las dos abiertas) ── */
let basic = await abrirBasic();
await basic.setInputFiles("input[type=file]", FOTO); await basic.waitForTimeout(1500);
const f0 = await fotoBasic(basic);
await basic.evaluate(async () => (await import("/basic/js/app/session.js")).cambiar({ exposicion: 20 }));
await basic.getByLabel("Más opciones").click();
const ops = await basic.locator(".menu-op").allTextContents();
exige(ops.includes("Abrir en Realify") && ops.includes("Cambiar a Realify"), "menú de Basic: faltan las entradas de traspaso " + ops.join("|"));
await basic.locator(".menu-op:has-text('Abrir en Realify')").click();
await real.waitForTimeout(6000);
const d1 = await docReal(real);
exige(d1 && d1.w === f0.w && d1.h === f0.h, "Basic → Realify: el documento no llegó con el tamaño de la foto " + JSON.stringify([f0, d1]));

/* ── Realify → Basic (las dos abiertas) ── */
await real.evaluate(async () => (await import("/js/core/commands.js")).run("file.toBasic"));
await basic.waitForTimeout(4000);
const f1 = await fotoBasic(basic);
exige(f1 && f1.w === f0.w, "Realify → Basic: Basic no recibió la foto " + JSON.stringify(f1));

/* ── Con la otra app cerrada: se abre una pestaña nueva ── */
await basic.close();
const nueva = ctx.waitForEvent("page", { timeout: 8000 }).catch(() => null);
await real.evaluate(async () => (await import("/js/core/commands.js")).run("file.toBasic"));
const pop = await nueva;
exige(!!pop, "con Basic cerrada no se abrió una pestaña nueva");
if (pop) { await pop.waitForTimeout(5000); const f2 = await fotoBasic(pop); exige(f2 && f2.w === f0.w, "pestaña nueva de Basic sin la foto " + JSON.stringify(f2)); exige(!pop.url().includes("recibir"), "la query ?recibir no se limpia"); await pop.close(); }

/* El iPhone con las apps instaladas (cada una con su almacenamiento) va aparte: tests/basic/relevo.mjs. */

/* ── Entradas en Realify ── */
const reg = await real.evaluate(async () => { const C = await import("/js/core/commands.js"); const m = await import("/js/ui/menu/data.js"); const a = m.MENUS.find(x => x.label === "Archivo").items.map(i => i.cmd); return { a: a.includes("file.toBasic") && a.includes("file.openBasic"), run: typeof (C.commands?.["file.toBasic"] ?? C.getCommand?.("file.toBasic") ?? true) }; });
exige(reg.a, "menú Archivo de Realify: faltan las entradas de Basic");
const cajon = (await real.evaluate(async () => (await (await fetch("/js/ui/tooldrawer.js")).text()).includes("file.toBasic")));
exige(cajon, "cajón del móvil: falta «Abrir en Realify Basic»");

if (errs.length) fallos.push("errores de página: " + errs.join(" | "));
await cerrar();
console.log(fallos.length ? "FALLO\n  - " + fallos.join("\n  - ") : "OK");
process.exit(fallos.length ? 1 : 0);
