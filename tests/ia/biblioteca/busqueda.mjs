/* ═════════════════════════════════════════════════
   PRUEBA · Buscar fotos (navegador, móvil y escritorio)
   Indexa 3 fotos sintéticas (roja, azul, gris sin color), busca por color y «blanco y negro», comprueba que el índice sobrevive a recargar
   (IndexedDB) y que se puede vaciar. Uso: node tests/ia/biblioteca/busqueda.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

async function probar(tipo){
  const m = await abrir(tipo);
  await m.page.evaluate(() => { setInterval(() => [...document.querySelectorAll("button")].find(b => /^Descargar/.test(b.textContent.trim()))?.click(), 300); });
  await m.page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(200, 150, { name: "x", fill: "#fff" }); const C = await import("/js/core/commands.js"); Promise.resolve(C.run("ai.searchPhotos")).catch(() => {}); });
  ok(await m.page.waitForFunction(() => window.__realifyTest?.busqueda, null, { timeout: 30000 }).then(() => true).catch(() => false), `${tipo}: no abre`);
  const r = await m.page.evaluate(async () => {
    const mk = (nombre, fn) => new Promise(res => { const c = document.createElement("canvas"); c.width = 400; c.height = 300; const x = c.getContext("2d"); fn(x); c.toBlob(b => res(new File([b], nombre + ".png", { type: "image/png", lastModified: 1 }))); });
    const T = window.__realifyTest.busqueda;
    const fs = [await mk("roja", x => { x.fillStyle = "#d02020"; x.fillRect(0, 0, 400, 300); }), await mk("azul", x => { x.fillStyle = "#1f4fd8"; x.fillRect(0, 0, 400, 300); }), await mk("gris", x => { const g = x.createLinearGradient(0, 0, 400, 300); g.addColorStop(0, "#222"); g.addColorStop(1, "#ddd"); x.fillStyle = g; x.fillRect(0, 0, 400, 300); })];
    await T.indexar(fs);
    return { n: T.regs().length, rojo: await T.buscarTexto("rojo"), azul: await T.buscarTexto("azul"), bn: await T.buscarTexto("blanco y negro"), nada: await T.buscarTexto("jirafa") };
  });
  console.log(tipo, JSON.stringify(r));
  ok(r.n === 3, `${tipo}: ${r.n} indexadas`); ok(r.rojo[0] === "roja.png", `${tipo}: rojo → ${r.rojo}`); ok(r.azul[0] === "azul.png", `${tipo}: azul → ${r.azul}`);
  ok(r.bn.includes("gris.png") && !r.bn.includes("roja.png"), `${tipo}: byn → ${r.bn}`); ok(!r.nada.includes("roja.png"), `${tipo}: jirafa no debería dar la roja`);
  // persistencia
  const n2 = await m.page.evaluate(async () => { const I = await import("/js/features/library/search-photos/indice.js"); return (await I.todos()).length; });
  ok(n2 === 3, `${tipo}: índice persistido ${n2}`);
  const n3 = await m.page.evaluate(async () => { const I = await import("/js/features/library/search-photos/indice.js"); await I.vaciar(); return (await I.todos()).length; });
  ok(n3 === 0, `${tipo}: no vacía`);
  ok(m.errs.length === 0, `${tipo}: errores ${m.errs.slice(0, 2)}`);
  await m.cerrar();
}
await probar("escritorio"); await probar("movil");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · buscar fotos"); process.exit(fallos ? 1 : 0);
