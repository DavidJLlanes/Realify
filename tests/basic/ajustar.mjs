/* ═══════════════════════════════════════════════════════════════
   PRUEBA · AJUSTAR DE REALIFY BASIC (F2)
   Motor: receta neutra = imagen idéntica y cada ajuste mueve los píxeles en la dirección esperada (exposición, sombras, luces,
   contraste, saturación, temperatura, viñeta, nitidez, ruido, definición). Interfaz: 16 elementos en la fila, la regla escribe en la
   receta, un gesto = un paso de historial, deshacer/rehacer, Auto y guardar a resolución completa. En móvil y escritorio.
   Uso: node tests/basic/ajustar.mjs [carpeta_capturas]   Salidas: OK / FALLO y código de salida.
   ═══════════════════════════════════════════════════════════════ */
import path from "node:path";
import { abrir, RAIZ } from "../ia/lib/navegador.mjs";

const fallos = [], salida = process.argv[2];
const exige = (c, m) => { if (!c) fallos.push(m); };
const FOTO = path.join(RAIZ, "assets/skies", "atardecer-dorado.jpg");

const { page, errs, cerrar } = await abrir("escritorio");
const base = page.url().replace(/\/[^/]*$/, "/");
await page.goto(base + "basic/"); await page.waitForTimeout(500);

