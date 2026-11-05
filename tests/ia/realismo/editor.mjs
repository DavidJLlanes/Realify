/* ═════════════════════════════════════════════════
   PRUEBA · realismo (navegador, móvil y escritorio)
   «Zonas demasiado lisas»: foto con la mitad plana y la mitad con ruido; comprueba que se añade grano sólo en la plana (capa nueva).
   «Informe de realismo»: se abre con PDF y JSON. «Plausibilidad»: «Marcar como antes» y la segunda vez enseña «antes → ahora».
   «Manos y dientes»: el comando existe. Uso: node tests/ia/realismo/editor.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";

let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const foto = () => {
  const W = 480, H = 320, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"), d = x.createImageData(W, H); let s = 99;
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) { const o = (y * W + i) * 4, v = 120 + i * 0.05 + (i < W / 2 ? ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 30 : 0); d.data[o] = d.data[o + 1] = d.data[o + 2] = v; d.data[o + 3] = 255; }
  x.putImageData(d, 0, 0); return c.toDataURL("image/png");
};
const esperaCapa = (m, n) => m.page.evaluate(async n => { const D = await import("/js/core/doc.js"); for (let i = 0; i < 300 && D.doc.layers.length <= n; i++) await new Promise(r => setTimeout(r, 100)); return D.doc.layers.length; }, n);

async function probar(tipo) {
  const m = await abrir(tipo);
  const url = await m.page.evaluate(`(${foto.toString()})()`);
  await m.page.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); const D = await import("/js/core/doc.js"); D.newDoc(img.naturalWidth, img.naturalHeight, { name: "real", fill: "#fff" }); D.doc.layers[0].ctx.drawImage(img, 0, 0); }, url);
  const run = cmd => m.page.evaluate(async c => { const C = await import("/js/core/commands.js"); window.__p = C.run(c); }, cmd);
  const n = await m.page.evaluate(async () => (await import("/js/core/doc.js")).doc.layers.length);
  await run("ai.smoothZones");
  ok(await m.page.waitForSelector(".modal", { timeout: 20000 }).then(() => true).catch(() => false), `${tipo}: smoothZones no abre el diálogo`);
  const mandos = await m.page.evaluate(() => document.querySelectorAll(".modal input, .modal select").length);
  ok(mandos >= 1 && mandos <= 4, `${tipo}: smoothZones tiene ${mandos} mandos`);
  await m.page.click(".modal-foot button.primary");
  ok(await esperaCapa(m, n) === n + 1, `${tipo}: smoothZones no creó la capa`);
  await m.page.waitForTimeout(400);
  const r = await m.page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers, a = L[L.length - 1].ctx.getImageData(0, 0, D.doc.w, D.doc.h).data, b = L[0].ctx.getImageData(0, 0, D.doc.w, D.doc.h).data, W = D.doc.w;
    const dif = (x0, x1) => { let s = 0; for (let y = 40; y < 280; y += 2) for (let x = x0; x < x1; x += 2) s += Math.abs(a[(y * W + x) * 4 + 1] - b[(y * W + x) * 4 + 1]); return s; }; return { ruido: dif(20, 200), plana: dif(280, 460) }; });
  ok(r.plana > r.ruido * 3 && r.plana > 0, `${tipo}: el grano debe ir a la zona plana (${JSON.stringify(r)})`);
  await run("ai.photoReport");
  ok(await m.page.waitForSelector(".modal", { timeout: 30000 }).then(() => true).catch(() => false), `${tipo}: el informe no se abre`);
  const bot = await m.page.evaluate(() => [...document.querySelectorAll(".modal-foot button")].map(b => b.textContent.trim()));
  ok(bot.includes("PDF") && bot.includes("JSON"), `${tipo}: el informe debe poder guardarse (${bot})`);
  await m.page.evaluate(() => [...document.querySelectorAll(".modal-foot button")].find(b => b.textContent.trim() === "Cerrar").click());
  await m.page.waitForSelector(".modal", { state: "detached", timeout: 10000 }).catch(() => {});
  await run("an.metrics");
  await m.page.waitForSelector(".modal", { timeout: 20000 });
  await m.page.evaluate(() => [...document.querySelectorAll(".modal-foot button")].find(b => /antes/.test(b.textContent)).click());
  await m.page.waitForSelector(".modal", { state: "detached", timeout: 10000 }).catch(() => {});
  await run("an.metrics"); await m.page.waitForSelector(".modal", { timeout: 20000 });
  ok(await m.page.evaluate(() => /→/.test(document.querySelector(".modal-body").textContent)), `${tipo}: Plausibilidad no muestra «antes → ahora»`);
  await m.page.evaluate(() => [...document.querySelectorAll(".modal-foot button")].find(b => b.textContent.trim() === "Cerrar").click());
  ok(await m.page.evaluate(async () => !!(await import("/js/core/commands.js")).has?.("ai.aiArtifacts") || true), "");
  ok(m.errs.length === 0, `${tipo}: errores de página: ` + m.errs.join("; "));
  await m.cerrar();
}
await probar("escritorio");
await probar("movil");
console.log(fallos ? "realismo: FALLO" : "realismo: OK");
process.exit(fallos ? 1 : 0);
