/* PRUEBA · «Mis estilos» › Aplicar a todas las fotos abiertas: abre tres documentos en pestañas, guarda un estilo cálido y lo aplica a todas. */
import { abrir } from "../lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const m = await abrir("escritorio");
const crea = (nombre, color) => m.page.evaluate(async ([nombre, color]) => { const D = await import("/js/core/doc.js"), T = await import("/js/editor/documents.js"); const ok = await T.openAsNewTab(async () => { D.newDoc(200, 120, { name: nombre, fill: color }); }); return ok; }, [nombre, color]);
ok(await crea("a", "#5a6e96"), "pestaña a"); ok(await crea("b", "#6a7aa0"), "pestaña b"); ok(await crea("c", "#486090"), "pestaña c");
const n = await m.page.evaluate(async () => (await import("/js/editor/documents.js")).listTabs().length); ok(n === 3, "tres pestañas (" + n + ")");
// estilo cálido guardado a mano (estadísticas de una foto naranja)
await m.page.evaluate(async () => { const { medirReferencia } = await import("/js/features/style/shared/referencia.js"), E = await import("/js/features/style/shared/estilos.js");
  const c = document.createElement("canvas"); c.width = 64; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#d29a5a"; x.fillRect(0, 0, 64, 64); x.fillStyle = "#e8c090"; x.fillRect(0, 0, 32, 64);
  E.guardar("Cálido", await medirReferencia(c, false)); });
await m.page.evaluate(async () => { const C = await import("/js/core/commands.js"); window.__p = C.run("ai.myStyles"); });
await m.page.waitForSelector(".modal", { timeout: 20000 });
await m.page.selectOption(".modal select:has(option[value=todas])", "todas"); await m.page.click(".modal-foot button.primary");
await m.page.waitForFunction(() => /aplicado a 3/.test(document.getElementById("toast")?.textContent || ""), null, { timeout: 120000 }).catch(() => ok(false, "no terminó"));
const r = await m.page.evaluate(async () => { const T = await import("/js/editor/documents.js"), D = await import("/js/core/doc.js"), out = [];
  for (const t of T.listTabs()) { T.switchTo(t.tabId, { force: true }); const L = D.doc.layers; const a = L[L.length - 1].ctx.getImageData(5, 5, 1, 1).data; out.push({ capas: L.length, rb: a[0] / Math.max(1, a[2]) }); } return out; });
console.log(JSON.stringify(r));
ok(r.length === 3 && r.every(x => x.capas === 2), "cada pestaña debe tener su capa de estilo");
ok(r.every(x => x.rb > 1.0), "las fotos azuladas pasan a cálidas (R/B > 1)");
ok(m.errs.length === 0, "errores: " + m.errs.join("; "));
await m.cerrar(); console.log(fallos ? "pestañas: FALLO" : "pestañas: OK"); process.exit(fallos ? 1 : 0);
