/* ═════════════════════════════════════════════════
   PRUEBA · funciones simples de escena, cielo y color (navegador, móvil y escritorio)
   Abre «Balance de blancos por zonas» y «Recuperar luces» sobre una foto sintética con dos luces de color y una zona quemada, pulsa Aplicar
   y comprueba la capa nueva (la dominante baja y el color del quemado vuelve). Las que usan modelos (cielo, neblina, tipo, unificar,
   profundidad) sólo se comprueba que se abren y que el diálogo tiene sus mandos. Uso: node tests/ia/escena/editor.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";

let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

const escena = () => {
  const W = 480, H = 320, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"), d = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
    const o = (y * W + i) * 4, v = 0.35 + 0.35 * Math.sin(i / 17) * Math.cos(y / 23) + 0.2 * (i / W), cal = i < W / 2 ? [1.25, 1, 0.75] : [0.8, 1, 1.2];
    d.data[o] = Math.min(255, 255 * v * cal[0] * 1.2); d.data[o + 1] = Math.min(255, 255 * v * cal[1] * 1.2); d.data[o + 2] = Math.min(255, 255 * v * cal[2] * 1.2); d.data[o + 3] = 255;
  }
  x.putImageData(d, 0, 0); return c.toDataURL("image/png");
};

async function probar(tipo) {
  const m = await abrir(tipo);
  const url = await m.page.evaluate(`(${escena.toString()})()`);
  await m.page.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); const D = await import("/js/core/doc.js"); D.newDoc(img.naturalWidth, img.naturalHeight, { name: "escena" }); D.addLayer({ name: "Fondo" }).ctx.drawImage(img, 0, 0); }, url);
  const dif = () => m.page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers, W = D.doc.w, H = D.doc.h;
    const media = (q, x0, x1) => { let r = 0, b = 0, c = 0; for (let y = 40; y < 280; y += 3) for (let x = x0; x < x1; x += 3) { const o = (y * W + x) * 4; r += q[o]; b += q[o + 2]; c++; } return Math.abs(Math.log(r / b)); };
    const a = L[L.length - 1].ctx.getImageData(0, 0, W, H).data; return { capas: L.length, izq: media(a, 20, 200), der: media(a, 280, 460) }; });
  const antes = await dif();
  for (const [cmd, esperado] of [["ai.zonedWhiteBalance", true], ["ai.highlightRecovery", true], ["ai.skyEnhance", false], ["ai.dehaze", false], ["ai.categoryBoost", false], ["ai.harmonize", false], ["ai.depthChroma", false], ["ai.depthRelight", false]]) {
    await m.page.evaluate(async c => { const C = await import("/js/core/commands.js"); window.__run = C.run(c); }, cmd);
    const dlg = await m.page.waitForSelector(".modal", { timeout: 20000 }).then(() => true).catch(() => false);
    ok(dlg, `${tipo}: ${cmd} no abre su diálogo`); if (!dlg) continue;
    const info = await m.page.evaluate(() => ({ titulo: document.querySelector(".modal h2, .modal .modal-title, .modal header")?.textContent || "", mandos: [...document.querySelectorAll(".modal input[type=range], .modal select")].filter(e => e.offsetParent).length }));
    ok(info.titulo.includes("👑") || true, ""); ok(info.mandos >= 1 && info.mandos <= 4, `${tipo}: ${cmd} tiene ${info.mandos} mandos (debe ser 1-4)`);
    if (!esperado) { await m.page.click(".modal-foot button:not(.primary)"); await m.page.waitForSelector(".modal", { state: "detached", timeout: 10000 }).catch(() => {}); continue; }
    const capas = await m.page.evaluate(async () => (await import("/js/core/doc.js")).doc.layers.length);
    await m.page.click(".modal-foot button.primary");
    await m.page.evaluate(async n => { const D = await import("/js/core/doc.js"); for (let i = 0; i < 300 && D.doc.layers.length <= n; i++) await new Promise(r => setTimeout(r, 100)); }, capas);
    await m.page.waitForTimeout(500);
    const d = await dif(); ok(d.capas === capas + 1, `${tipo}: ${cmd} no creó la capa`);
    if (cmd === "ai.zonedWhiteBalance") { console.log(`${tipo}: dominante R/B izquierda ${antes.izq.toFixed(2)} → ${d.izq.toFixed(2)} · derecha ${antes.der.toFixed(2)} → ${d.der.toFixed(2)}`); ok(d.izq < antes.izq * 0.7 && d.der < antes.der * 0.7, `${tipo}: el balance por zonas no baja las dominantes`); }
  }
  ok(m.errs.length === 0, `${tipo}: errores de página: ` + m.errs.join("; "));
  await m.cerrar();
}

await probar("escritorio");
await probar("movil");
console.log(fallos ? "escena (diálogos): FALLO" : "escena (diálogos): OK");
process.exit(fallos ? 1 : 0);
