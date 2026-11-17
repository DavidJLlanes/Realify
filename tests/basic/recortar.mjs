/* ═══════════════════════════════════════════════════════════════
   PRUEBA · RECORTAR DE REALIFY BASIC (F3)
   Motor: la geometría (giro 90° intercambia lados, enderezar agranda el marco y el recorte automático cabe dentro, proporciones
   exactas, perspectiva) y la transformación de píxeles (voltear, girar). Interfaz: la pestaña muestra regla, fila y marco con 8
   asas; girar/voltear/proporción/regla escriben en la receta con un paso de historial; arrastrar el marco cambia el recorte;
   el guardado a resolución completa mide lo que el recorte; deshacer lo revierte. Móvil y escritorio.
   Uso: node tests/basic/recortar.mjs [carpeta_capturas]   Salidas: OK / FALLO y código de salida.
   ═══════════════════════════════════════════════════════════════ */
import path from "node:path";
import { abrir, RAIZ } from "../ia/lib/navegador.mjs";

const fallos = [], salida = process.argv[2];
const exige = (c, m) => { if (!c) fallos.push(m); };
const FOTO = path.join(RAIZ, "assets/skies", "atardecer-dorado.jpg");

const { page, errs, cerrar } = await abrir("escritorio");
const base = page.url().replace(/\/[^/]*$/, "/");
await page.goto(base + "basic/"); await page.waitForTimeout(500);

const m = await page.evaluate(async () => {
  const { calcularGeo, dentroDelQuad, RATIOS } = await import("/basic/js/engine/geometria.js");
  const { RECORTE0, esNeutra } = await import("/basic/js/engine/neutra.js");
  const { transformar } = await import("/basic/js/app/transformar.js");
  const r = {}, R = o => ({ ...RECORTE0, ...o });
  const g0 = calcularGeo(R({}), 400, 300);
  r.neutra = esNeutra({ ajustes: {}, recorte: R({}) }) && !esNeutra({ ajustes: {}, recorte: R({ giro: 90 }) });
  r.base = g0.salida.w === 400 && g0.salida.h === 300;
  const g90 = calcularGeo(R({ giro: 90 }), 400, 300);
  r.giro = g90.salida.w === 300 && g90.salida.h === 400;
  const gE = calcularGeo(R({ angulo: 10 }), 400, 300);
  r.ender = gE.frame.w > 400 && gE.rect.w < 400 && dentroDelQuad(gE.rect, gE.quad) && Math.abs(gE.rect.w / gE.rect.h - 4 / 3) < 0.01;
  const gP = calcularGeo(R({ proporcion: "16:9" }), 400, 300);
  r.prop = Math.abs(gP.rect.w / gP.rect.h - 16 / 9) < 0.01 && gP.rect.w <= 400.01 && gP.rect.h <= 300.01;
  const gL = calcularGeo(R({ angulo: 8, proporcion: "libre" }), 400, 300);
  r.libre = dentroDelQuad(gL.rect, gL.quad) && gL.rect.w * gL.rect.h >= gE.rect.w * gE.rect.h - 1;
  const gV = calcularGeo(R({ persV: 50 }), 400, 300);
  r.persp = dentroDelQuad(gV.rect, gV.quad) && gV.rect.w < 400;
  r.rectDado = (() => { const g = calcularGeo(R({ rect: { x0: .25, y0: .25, x1: .75, y1: .75 } }), 400, 300); return Math.abs(g.rect.w - 200) < 0.1 && Math.abs(g.rect.h - 150) < 0.1; })();
  r.ratios = Object.keys(RATIOS).length === 9;
  /* píxeles: izquierda roja, derecha azul */
  const f = Object.assign(document.createElement("canvas"), { width: 40, height: 20 }), x = f.getContext("2d");
  x.fillStyle = "#f00"; x.fillRect(0, 0, 20, 20); x.fillStyle = "#00f"; x.fillRect(20, 0, 20, 20);
  const px = (c, i, j) => [...c.getContext("2d").getImageData(i, j, 1, 1).data];
  const v = transformar(f, calcularGeo(R({ volteoH: true }), 40, 20), { anchoOriginal: 40 });
  r.voltea = px(v, 5, 10)[2] > 200 && px(v, 35, 10)[0] > 200;
  const gg = transformar(f, calcularGeo(R({ giro: 90 }), 40, 20), { anchoOriginal: 40 });
  r.gira = gg.width === 20 && gg.height === 40 && px(gg, 10, 5)[0] > 200 && px(gg, 10, 35)[2] > 200;
  const gp = transformar(f, calcularGeo(R({ persV: 30 }), 40, 20), { anchoOriginal: 40, perspectiva: true });
  r.warp = gp.width > 0 && gp.height > 0;
  return r;
});
for (const [k, msg] of Object.entries({ neutra: "receta neutra", base: "tamaño sin recorte", giro: "giro 90° intercambia lados", ender: "enderezar: marco mayor y recorte automático dentro",
  prop: "proporción 16:9 exacta", libre: "proporción libre aprovecha el máximo", persp: "perspectiva: recorte dentro del cuadrilátero", rectDado: "rect normalizado",
  ratios: "tabla de proporciones", voltea: "voltear horizontal en píxeles", gira: "girar 90° en píxeles", warp: "perspectiva con malla" })) exige(m[k], "motor: " + msg + " " + JSON.stringify(m[k]));
await cerrar();

