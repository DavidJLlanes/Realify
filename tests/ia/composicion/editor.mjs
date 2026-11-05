/* ═════════════════════════════════════════════════
   PRUEBA · composición (navegador, móvil y escritorio)
   «Texto en zona libre»: foto con un sujeto oscuro en el centro y cielo claro arriba; escribe un texto, pulsa Colocar y comprueba que sale en una
   capa nueva, fuera del centro. «Pincel inteligente» y «Borrado ligero»: se abren a pantalla completa (.sam-tool). Uso: node tests/ia/composicion/editor.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";

let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const foto = () => {
  const W = 480, H = 320, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#cfe3f5"); g.addColorStop(1, "#7a8a70"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "#2a2018"; x.beginPath(); x.ellipse(W / 2, H * 0.6, 90, 110, 0, 0, 7); x.fill(); return c.toDataURL("image/png");
};

async function probar(tipo) {
  const m = await abrir(tipo);
  const url = await m.page.evaluate(`(${foto.toString()})()`);
  await m.page.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); const D = await import("/js/core/doc.js"); D.newDoc(img.naturalWidth, img.naturalHeight, { name: "comp", fill: "#fff" }); const L = D.doc.layers[0]; L.ctx.drawImage(img, 0, 0); }, url);
  await m.page.evaluate(async () => { const C = await import("/js/core/commands.js"); window.__run = C.run("ai.textPlacement"); });
  ok(await m.page.waitForSelector(".modal", { timeout: 20000 }).then(() => true).catch(() => false), `${tipo}: no abre el diálogo de texto`);
  const caja = await m.page.evaluate(() => ({ texto: !!document.querySelector('.modal input[type=text]'), mandos: document.querySelectorAll('.modal input, .modal select').length }));
  ok(caja.texto && caja.mandos <= 5, `${tipo}: el diálogo debe tener campo de texto y ≤ 4 mandos (${JSON.stringify(caja)})`);
  await m.page.fill('.modal input[type=text]', "Verano");
  const n = await m.page.evaluate(async () => (await import("/js/core/doc.js")).doc.layers.length);
  await m.page.click(".modal-foot button.primary");
  await m.page.evaluate(async n => { const D = await import("/js/core/doc.js"); for (let i = 0; i < 300 && D.doc.layers.length <= n; i++) await new Promise(r => setTimeout(r, 100)); }, n);
  const r = await m.page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers[D.doc.layers.length - 1], W = D.doc.w, H = D.doc.h, a = L.ctx.getImageData(0, 0, W, H).data;
    let x0 = W, x1 = 0, y0 = H, y1 = 0, cnt = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a[(y * W + x) * 4 + 3] > 100) { cnt++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { capas: D.doc.layers.length, cnt, x0, x1, y0, y1, W, H }; });
  ok(r.capas === n + 1 && r.cnt > 50, `${tipo}: no creó la capa de texto (${JSON.stringify(r)})`);
  const cy = (r.y0 + r.y1) / 2, cx = (r.x0 + r.x1) / 2, enSujeto = Math.abs(cx - r.W / 2) < 90 && cy > r.H * 0.3 && cy < r.H * 0.9;
  ok(!enSujeto, `${tipo}: el texto cae sobre el sujeto (${JSON.stringify(r)})`);
  console.log(`${tipo}: texto en x ${r.x0}-${r.x1}, y ${r.y0}-${r.y1} de ${r.W}×${r.H}`);
  for (const cmd of ["ai.smartBrush", "ai.quickErase"]) {
    await m.page.evaluate(async c => { const C = await import("/js/core/commands.js"); window.__r2 = C.run(c); }, cmd);
    ok(await m.page.waitForSelector(".sam-tool", { timeout: 20000 }).then(() => true).catch(() => false), `${tipo}: ${cmd} no abre la ventana`);
    await m.page.evaluate(() => document.querySelector(".sam-tool [data-act=cancel], .sam-tool .fs-cancel, .sam-tool button")?.click());
    await m.page.keyboard.press("Escape"); await m.page.waitForTimeout(300);
    await m.page.evaluate(() => document.querySelectorAll(".sam-tool").forEach(e => e.remove()));
    await m.page.evaluate(async () => { const S = await import("/js/features/samtools.js"); });
  }
  ok(m.errs.length === 0, `${tipo}: errores de página: ` + m.errs.join("; "));
  await m.cerrar();
}
await probar("escritorio");
await probar("movil");
console.log(fallos ? "composición: FALLO" : "composición: OK");
process.exit(fallos ? 1 : 0);
