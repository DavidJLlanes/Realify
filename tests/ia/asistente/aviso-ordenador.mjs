/* ═════════════════════════════════════════════════
   PRUEBA · aviso «sólo en ordenador» (móvil)
   En móvil, el Asistente con el motor Qwen debe enseñar el aviso «sólo funciona en un ordenador» y seguir con las reglas (plan con «Calidez»).
   Uso: node tests/ia/asistente/aviso-ordenador.mjs
   ═════════════════════════════════════════════════ */
import { abrir, documentoDePrueba } from "../lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const m = await abrir("movil"); await documentoDePrueba(m.page);
await m.page.evaluate(async () => { const C = await import("/js/core/commands.js"); window.__r = C.run("ai.assistant"); });
await m.page.waitForSelector(".modal select", { timeout: 15000 });
await m.page.selectOption(".modal select", "qwen");
await m.page.fill('.modal input[type="text"]', "más cálida");
await m.page.click(".modal-foot button.primary");
await m.page.waitForFunction(() => /sólo funciona en un ordenador/.test(document.querySelector(".modal-body")?.textContent || ""), null, { timeout: 15000 }).catch(() => ok(false, "no sale el aviso"));
await m.page.click(".modal-foot button.primary");
await m.page.waitForFunction(() => /Calidez/.test(document.querySelector(".modal-body")?.textContent || ""), null, { timeout: 15000 }).catch(() => ok(false, "no sigue con las reglas"));
ok(m.errs.length === 0, "errores: " + m.errs.join("; "));
await m.cerrar(); console.log(fallos ? `${fallos} FALLOS` : "OK"); process.exit(fallos ? 1 : 0);