/* ── Motor ─────────────────────────────────────────────────── */
const m = await page.evaluate(async () => {
  const { aplicarReceta, esNeutra } = await import("/basic/js/engine/pipeline.js");
  const W = 160, H = 100;
  const hacer = () => {                                    // degradado con color, un objeto oscuro, uno claro y un poco de ruido
    const d = new ImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, n = ((x * 7919 + y * 104729) % 17) - 8;
      let r = 60 + x, g = 90 + y, b = 140 - x / 2;
      if (x > 20 && x < 50 && y > 20 && y < 50) { r = g = b = 30; }
      if (x > 100 && x < 140 && y > 20 && y < 60) { r = g = b = 235; }
      d.data[i] = r + n; d.data[i + 1] = g + n; d.data[i + 2] = b + n; d.data[i + 3] = 255;
    }
    return d;
  };
  const med = (d, f) => { let s = 0, c = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f(x, y)) { const i = (y * W + x) * 4; s += (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3; c++; } return s / c; };
  const crom = d => { let s = 0; for (let i = 0; i < d.data.length; i += 4) s += Math.max(d.data[i], d.data[i + 1], d.data[i + 2]) - Math.min(d.data[i], d.data[i + 1], d.data[i + 2]); return s / (d.data.length / 4); };
  const rojoAzul = d => { let s = 0; for (let i = 0; i < d.data.length; i += 4) s += d.data[i] - d.data[i + 2]; return s / (d.data.length / 4); };
  const ruido = d => { let s = 0, c = 0; for (let y = 60; y < H - 1; y++) for (let x = 60; x < 90; x++) { const i = (y * W + x) * 4, j = i + 4; s += Math.abs(d.data[i] - d.data[j]); c++; } return s / c; };
  const borde = d => { let s = 0, c = 0; for (let y = 30; y < 40; y++) for (let x = 16; x < 24; x++) { const i = (y * W + x) * 4; s += Math.abs(d.data[i] - d.data[i + 4]); c++; } return s / c; };
  const con = (aj, op = {}) => aplicarReceta(hacer(), { ajustes: aj }, op);
  const o = hacer(), r = {};
  r.neutra = esNeutra({ ajustes: { exposicion: 0 } }) && !esNeutra({ ajustes: { exposicion: 1 } });
  const ident = aplicarReceta(hacer(), { ajustes: {} });
  r.identica = ident.data.every((v, i) => v === o.data[i]);
  const claro = (x, y) => x > 100 && x < 140 && y > 20 && y < 60, oscuro = (x, y) => x > 20 && x < 50 && y > 20 && y < 50, todo = () => true;
  r.exp = [med(con({ exposicion: 40 }), todo) - med(o, todo), med(con({ exposicion: -40 }), todo) - med(o, todo)];
  r.expRapido = med(con({ exposicion: 40 }, { rapido: true }), todo) - med(o, todo);
  r.sombras = med(con({ sombras: 60 }), oscuro) - med(o, oscuro);
  r.luces = med(con({ luces: -60 }), claro) - med(o, claro);
  r.brillantez = [med(con({ brillantez: 60 }), oscuro) - med(o, oscuro), med(con({ brillantez: 60 }), claro) - med(o, claro)];
  r.contraste = [med(con({ contraste: 50 }), claro) - med(o, claro), med(con({ contraste: 50 }), oscuro) - med(o, oscuro)];
  r.brillo = med(con({ brillo: 40 }), todo) - med(o, todo);
  r.negro = med(con({ negro: 60 }), oscuro) - med(o, oscuro);
  const az = new ImageData(1, 1); az.data.set([10, 10, 30, 255]); aplicarReceta(az, { ajustes: { negro: 100 } }); r.negroAzul = Math.max(...az.data.slice(0, 3)) - Math.min(...az.data.slice(0, 3));   // sin motas azules
  r.satMas = crom(con({ saturacion: 50 })) - crom(o);
  const gris = con({ saturacion: -100 }); let maxDif = 0; for (let i = 0; i < gris.data.length; i += 4) maxDif = Math.max(maxDif, Math.abs(gris.data[i] - gris.data[i + 1]), Math.abs(gris.data[i + 1] - gris.data[i + 2]));
  r.satGris = maxDif;
  r.intensidad = crom(con({ intensidad: 60 })) - crom(o);
  r.temp = [rojoAzul(con({ temperatura: 60 })) - rojoAzul(o), rojoAzul(con({ temperatura: -60 })) - rojoAzul(o)];
  const v = con({ vineta: 80 }); r.vineta = [med(v, (x, y) => x < 6 && y < 6) - med(o, (x, y) => x < 6 && y < 6), med(v, (x, y) => Math.abs(x - 80) < 4 && Math.abs(y - 50) < 4) - med(o, (x, y) => Math.abs(x - 80) < 4 && Math.abs(y - 50) < 4)];
  r.vinetaBlanca = med(con({ vineta: -80 }), (x, y) => x < 6 && y < 6) - med(o, (x, y) => x < 6 && y < 6);
  r.nitidez = borde(con({ nitidez: 80 })) - borde(o);
  r.ruido = ruido(con({ ruido: 80 })) - ruido(o);
  r.definicion = borde(con({ definicion: 80 })) - borde(o);
  const { crearCadena } = await import("/basic/js/engine/pipeline.js");
  const rec = { ajustes: { exposicion: 25, sombras: 30, contraste: 15, definicion: 30, nitidez: 30, vineta: 40 } }, cad = crearCadena(hacer());
  const a1 = cad.render(rec), ref = aplicarReceta(hacer(), rec);
  r.cadena = a1.data.every((v, i) => v === ref.data[i]);
  rec.ajustes.vineta = 70; const a2 = cad.render(rec), ref2 = aplicarReceta(hacer(), rec);
  r.cadenaInc = a2.data.every((v, i) => v === ref2.data[i]) && a2 !== a1;
  r.cadenaNoMuta = a1.data.every((v, i) => v === ref.data[i]);
  r.alfa = con({ exposicion: 30, sombras: 30, contraste: 20, nitidez: 40, vineta: 30 }).data.every((v, i) => i % 4 !== 3 || v === 255);
  return r;
});
exige(m.neutra && m.identica, "motor: la receta neutra debe dejar la imagen idéntica");
exige(m.exp[0] > 8 && m.exp[1] < -8, "exposición: sube y baja la luz " + m.exp);
exige(Math.abs(m.expRapido - m.exp[0]) < 4, "exposición: la vista rápida difiere de la exacta " + m.expRapido);
exige(m.sombras > 4, "sombras: +60 debe aclarar lo oscuro " + m.sombras);
exige(m.luces < -2, "luces altas: −60 debe oscurecer lo claro " + m.luces);
exige(m.brillantez[0] > 2 && m.brillantez[1] < 1, "brillantez: abre sombras y contiene luces " + m.brillantez);
exige(m.contraste[0] > 0 && m.contraste[1] < 0, "contraste: separa claros y oscuros " + m.contraste);
exige(m.brillo > 5, "brillo: +40 debe aclarar " + m.brillo);
exige(m.negro < -1, "punto negro: +60 debe oscurecer las sombras " + m.negro);
exige(m.negroAzul <= 3, "punto negro: una zona oscura azulada no debe quedar en azul puro " + m.negroAzul);
exige(m.satMas > 3, "saturación: +50 debe subir el croma " + m.satMas);
exige(m.satGris <= 3, "saturación: −100 debe dejar grises " + m.satGris);
exige(m.intensidad > 0.5, "intensidad: +60 debe subir el croma " + m.intensidad);
exige(m.temp[0] > 5 && m.temp[1] < -5, "temperatura: cálido sube rojo−azul, frío lo baja " + m.temp);
exige(m.vineta[0] < -20 && Math.abs(m.vineta[1]) < 1.5, "viñeta: oscurece esquinas y no toca el centro " + m.vineta);
exige(m.vinetaBlanca > 20, "viñeta negativa: debe aclarar esquinas " + m.vinetaBlanca);
exige(m.nitidez > 2, "nitidez: debe aumentar el contraste del borde " + m.nitidez);
exige(m.ruido < -1, "reducir ruido: debe bajar la variación " + m.ruido);
exige(m.definicion > 1, "definición: debe aumentar el contraste local " + m.definicion);
exige(m.cadena && m.cadenaInc && m.cadenaNoMuta, "cadena de vista previa: debe dar lo mismo que el cálculo completo y no mutar etapas guardadas");
exige(m.alfa, "el canal alfa no debe cambiar");

