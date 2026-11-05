/* ═════════════════════════════════════════════════
   PRUEBA · asistente (navegador, móvil y escritorio)
   «más cálida y con grano de película y mucho contraste» → plan de 3 pasos → capas de ajuste (wb, bc) + capa de grano; la foto se calienta.
   «quita la neblina» → la función de IA se ejecuta con su panel relleno solo y crea su capa. Una orden absurda avisa sin tocar nada.
   Uso: node tests/ia/asistente/editor.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const info = m => m.page.evaluate(async () => { const D = await import("/js/core/doc.js"); return D.doc.layers.map(l => (l.type === "adjust" ? "adjust:" + l.adjustType : l.type) + "|" + l.name); });
const media = m => m.page.evaluate(async () => { const { flatten } = await import("/js/editor/layers/layertree.js"), c = flatten(), a = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let r = 0, b = 0; for (let i = 0; i < a.length; i += 40) { r += a[i]; b += a[i + 2]; } return r / b; });
const esperaCapas = (m, n) => m.page.evaluate(async n => { const D = await import("/js/core/doc.js"); for (let i = 0; i < 1000 && D.doc.layers.length <= n; i++) await new Promise(r => setTimeout(r, 100)); return D.doc.layers.length > n; }, n);
async function orden(m, texto) {
  await m.page.evaluate(async () => { const C = await import("/js/core/commands.js"); window.__p = Promise.resolve(C.run("ai.assistant")).catch(() => {}); });
  await m.page.waitForSelector(".modal", { timeout: 20000 });
  await m.page.fill('.modal input[type=text]', texto); await m.page.click(".modal-foot button.primary");
}
async function probar(tipo) {
  const m = await abrir(tipo);
  await m.page.evaluate(() => { setInterval(() => [...document.querySelectorAll("button")].find(b => /^Descargar/.test(b.textContent.trim()))?.click(), 300); });
  await m.page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(400, 300, { name: "x", fill: "#7088a0" }); const c = D.doc.layers[0].ctx; for (let i = 0; i < 60; i++) { c.fillStyle = i % 2 ? "#345" : "#abc"; c.fillRect((i * 53) % 380, (i * 31) % 280, 24, 24); } });
  const r0 = await media(m);
  await orden(m, "más cálida y con grano de película y mucho contraste");
  ok(await m.page.waitForFunction(() => /Aplicar/.test(document.querySelector(".modal-foot")?.textContent || "") && /Temperatura/.test(document.querySelector(".modal-body")?.textContent || ""), null, { timeout: 20000 }).then(() => true).catch(() => false), `${tipo}: no sale el plan`);
  const plan = await m.page.evaluate(() => document.querySelector(".modal-body").textContent.replace(/\s+/g, " ")); console.log(tipo, plan.slice(0, 220));
  ok(/Grano/.test(plan) && /Contraste/.test(plan), `${tipo}: plan incompleto`);
  await m.page.click(".modal-foot button.primary");
  ok(await esperaCapas(m, 3), `${tipo}: no crea las capas`);
  const L = await info(m); console.log(L.join(", "));
  ok(L.some(x => x.startsWith("adjust:wb")) && L.some(x => x.startsWith("adjust:bc")) && L.some(x => /Grano/.test(x)), `${tipo}: faltan capas ${L}`);
  const r1 = await media(m); ok(r1 > r0 * 1.03, `${tipo}: no se calienta ${r0.toFixed(2)} → ${r1.toFixed(2)}`);
  // IA con el panel relleno solo
  const n = (await info(m)).length;
  await orden(m, "quita la neblina");
  await m.page.waitForFunction(() => /Aplicar/.test(document.querySelector(".modal-foot")?.textContent || "") && /Quitar neblina|Neblina|neblina/.test(document.querySelector(".modal-body")?.textContent || ""), null, { timeout: 20000 });
  await m.page.click(".modal-foot button.primary");
  ok(await esperaCapas(m, n), `${tipo}: la IA no crea su capa`);
  // orden absurda
  const n2 = (await info(m)).length; await orden(m, "hazme un café");
  await m.page.waitForTimeout(800); ok((await info(m)).length === n2 && !(await m.page.$(".modal")), `${tipo}: la orden absurda no debe cambiar nada ni dejar diálogo`);
  ok(m.errs.length === 0, `${tipo}: errores ${m.errs.slice(0, 2)}`); await m.cerrar();
}
await probar("escritorio"); await probar("movil");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · asistente"); process.exit(fallos ? 1 : 0);
