/* ═══════════════════════════════════════════════════════════════
   PRUEBA · ESQUELETO DE REALIFY BASIC (F0)
   Comprueba que /basic/ carga sin errores en móvil y escritorio, que su manifiesto es propio (id, alcance, nombre, iconos
   que existen), que el service worker se instala y que su caché no borra la de Realify (ni al revés).
   Uso: node tests/basic/esqueleto.mjs      Salidas: OK / FALLO y código de salida.
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { abrir, RAIZ } from "../ia/lib/navegador.mjs";

const fallos = [];
const exige = (c, m) => { if (!c) fallos.push(m); };

const man = JSON.parse(fs.readFileSync(path.join(RAIZ, "basic/manifest.webmanifest"), "utf8"));
exige(man.id === "/basic/" && man.scope === "/basic/" && man.start_url === "/basic/", "manifiesto: id/alcance/start_url deben ser /basic/");
exige(man.short_name === "Realify Basic", "manifiesto: short_name");
for (const i of man.icons) exige(fs.existsSync(path.join(RAIZ, "basic", i.src)), "icono inexistente: " + i.src);
const v = JSON.parse(fs.readFileSync(path.join(RAIZ, "version.json"), "utf8")).version;
exige(fs.readFileSync(path.join(RAIZ, "basic/sw.js"), "utf8").includes(`realify-basic-v${v}`), "basic/sw.js no lleva el contador " + v);
exige(fs.readFileSync(path.join(RAIZ, "basic/index.html"), "utf8").includes(`main.js?v=${v}`), "basic/index.html no lleva ?v=" + v);

for (const tipo of ["movil", "escritorio"]) {
  const { page, errs, cerrar } = await abrir(tipo, { sw: true });
  const base = page.url().replace(/\/[^/]*$/, "/");
  await page.goto(base + "basic/"); await page.waitForTimeout(1500);
  exige(await page.title() === "Realify Basic | Editor de fotos limpio y privado", tipo + ": título");
  exige(await page.evaluate(() => !!document.querySelector("#stage")), tipo + ": falta #stage");
  const r = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/basic/");
    await navigator.serviceWorker.ready.catch(() => {});
    await new Promise(s => setTimeout(s, 800));
    await caches.open("realify-v0-ajena").then(c => c.put("/x", new Response("x")));
    return { scope: reg?.scope, caches: await caches.keys() };
  });
  exige(/\/basic\/$/.test(r.scope || ""), tipo + ": service worker sin alcance /basic/ (" + r.scope + ")");
  exige(r.caches.some(k => k.startsWith("realify-basic-")), tipo + ": no hay caché realify-basic-*");
  exige(r.caches.includes("realify-v0-ajena"), tipo + ": se borró una caché de Realify");
  if (errs.length) fallos.push(tipo + ": errores de página: " + errs.join(" | "));
  await cerrar();
}
console.log(fallos.length ? "FALLO\n  - " + fallos.join("\n  - ") : "OK");
process.exit(fallos.length ? 1 : 0);
