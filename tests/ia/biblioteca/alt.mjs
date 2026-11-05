/* ═════════════════════════════════════════════════
   PRUEBA · Texto alternativo (navegador, móvil y escritorio)
   Foto roja sintética: el informe trae una «Descripción» que empieza por «Fotografía» y menciona el rojo. Uso: node tests/ia/biblioteca/alt.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
async function probar(tipo){
  const m = await abrir(tipo);
  await m.page.evaluate(() => { setInterval(() => [...document.querySelectorAll("button")].find(b => /^Descargar/.test(b.textContent.trim()))?.click(), 300); });
  await m.page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(300, 200, { name: "x", fill: "#d02020" }); const C = await import("/js/core/commands.js"); window.__p = Promise.resolve(C.run("ai.altText")).catch(() => {}); });
  await m.page.waitForSelector(".modal", { timeout: 20000 }); await m.page.click(".modal-foot button.primary");
  const txt = await m.page.waitForFunction(() => { const t = document.querySelector(".modal-body")?.textContent || ""; return /Descripci/.test(t) ? t : false; }, null, { timeout: 90000 }).then(h => h.jsonValue()).catch(() => "");
  console.log(tipo, txt.replace(/\s+/g, " ").slice(0, 200));
  ok(/Fotografía/.test(txt) && /rojos/.test(txt), `${tipo}: descripción sin rojos`); ok(m.errs.length === 0, `${tipo}: errores ${m.errs.slice(0, 2)}`); await m.cerrar();
}
await probar("escritorio"); await probar("movil");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · texto alternativo"); process.exit(fallos ? 1 : 0);
