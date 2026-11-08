/* ═══════════════════════════════════════════════════════════════
   PRUEBA · Reordenar capas (botones ↑↓ y arrastre del asa)
   Móvil y escritorio. Comprueba el orden, un solo paso de historial
   al arrastrar y que deshacer lo devuelve.
   ═══════════════════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";
let fallos = 0;
const ok = (c, m) => { console.log((c ? "OK    " : "FALLO ") + m); if(!c) fallos++; };

for(const tipo of ["escritorio", "movil"]){
  const { page, errs, cerrar } = await abrir(tipo);
  await page.evaluate(async () => {
    const D = await import("/js/core/doc.js");
    D.newDoc(200, 150, { name: "t" });
    for(const n of ["A", "B", "C", "D"]) D.addLayer({ name: n });
  });
  const orden = () => page.evaluate(async () => (await import("/js/core/doc.js")).doc.layers.map(l => l.name).filter(n => n !== "Fondo").join(""));
  ok(await orden() === "ABCD", `${tipo}: orden inicial ABCD`);
  await page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.setActive(D.doc.layers.find(l => l.name === "A").id); });
  await page.evaluate(async () => (await import("/js/editor/layers/groups.js")).moveLayerOrGroup((await import("/js/core/doc.js")).doc.layers.find(l => l.name === "A").id, 2));
  ok(await orden() === "BCAD", `${tipo}: subir A dos puestos → BCAD`);
  await page.evaluate(async () => { (await import("/js/core/history.js")).undo(); });
  ok(await orden() === "ABCD", `${tipo}: un solo deshacer devuelve ABCD`);
  // Arrastre real con el asa (escritorio: el panel está visible)
  if(tipo === "escritorio"){
    const g = page.locator("#layerList .layer").filter({ has: page.locator(".name", { hasText: /^A$/ }) }).locator("[data-grip]");
    const alto = page.locator("#layerList .layer").filter({ has: page.locator(".name", { hasText: /^D$/ }) });
    const bg = await g.boundingBox(), bd = await alto.boundingBox();
    await page.mouse.move(bg.x + 5, bg.y + 5); await page.mouse.down();
    await page.mouse.move(bd.x + 40, bd.y + 2, { steps: 6 }); await page.mouse.up();
    ok(await orden() === "BCDA", `${tipo}: arrastrar A sobre D (arriba) → BCDA`);
    await page.click('#panel-layers [data-cmd="layer.down"]');
    ok(await orden() === "BCAD", `${tipo}: botón ↓ baja la capa activa`);
  }
  ok(errs.length === 0, `${tipo}: sin errores de página ${errs.join("|")}`);
  await cerrar();
}
process.exit(fallos ? 1 : 0);