/* ── Interfaz, móvil y escritorio ─────────────────────────── */
await cerrar();
for (const tipo of ["escritorio", "movil"]) {
  const t = await abrir(tipo), pg = t.page;
  await pg.goto((await pg.url()).replace(/\/[^/]*$/, "/") + "basic/");
  await pg.waitForTimeout(500);
  await pg.setInputFiles("input[type=file]", FOTO); await pg.waitForTimeout(1500);
  exige(await pg.locator(".ajuste").count() === 16, tipo + ": debe haber 16 elementos (Auto + 15)");
  const media = () => pg.evaluate(() => { const c = document.querySelector(".foto canvas"), x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4 * 3); });
  const m0 = await media();
  await pg.locator('.ajuste[data-id="exposicion"]').click();
  await pg.locator(".regla").focus();
  for (let k = 0; k < 40; k++) await pg.keyboard.press("ArrowRight");
  await pg.waitForTimeout(900);
  const rec = () => pg.evaluate(async () => (await import("/basic/js/app/session.js")).receta().ajustes);
  exige((await rec()).exposicion === 40, tipo + ": la regla no escribe en la receta " + JSON.stringify(await rec()));
  const m1 = await media();
  exige(m1 > m0 + 5, tipo + ": la vista previa no se aclara " + m0 + " → " + m1);
  exige(await pg.locator(".regla-valor").textContent() === "+40", tipo + ": el valor de la regla");
  exige(await pg.locator('.ajuste[data-id="exposicion"] .disco').evaluate(e => e.style.getPropertyValue("--anillo")).then(v => v.includes("conic")), tipo + ": falta el anillo del valor");
  exige(!(await pg.locator(".barra-sup button:has-text('OK')").isDisabled()), tipo + ": OK debe activarse");
  await pg.waitForTimeout(500);
  const pasos = await pg.evaluate(async () => { const S = await import("/basic/js/app/session.js"); return S.receta().ajustes.exposicion; });
  await pg.getByLabel("Deshacer").click(); await pg.waitForTimeout(700);
  exige((await rec()).exposicion === 0 || (await rec()).exposicion === undefined, tipo + ": deshacer no vuelve a 0 (" + JSON.stringify(await rec()) + ")");
  exige(Math.abs((await media()) - m0) < 0.5, tipo + ": tras deshacer la foto no es la original");
  await pg.getByLabel("Rehacer").click(); await pg.waitForTimeout(700);
  exige((await rec()).exposicion === 40 && pasos === 40, tipo + ": rehacer");
  /* doble toque en el ajuste lo pone a 0 */
  await pg.locator('.ajuste[data-id="exposicion"]').dblclick(); await pg.waitForTimeout(500);
  exige(!(await rec()).exposicion, tipo + ": doble toque en el ajuste no lo pone a 0 " + JSON.stringify(await rec()));
  await pg.getByLabel("Deshacer").click(); await pg.waitForTimeout(300);
  /* Auto */
  await pg.getByLabel("Deshacer").click(); await pg.waitForTimeout(300);
  await pg.locator(".ajuste.auto").click(); await pg.waitForTimeout(1500);
  const a = await rec();
  exige(Object.values(a).some(v => v !== 0), tipo + ": Auto no ha cambiado ningún ajuste " + JSON.stringify(a));
  if (salida) await pg.screenshot({ path: path.join(salida, `ajustar-${tipo}.png`) });
  /* final a resolución completa */
  const fin = await pg.evaluate(async () => { const R = await import("/basic/js/app/render.js"), S = await import("/basic/js/app/session.js"); const c = await R.renderFinal(); return { w: c.width, h: c.height, ow: S.original().width, oh: S.original().height, esOriginal: c === S.original() }; });
  exige(fin.w === fin.ow && fin.h === fin.oh, tipo + ": el final no mide lo que el original");
  const solapa = await pg.evaluate(() => [...document.querySelectorAll(".barra .pildora, .panel > *")].every(e => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }));
  exige(solapa, tipo + ": el panel se sale de la pantalla");
  if (t.errs.length) fallos.push(tipo + ": errores de página: " + t.errs.join(" | "));
  await t.cerrar();
}
if (errs.length) fallos.push("errores de página (motor): " + errs.join(" | "));
console.log(fallos.length ? "FALLO\n  - " + fallos.join("\n  - ") : "OK");
process.exit(fallos.length ? 1 : 0);
