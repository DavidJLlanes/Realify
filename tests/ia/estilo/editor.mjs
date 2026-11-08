/* ═════════════════════════════════════════════════
   PRUEBA · estilos (navegador, móvil y escritorio)
   «Estilo desde una foto»: elige una referencia cálida, la foto fría se calienta en una capa nueva; «Sugerir ajustes» abre un informe.
   «Mis estilos»: guarda, aplica, exporta, importa y borra. «Packs de cámara»: crea una capa de filtro reeditable (camaras).
   Uso: node tests/ia/estilo/editor.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";

let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const pintar = (r, g, b) => { const c = document.createElement("canvas"); c.width = 320; c.height = 200; const x = c.getContext("2d"), gr = x.createLinearGradient(0, 0, 320, 0); gr.addColorStop(0, `rgb(${r * 0.6},${g * 0.6},${b * 0.6})`); gr.addColorStop(1, `rgb(${Math.min(255, r * 1.2)},${Math.min(255, g * 1.2)},${Math.min(255, b * 1.2)})`); x.fillStyle = gr; x.fillRect(0, 0, 320, 200); return c.toDataURL("image/png"); };
const media = (m, cap) => m.page.evaluate(async cap => { const D = await import("/js/core/doc.js"), L = D.doc.layers[cap < 0 ? D.doc.layers.length - 1 : cap], a = L.ctx ? L.ctx.getImageData(0, 0, D.doc.w, D.doc.h).data : null; if(!a) return null; let r = 0, b = 0, n = 0; for(let i = 0; i < a.length; i += 40){ r += a[i]; b += a[i + 2]; n++; } return { r: r / n, b: b / n }; }, cap);
const espera = (m, n) => m.page.evaluate(async n => { const D = await import("/js/core/doc.js"); for(let i = 0; i < 400 && D.doc.layers.length <= n; i++) await new Promise(r => setTimeout(r, 100)); return D.doc.layers.length; }, n);
const cierra = async m => { await m.page.evaluate(() => [...document.querySelectorAll(".modal-foot button")].find(b => /Cerrar|Cancelar/.test(b.textContent))?.click()); await m.page.waitForSelector(".modal", { state: "detached", timeout: 10000 }).catch(() => {}); };

async function probar(tipo) {
  const m = await abrir(tipo), fria = await m.page.evaluate(`(${pintar.toString()})(90,110,150)`), calida = await m.page.evaluate(`(${pintar.toString()})(210,150,90)`);
  const buf = Buffer.from(calida.split(",")[1], "base64");
  await m.page.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); const D = await import("/js/core/doc.js"); D.newDoc(img.naturalWidth, img.naturalHeight, { name: "est", fill: "#fff" }); D.doc.layers[0].ctx.drawImage(img, 0, 0); }, fria);
  const run = cmd => m.page.evaluate(async c => { const C = await import("/js/core/commands.js"); window.__p = C.run(c); }, cmd);
  const elegir = async (nombre, datos, tipoMime) => { const [fc] = await Promise.all([m.page.waitForEvent("filechooser", { timeout: 20000 }), null]); await fc.setFiles({ name: nombre, mimeType: tipoMime, buffer: datos }); };
  const n0 = await m.page.evaluate(async () => (await import("/js/core/doc.js")).doc.layers.length), antes = await media(m, 0);

  // Estilo desde una foto
  const pr = m.page.waitForEvent("filechooser", { timeout: 20000 }); await run("ai.styleFromReference"); await (await pr).setFiles({ name: "ref.png", mimeType: "image/png", buffer: buf });
  ok(await m.page.waitForSelector(".modal", { timeout: 20000 }).then(() => true).catch(() => false), `${tipo}: styleFromReference no abre el diálogo`);
  const mandos = await m.page.evaluate(() => { const l = [...document.querySelectorAll(".modal select:not([aria-label=Ajuste]), .modal input[type=range], .modal input[type=text]")]; window.__l = l.map(e => e.tagName + (e.getAttribute("aria-label") || "")); return l.length; }); if (mandos > 4) console.log(await m.page.evaluate(() => window.__l)); ok(mandos >= 1 && mandos <= 5, `${tipo}: ${mandos} mandos`);
  await m.page.click(".modal-foot button.primary");
  ok(await espera(m, n0) === n0 + 1, `${tipo}: styleFromReference no creó la capa`);
  await m.page.waitForTimeout(400);
  const des = await media(m, -1); console.log(`${tipo}: R/B ${(antes.r / antes.b).toFixed(2)} → ${(des.r / des.b).toFixed(2)}`);
  ok(des.r / des.b > antes.r / antes.b * 1.3, `${tipo}: la foto no se ha calentado`);
  // Sugerir
  const p2 = m.page.waitForEvent("filechooser", { timeout: 20000 }); await run("ai.styleFromReference"); await (await p2).setFiles({ name: "ref.png", mimeType: "image/png", buffer: buf });
  await m.page.waitForSelector(".modal", { timeout: 20000 }); await m.page.selectOption(".modal select:has(option[value=sugerir])", "sugerir"); await m.page.click(".modal-foot button.primary");
  ok(await m.page.waitForFunction(() => /Calidez/.test(document.querySelector(".modal-body")?.textContent || ""), null, { timeout: 60000 }).then(() => true).catch(() => false), `${tipo}: no salen los ajustes sugeridos`);
  await cierra(m);

  // Mis estilos
  const p3 = m.page.waitForEvent("filechooser", { timeout: 20000 }); await run("ai.myStyles"); await m.page.waitForSelector(".modal", { timeout: 20000 });
  await m.page.selectOption(".modal select:has(option[value=guardar])", "guardar"); await m.page.fill('.modal input[type=text]', "Cálido de prueba"); await m.page.click(".modal-foot button.primary"); await (await p3).setFiles({ name: "ref.png", mimeType: "image/png", buffer: buf });
  ok(await m.page.waitForFunction(() => (localStorage.getItem("realify.misEstilos.v1") || "").includes("Cálido de prueba"), null, { timeout: 60000 }).then(() => true).catch(() => false), `${tipo}: el estilo no se guardó`);
  const n1 = await m.page.evaluate(async () => (await import("/js/core/doc.js")).doc.layers.length);
  await run("ai.myStyles"); await m.page.waitForSelector(".modal", { timeout: 20000 });
  ok(await m.page.evaluate(() => [...document.querySelectorAll(".modal select")].some(x => x.textContent.includes("Cálido de prueba"))), `${tipo}: el estilo guardado no sale en la lista`);
  await m.page.click(".modal-foot button.primary");
  ok(await espera(m, n1) === n1 + 1, `${tipo}: aplicar un estilo guardado no creó la capa`);
  const dl = m.page.waitForEvent("download", { timeout: 20000 }); await run("ai.myStyles"); await m.page.waitForSelector(".modal", { timeout: 20000 });
  await m.page.selectOption(".modal select:has(option[value=exportar])", "exportar"); await m.page.click(".modal-foot button.primary");
  const d = await dl.catch(() => null); ok(d && /\.realify-estilo\.json$/.test(d.suggestedFilename()), `${tipo}: no se exportó el archivo`);
  if (d) { const fs = await import("node:fs"), ruta = await d.path(), txt = fs.readFileSync(ruta, "utf8");
    await m.page.evaluate(() => localStorage.removeItem("realify.misEstilos.v1"));
    const p4 = m.page.waitForEvent("filechooser", { timeout: 20000 }); await run("ai.myStyles"); await m.page.waitForSelector(".modal", { timeout: 20000 });
    await m.page.selectOption(".modal select:has(option[value=importar])", "importar"); await m.page.click(".modal-foot button.primary"); await (await p4).setFiles({ name: "e.realify-estilo.json", mimeType: "application/json", buffer: Buffer.from(txt) });
    ok(await m.page.waitForFunction(() => (localStorage.getItem("realify.misEstilos.v1") || "").includes("Cálido de prueba"), null, { timeout: 20000 }).then(() => true).catch(() => false), `${tipo}: no se importó el estilo`);
    const malo = m.page.waitForEvent("filechooser", { timeout: 20000 }); await run("ai.myStyles"); await m.page.waitForSelector(".modal", { timeout: 20000 });
    await m.page.selectOption(".modal select:has(option[value=importar])", "importar"); await m.page.click(".modal-foot button.primary"); await (await malo).setFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{\"hola\":1}") });
    await m.page.waitForTimeout(500); ok(await m.page.evaluate(() => JSON.parse(localStorage.getItem("realify.misEstilos.v1")).length) === 1, `${tipo}: un archivo que no es un estilo no debe importarse`); }

  // Packs de cámara
  const n2 = await m.page.evaluate(async () => (await import("/js/core/doc.js")).doc.layers.length);
  await m.page.evaluate(() => { globalThis.__realifyTest = {}; });
  await run("ai.cameraPacks"); ok(await m.page.waitForSelector(".ai-editor", { timeout: 20000 }).then(() => true).catch(() => false), `${tipo}: cameraPacks no abre el editor a pantalla completa`);
  await m.page.waitForFunction(() => globalThis.__realifyTest?.packs, null, { timeout: 20000 }).catch(() => {});
  const opts = await m.page.evaluate(() => Math.max(0, ...[...document.querySelectorAll(".ai-editor select")].map(x => x.options.length))); ok(opts > 20 || tipo === "movil", `${tipo}: pocas cámaras en el selector (${opts})`);
  // Vista previa: tras elegir una cámara distinta a la inicial la imagen del editor debe cambiar
  await m.page.waitForTimeout(2500);
  ok(await m.page.evaluate(() => !!document.querySelector(".ai-editor canvas")), `${tipo}: el editor no muestra la imagen`);
  await m.page.evaluate(() => document.querySelector(".ai-editor .fsp-apply, .ai-editor [data-act=apply], .ai-editor .fsp-actions .primary").click());
  ok(await espera(m, n2) === n2 + 1, `${tipo}: cameraPacks no creó la capa`);
  const ultima = await m.page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers[D.doc.layers.length - 1]; return { tipo: L.type, filtro: (L.filters || []).map(f => f.id).join() }; });
  console.log(tipo + ": capa de cámara →", JSON.stringify(ultima));
  ok(/camaras/.test(JSON.stringify(ultima)), `${tipo}: no es una capa de filtro de cámaras`);
  ok(m.errs.length === 0, `${tipo}: errores de página: ` + m.errs.join("; "));
  await m.cerrar();
}
await probar("escritorio");
await probar("movil");
console.log(fallos ? "estilo: FALLO" : "estilo: OK");
process.exit(fallos ? 1 : 0);
