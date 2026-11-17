/* ═══════════════════════════════════════════════════════════════
   PRUEBA · ESTILOS DE REALIFY BASIC (F4)
   Motor: un estilo cambia los píxeles, la intensidad 0 deja el original y 50 queda entre medias; la receta neutra no se altera.
   Interfaz: la fila lleva «Original» más todos los estilos de LOOKS con miniatura y nombre, elegir uno escribe la receta y repinta,
   aparece la regla de intensidad, deshacer vuelve al original y el guardado a resolución completa aplica el estilo. Móvil y escritorio.
   Uso: node tests/basic/estilos.mjs [carpeta_capturas]   Salidas: OK / FALLO y código de salida.
   ═══════════════════════════════════════════════════════════════ */
import path from "node:path";
import { abrir, RAIZ } from "../ia/lib/navegador.mjs";

const fallos = [], salida = process.argv[2];
const exige = (c, m) => { if (!c) fallos.push(m); };
const FOTO = path.join(RAIZ, "assets/skies", "atardecer-dorado.jpg");

const { page, errs, cerrar } = await abrir("escritorio");
await page.goto(page.url().replace(/\/[^/]*$/, "/") + "basic/"); await page.waitForTimeout(500);
const m = await page.evaluate(async () => {
  const { aplicarReceta, cargarEstilos, esNeutra } = await import("/basic/js/engine/pipeline.js");
  const { LOOKS } = await cargarEstilos();
  const hacer = () => { const d = new ImageData(32, 32); for (let i = 0; i < d.data.length; i += 4) { d.data[i] = 40 + (i % 128); d.data[i + 1] = 90; d.data[i + 2] = 160; d.data[i + 3] = 255; } return d; };
  const dif = (a, b) => { let s = 0; for (let i = 0; i < a.data.length; i += 4) s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); return s; };
  const o = hacer(), con = (k, n = 5) => aplicarReceta(hacer(), { ajustes: {}, estilo: { n, k } });
  return { n: LOOKS.length, neutra: esNeutra({ ajustes: {}, estilo: { n: -1, k: 100 } }) && !esNeutra({ ajustes: {}, estilo: { n: 3, k: 100 } }),
    cambia: dif(con(100), o), cero: dif(con(0), o), medio: dif(con(50), o), pleno: dif(con(100), o), sinEstilo: dif(aplicarReceta(hacer(), { ajustes: {} }), o) };
});
exige(m.n >= 150, "catálogo: debe haber ≥150 estilos y hay " + m.n);
exige(m.neutra, "receta neutra con estilo");
exige(m.cambia > 500, "un estilo debe cambiar los píxeles " + m.cambia);
exige(m.cero === 0 && m.sinEstilo === 0, "intensidad 0 / sin estilo: debe dejar el original");
exige(m.medio > 0 && m.medio < m.pleno, "intensidad 50 debe quedar entre medias " + [m.medio, m.pleno]);
await cerrar();

for (const tipo of ["escritorio", "movil"]) {
  const t = await abrir(tipo), pg = t.page;
  await pg.goto(pg.url().replace(/\/[^/]*$/, "/") + "basic/"); await pg.waitForTimeout(500);
  await pg.setInputFiles("input[type=file]", FOTO); await pg.waitForTimeout(1500);
  const media = () => pg.evaluate(() => { const c = document.querySelector(".foto canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let r = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; b += d[i + 2]; } return [r, b].map(v => v / (d.length / 4)); });
  const m0 = await media();
  await pg.getByRole("tab", { name: "Estilos" }).click(); await pg.waitForTimeout(1500);
  const n = await pg.locator(".ajuste.estilo").count(); exige(n >= 151, tipo + ": faltan estilos en la fila (" + n + ")");
  exige(await pg.locator(".ajuste.estilo canvas").count() > 20, tipo + ": las miniaturas no se pintan");
  exige(await pg.locator(".regla").isHidden(), tipo + ": la regla no debe verse sin estilo");
  await pg.locator('.ajuste.estilo[data-n="3"]').click(); await pg.waitForTimeout(900);
  const rec = () => pg.evaluate(async () => (await import("/basic/js/app/session.js")).receta().estilo);
  exige((await rec()).n === 3, tipo + ": elegir no escribe n=3");
  const m1 = await media(); exige(Math.abs(m1[0] - m0[0]) + Math.abs(m1[1] - m0[1]) > 3, tipo + ": la foto no cambia " + [m0, m1]);
  exige(await pg.locator(".regla").isVisible(), tipo + ": falta la regla de intensidad");
  await pg.locator(".regla").focus(); for (let k = 0; k < 40; k++) await pg.keyboard.press("ArrowLeft"); await pg.waitForTimeout(700);
  exige((await rec()).k === 60, tipo + ": intensidad no es 60 " + JSON.stringify(await rec()));
  if (salida) await pg.screenshot({ path: path.join(salida, `estilos-${tipo}.png`) });
  const fin = await pg.evaluate(async () => { const R = await import("/basic/js/app/render.js"), S = await import("/basic/js/app/session.js"); const c = await R.renderFinal(); return [c.width === S.original().width, c !== S.original()]; });
  exige(fin[0] && fin[1], tipo + ": el final debe ser un lienzo nuevo del tamaño original");
  for (let k = 0; k < 3; k++) await pg.getByLabel("Deshacer").click({ force: true }).catch(() => {});
  await pg.waitForTimeout(800);
  exige((await rec()).n === -1, tipo + ": deshacer no vuelve a Original " + JSON.stringify(await rec()));
  const solapa = await pg.evaluate(() => [...document.querySelectorAll(".barra .pildora, .panel > *")].every(e => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }));
  exige(solapa, tipo + ": el panel se sale de la pantalla");
  if (t.errs.length) fallos.push(tipo + ": errores de página: " + t.errs.join(" | "));
  await t.cerrar();
}
if (errs.length) fallos.push("errores de página (motor): " + errs.join(" | "));
console.log(fallos.length ? "FALLO\n  - " + fallos.join("\n  - ") : "OK");
process.exit(fallos.length ? 1 : 0);
