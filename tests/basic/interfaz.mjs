/* ═══════════════════════════════════════════════════════════════
   PRUEBA · INTERFAZ DE REALIFY BASIC (F1)
   En móvil y escritorio: pantalla de inicio, abrir una foto, visor a pantalla completa, pestañas, barras que se ocultan con
   un toque, zoom, deshacer/rehacer con el historial, menú «···», Cancelar con confirmación y que nada se salga de la pantalla.
   Uso: node tests/basic/interfaz.mjs [carpeta_capturas]   Salidas: OK / FALLO, capturas opcionales y código de salida.
   ═══════════════════════════════════════════════════════════════ */
import path from "node:path";
import { abrir, RAIZ } from "../ia/lib/navegador.mjs";

const fallos = [], salida = process.argv[2];
const exige = (c, m) => { if (!c) fallos.push(m); };
const FOTO = path.join(RAIZ, "assets/skies", "amanecer.jpg");

for (const tipo of ["movil", "escritorio"]) {
  const { page, errs, cerrar } = await abrir(tipo);
  const base = page.url().replace(/\/[^/]*$/, "/");
  await page.goto(base + "basic/"); await page.waitForTimeout(800);
  const vis = s => page.evaluate(q => { const e = document.querySelector(q); return !!e && !e.hidden && getComputedStyle(e).display !== "none" && getComputedStyle(e).opacity !== "0"; }, s);
  exige(await vis(".bienvenida"), tipo + ": falta la pantalla de inicio");
  exige(!(await vis(".barra-inf")), tipo + ": las barras no deben verse sin foto");
  exige(await page.evaluate(() => document.documentElement.dataset.dispositivo) === tipo, tipo + ": data-dispositivo incorrecto");
  if (salida) await page.screenshot({ path: path.join(salida, `inicio-${tipo}.png`) });

  await page.setInputFiles("input[type=file]", FOTO); await page.waitForTimeout(1200);
  exige(!(await vis(".bienvenida")), tipo + ": la bienvenida sigue tras abrir");
  exige(await vis(".barra-inf") && await vis(".barra-sup"), tipo + ": faltan las barras con foto");
  exige(await page.locator(".pestana").count() === 3, tipo + ": debe haber 3 pestañas");
  const cv = await page.evaluate(() => { const c = document.querySelector(".foto canvas"), r = c?.getBoundingClientRect(); return c && { w: c.width, h: c.height, rw: r.width, rh: r.height, x: r.x, y: r.y, W: innerWidth, H: innerHeight }; });
  exige(!!cv && cv.w > 0, tipo + ": no hay lienzo de la foto");
  if (cv) exige(Math.abs(cv.rw - cv.W) < 2 || Math.abs(cv.rh - cv.H) < 2, tipo + ": la foto no ocupa el ancho o el alto completo");
  exige(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), tipo + ": hay desbordamiento");
  const dentro = await page.evaluate(() => [...document.querySelectorAll(".barra .pildora")].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
  exige(dentro, tipo + ": una píldora se sale de la pantalla");
  if (salida) await page.screenshot({ path: path.join(salida, `foto-${tipo}.png`) });

  await page.click('.pestana[data-id="recortar"]');
  exige(await page.getAttribute('.pestana[data-id="recortar"]', "aria-selected") === "true", tipo + ": la pestaña no se selecciona");
  exige(await page.locator(".barra-sup button:has-text('OK')").isDisabled(), tipo + ": OK debe estar apagado sin cambios");

  /* historial: un gesto de ajuste cierra un paso */
  await page.evaluate(async () => {
    const S = await import("/basic/js/app/session.js");
    S.cambiar({ exposicion: 30 }); S.cerrarPaso();
  });
  await page.waitForTimeout(200);
  exige(!(await page.locator(".barra-sup button:has-text('OK')").isDisabled()), tipo + ": OK debe activarse con cambios");
  exige(!(await page.getByLabel("Deshacer").isDisabled()) && await page.getByLabel("Rehacer").isDisabled(), tipo + ": estado de deshacer/rehacer");
  await page.getByLabel("Deshacer").click(); await page.waitForTimeout(150);
  exige(await page.getByLabel("Rehacer").isEnabled() && await page.getByLabel("Deshacer").isDisabled(), tipo + ": tras deshacer");
  await page.getByLabel("Rehacer").click(); await page.waitForTimeout(150);

  /* menú */
  await page.getByLabel("Más opciones").click();
  const ops = await page.locator(".menu-op").allTextContents();
  exige(["Abrir otra foto", "Guardar copia", "Volver al original"].every(t => ops.includes(t)), tipo + ": opciones del menú " + ops.join("|"));
  if (salida) await page.screenshot({ path: path.join(salida, `menu-${tipo}.png`) });
  await page.keyboard.press("Escape");
  exige(!(await vis(".menu")), tipo + ": el menú no se cierra con Escape");

  await page.click('.pestana[data-id="ajustar"]'); await page.waitForTimeout(500);   // en Recortar, tocar el marco mueve el recorte (no oculta barras)
  /* zoom con rueda y toque para ocultar barras */
  const t0 = await page.evaluate(() => document.querySelector(".foto").style.transform);
  await page.mouse.move(cv.W / 2, cv.H / 2); await page.mouse.wheel(0, -400); await page.waitForTimeout(150);
  exige(await page.evaluate(() => document.querySelector(".foto").style.transform) !== t0, tipo + ": la rueda no hace zoom");
  /* zoom inverso: alejar por debajo del tamaño ajustado (la foto queda centrada y más pequeña) */
  const escala = t => +(/scale\(([\d.e-]+)\)/.exec(t) || [])[1];
  for (let k = 0; k < 6; k++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(60); }
  const tz = await page.evaluate(() => document.querySelector(".foto").style.transform);
  exige(escala(tz) < escala(t0) * 0.6, tipo + ": no se puede alejar por debajo del ajuste " + [t0, tz]);
  await page.mouse.dblclick(cv.W / 2, cv.H / 2); await page.waitForTimeout(300);
  exige(Math.abs(escala(await page.evaluate(() => document.querySelector(".foto").style.transform)) / escala(t0) - 1) < 0.01, tipo + ": doble toque no vuelve al ajuste tras alejar");
  await page.waitForTimeout(400);
  /* mover la foto a voluntad: acercar, arrastrar (la foto se desplaza con el dedo) y doble toque para volver centrada */
  const mov = t => (/translate\(([-\d.e]+)px, ([-\d.e]+)px\)/.exec(t) || []).slice(1).map(Number);
  await page.mouse.move(cv.W / 2, cv.H / 2); await page.mouse.wheel(0, -500); await page.waitForTimeout(150);
  const ta = mov(await page.evaluate(() => document.querySelector(".foto").style.transform));
  await page.mouse.move(cv.W / 2, cv.H / 2); await page.mouse.down(); await page.mouse.move(cv.W / 2 + 70, cv.H / 2 + 50, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
  const tb = mov(await page.evaluate(() => document.querySelector(".foto").style.transform));
  exige(Math.abs(tb[0] - ta[0] - 70) < 2 && Math.abs(tb[1] - ta[1] - 50) < 2, tipo + ": arrastrar no mueve la foto acercada " + [ta, tb]);
  await page.mouse.dblclick(cv.W / 2, cv.H / 2); await page.waitForTimeout(300);
  exige(await page.evaluate(() => document.querySelector(".foto").style.transform) === t0, tipo + ": doble toque no vuelve a la foto ajustada y centrada");
  /* un toque con un pequeño temblor (< 8 px) no debe desplazar la foto */
  { const a = await page.evaluate(() => document.querySelector(".foto").style.transform);
    await page.mouse.move(cv.W / 2, cv.H / 2); await page.mouse.down(); await page.mouse.move(cv.W / 2 + 3, cv.H / 2 + 2); await page.mouse.up(); await page.waitForTimeout(500);
    exige(await page.evaluate(() => document.querySelector(".foto").style.transform) === a, tipo + ": un toque con temblor desplaza la foto");
    await page.mouse.click(cv.W / 2, cv.H / 2); await page.waitForTimeout(500); }
  await page.waitForTimeout(400);
  await page.mouse.click(cv.W / 2, cv.H / 2); await page.waitForTimeout(600);
  exige(await page.evaluate(() => document.documentElement.classList.contains("barras-ocultas")), tipo + ": un toque no oculta las barras");
  await page.mouse.click(cv.W / 2, cv.H / 2); await page.waitForTimeout(600);
  exige(!(await page.evaluate(() => document.documentElement.classList.contains("barras-ocultas"))), tipo + ": un segundo toque no las muestra");

  /* pellizco real con dos dedos (sólo móvil) */
  if (tipo === "movil") {
    const cdp = await page.context().newCDPSession(page), tp = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    const esc = () => page.evaluate(() => +/scale\(([\d.]+)\)/.exec(document.querySelector(".foto").style.transform)[1]);
    await page.evaluate(() => dispatchEvent(new Event("resize"))); const e0 = await esc();
    const cx = cv.W / 2, cy = cv.H / 2; await tp("touchStart", [[cx - 30, cy], [cx + 30, cy]]);
    for (let k = 1; k <= 8; k++) await tp("touchMove", [[cx - 30 - k * 12, cy], [cx + 30 + k * 12, cy]]);
    await tp("touchEnd", []); await page.waitForTimeout(150);
    exige(await esc() > e0 * 1.5, tipo + ": el pellizco no hace zoom");
    await page.mouse.dblclick(cx, cy); await page.waitForTimeout(200);
  }

  /* cancelar con cambios pide confirmación */
  await page.getByText("Cancelar").click();
  exige(await page.getByText("¿Descartar?").count() === 1 && !(await vis(".bienvenida")), tipo + ": Cancelar debe pedir confirmación");
  await page.getByText("¿Descartar?").click(); await page.waitForTimeout(200);
  exige(await vis(".bienvenida"), tipo + ": no vuelve al inicio al descartar");

  if (errs.length) fallos.push(tipo + ": errores de página: " + errs.join(" | "));
  await cerrar();
}
console.log(fallos.length ? "FALLO\n  - " + fallos.join("\n  - ") : "OK");
process.exit(fallos.length ? 1 : 0);