for (const tipo of ["escritorio", "movil"]) {
  const t = await abrir(tipo), pg = t.page;
  await pg.goto(pg.url().replace(/\/[^/]*$/, "/") + "basic/"); await pg.waitForTimeout(500);
  await pg.setInputFiles("input[type=file]", FOTO); await pg.waitForTimeout(1500);
  const rec = () => pg.evaluate(async () => (await import("/basic/js/app/session.js")).receta().recorte);
  const dims = () => pg.evaluate(async () => { const R = await import("/basic/js/app/render.js"), g = R.geometria(); return g ? { w: g.salida.w, h: g.salida.h, fw: g.frame.w, fh: g.frame.h } : null; });
  await pg.getByRole("tab", { name: "Recortar" }).click(); await pg.waitForTimeout(900);
  exige(await pg.locator(".recorte-sobre .marco").count() === 1 && await pg.locator(".recorte-sobre .asa.esquina, .recorte-sobre .asa.lado").count() === 8, tipo + ": falta el marco con 8 asas");
  exige(await pg.locator(".regla").count() === 1, tipo + ": falta la regla");
  const d0 = await dims();
  /* girar */
  await pg.locator(".ajuste.accion:has-text('Girar')").click(); await pg.waitForTimeout(700);
  exige((await rec()).giro === 90, tipo + ": girar no escribe giro=90");
  const d1 = await dims(); exige(d1 && d1.w === d0.h && d1.h === d0.w, tipo + ": girar no intercambia lados " + JSON.stringify([d0, d1]));
  await pg.locator(".ajuste.accion:has-text('Voltear')").click(); await pg.waitForTimeout(500);
  exige((await rec()).volteoH === true, tipo + ": voltear");
  /* proporción */
  await pg.locator(".ajuste.accion:has-text('Proporción')").click(); await pg.waitForTimeout(300);
  exige(await pg.locator(".chip").count() === 11, tipo + ": debe haber 11 proporciones");
  await pg.locator('.chip[data-id="1:1"]').click(); await pg.waitForTimeout(700);
  const d2 = await dims(); exige(d2 && Math.abs(d2.w - d2.h) <= 1, tipo + ": 1:1 no es cuadrado " + JSON.stringify(d2));
  await pg.locator(".ajuste.accion:has-text('Atrás')").click(); await pg.waitForTimeout(300);
  /* regla de enderezar */
  await pg.locator('.ajuste:has-text("Enderezar")').click(); await pg.locator(".regla").focus();
  for (let k = 0; k < 30; k++) await pg.keyboard.press("ArrowRight");
  await pg.waitForTimeout(900);
  exige(Math.abs((await rec()).angulo) > 1, tipo + ": la regla no escribe el ángulo " + JSON.stringify(await rec()));
  const d3 = await dims(); exige(d3 && d3.fw > d3.w, tipo + ": con ángulo el marco debe ser mayor que el recorte");
  await pg.locator('.ajuste:has-text("Enderezar")').dblclick(); await pg.waitForTimeout(500);
  exige(!(await rec()).angulo, tipo + ": doble toque en Enderezar no lo pone a 0 " + JSON.stringify(await rec()));
  await pg.getByLabel("Deshacer").click(); await pg.waitForTimeout(400);
  /* arrastrar el marco: reducirlo desde la esquina */
  const asa = pg.locator('.asa.esquina[data-dx="1"][data-dy="1"]'), b = await asa.boundingBox();
  await pg.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await pg.mouse.down();
  await pg.mouse.move(b.x + b.width / 2 - 60, b.y + b.height / 2 - 60, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(700);
  const info = await pg.evaluate(([x,y])=>[document.elementFromPoint(x,y)?.className, innerWidth, innerHeight],[b.x+b.width/2,b.y+b.height/2]);
  const rr = (await rec()).rect; exige(rr && rr.x1 - rr.x0 < 1, tipo + ": arrastrar la esquina no cambia el recorte " + JSON.stringify([rr, b, info]));
  const d4 = await dims(); exige(d4 && d4.w < d3.w, tipo + ": el recorte no se ha reducido " + JSON.stringify([d3, d4]));
  if (salida) await pg.screenshot({ path: path.join(salida, `recortar-${tipo}.png`) });
  /* final */
  await pg.getByRole("tab", { name: "Ajustar" }).click(); await pg.waitForTimeout(900);
  const fin = await pg.evaluate(async () => { const R = await import("/basic/js/app/render.js"), c = await R.renderFinal(), g = R.geometria(); return { w: c.width, h: c.height, gw: g.salida.w, gh: g.salida.h }; });
  exige(Math.abs(fin.w - fin.gw) <= 1 && Math.abs(fin.h - fin.gh) <= 1, tipo + ": el final no mide el recorte " + JSON.stringify(fin));
  /* deshacer varias veces vuelve a neutro */
  for (let k = 0; k < 8; k++) await pg.getByLabel("Deshacer").click({ force: true }).catch(() => {});
  await pg.waitForTimeout(600);
  const r0 = await rec(); exige(!r0.giro && !r0.volteoH && !r0.angulo && !r0.rect && r0.proporcion === "orig", tipo + ": deshacer no vuelve a neutro " + JSON.stringify(r0));
  const solapa = await pg.evaluate(() => [...document.querySelectorAll(".barra .pildora, .panel > *")].every(e => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }));
  exige(solapa, tipo + ": el panel se sale de la pantalla");
  if (t.errs.length) fallos.push(tipo + ": errores de página: " + t.errs.join(" | "));
  await t.cerrar();
}
if (errs.length) fallos.push("errores de página (motor): " + errs.join(" | "));
console.log(fallos.length ? "FALLO\n  - " + fallos.join("\n  - ") : "OK");
process.exit(fallos.length ? 1 : 0);
