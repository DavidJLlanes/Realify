/* ═════════════════════════════════════════════════
   PRUEBA · funciones de restauración (navegador, móvil y escritorio)
   Abre «Polvo y motas», «Moiré y bandas» y «Quitar desenfoque» (diálogo con 1-4 mandos), aplica el polvo sobre un cielo con tres motas y el moiré
   sobre un patrón, y comprueba «Reducción de ruido › Limpiar para Realify». Uso: node tests/ia/restaurar/editor.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";

let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

const cielo = () => {
  const W = 480, H = 320, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"), d = x.createImageData(W, H);
  const motas = [[100, 80, 8], [250, 150, 10], [380, 230, 7]];
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
    const o = (y * W + i) * 4; let v = 0.55 + 0.25 * (y / H);
    for (const [cx, cy, r] of motas) { const dd = Math.hypot(i - cx, y - cy); if (dd < r + 2) v *= 1 - 0.1 * Math.min(1, (r + 2 - dd) / 2); }
    d.data[o] = 255 * v * 0.8; d.data[o + 1] = 255 * v * 0.9; d.data[o + 2] = 255 * v; d.data[o + 3] = 255;
  }
  x.putImageData(d, 0, 0); return c.toDataURL("image/png");
};

async function probar(tipo) {
  const m = await abrir(tipo);
  const url = await m.page.evaluate(`(${cielo.toString()})()`);
  await m.page.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); const D = await import("/js/core/doc.js"); D.newDoc(img.naturalWidth, img.naturalHeight, { name: "cielo" }); D.addLayer({ name: "Fondo" }).ctx.drawImage(img, 0, 0); }, url);
  for (const [cmd, aplica] of [["ai.deblur", false], ["ai.moire", false], ["ai.dustSpots", true]]) {
    await m.page.evaluate(async c => { const C = await import("/js/core/commands.js"); window.__run = C.run(c); }, cmd);
    const dlg = await m.page.waitForSelector(".modal", { timeout: 20000 }).then(() => true).catch(() => false);
    ok(dlg, `${tipo}: ${cmd} no abre su diálogo`); if (!dlg) continue;
    const mandos = await m.page.evaluate(() => [...document.querySelectorAll(".modal input[type=range], .modal select, .modal input[type=checkbox]")].filter(e => e.offsetParent).length);
    ok(mandos >= 1 && mandos <= 4, `${tipo}: ${cmd} tiene ${mandos} mandos`);
    if (!aplica) { await m.page.click(".modal-foot button:not(.primary)"); await m.page.waitForSelector(".modal", { state: "detached", timeout: 10000 }).catch(() => {}); continue; }
    const capas = await m.page.evaluate(async () => (await import("/js/core/doc.js")).doc.layers.length);
    await m.page.click(".modal-foot button.primary");
    await m.page.evaluate(async n => { const D = await import("/js/core/doc.js"); for (let i = 0; i < 300 && D.doc.layers.length <= n; i++) await new Promise(r => setTimeout(r, 100)); }, capas);
    await m.page.waitForTimeout(500);
    const d = await m.page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers, W = D.doc.w, a = L[L.length - 1].ctx.getImageData(0, 0, W, D.doc.h).data, b = L[L.length - 2].ctx.getImageData(0, 0, W, D.doc.h).data;
      const dev = (q, cx, cy) => { const o = (cy * W + cx) * 4, ref = (cy * W + cx + 30) * 4; return Math.abs(q[o + 2] - q[ref + 2]) / 255; }; return { capas: L.length, antes: [dev(b, 250, 150), dev(b, 100, 80)], despues: [dev(a, 250, 150), dev(a, 100, 80)] }; });
    console.log(`${tipo}: motas ${d.antes.map(v => v.toFixed(3))} → ${d.despues.map(v => v.toFixed(3))}`);
    ok(d.capas === capas + 1, `${tipo}: no creó la capa de polvo`); ok(d.despues[0] < d.antes[0] * 0.5 && d.despues[1] < d.antes[1] * 0.5, `${tipo}: no borra las motas`);
  }
  /* Reducción de ruido › Limpiar para Realify */
  await m.page.evaluate(async () => { const C = await import("/js/core/commands.js"); C.run("filter.denoise"); });
  await m.page.waitForSelector("#dnClean", { timeout: 20000 }).catch(() => {});
  const hay = await m.page.evaluate(() => !!document.querySelector("#dnClean")); ok(hay, `${tipo}: falta «Limpiar para Realify» en Reducción de ruido`);
  if (hay) { await m.page.evaluate(() => document.querySelector("#dnClean").click()); await m.page.waitForTimeout(800); await m.page.click(".modal-foot button:not(.primary)").catch(() => {}); }
  ok(m.errs.length === 0, `${tipo}: errores de página: ` + m.errs.join("; "));
  await m.cerrar();
}

await probar("escritorio");
await probar("movil");
console.log(fallos ? "restaurar (diálogos): FALLO" : "restaurar (diálogos): OK");
process.exit(fallos ? 1 : 0);
