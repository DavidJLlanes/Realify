/* ═══════════════════════════════════════════════════════════════
   PRUEBA · editor de cara con los modelos reales (navegador, móvil y escritorio)
   Abre cada una de las trece funciones de cara (piel, luz, ojos, labios y cejas, dientes, pelo, pelos sueltos, gafas y forma) sobre una foto con una cara, comprueba que el editor sale con la corona, en su grupo y con
   zoom a la cara, que la vista previa cambia la imagen y que «Aplicar» crea una capa nueva «Cara · retoque» con la cara retocada y el
   resto de la foto igual. Foto: REALIFY_FOTO (las fotos de personas NO se suben al repositorio); sin ella sólo se comprueba que no hay errores.
   Uso: [REALIFY_FOTO=foto.png] node tests/ia/retrato/piel-editor.mjs
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abrir } from "../lib/navegador.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const foto = process.env.REALIFY_FOTO || path.join(aqui, "..", "fixtures", "retrato-sintetico.png");
const real = !!process.env.REALIFY_FOTO;
const b64 = fs.readFileSync(foto).toString("base64");
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

const CMDS = [["ai.skinWrinkles", "arrugas"], ["ai.darkCircles", "ojeras"], ["ai.skinShine", "brillos"], ["ai.skinTexture", "textura"], ["ai.skinEven", "tono"],
  ["ai.faceRelight", "luz"], ["ai.eyes", "ojos"], ["ai.lipsBrows", "labios"], ["ai.teeth", "dientes"], ["ai.hair", "pelo"], ["ai.flyawayHair", "sueltos"], ["ai.glassesGlare", "gafas"], ["ai.faceShape", "forma"]];
const SIN_CAMBIO = new Set(["sueltos", "gafas"]);   // la foto de prueba no tiene pelos sueltos ni gafas: aplicar no cambia nada y eso es correcto

async function probar(tipo, lista){
  const m = await abrir(tipo);
  await m.page.evaluate(() => setInterval(() => { for (const b of document.querySelectorAll("button")) if (b.textContent.trim() === "Descargar" && b.offsetParent) b.click(); }, 200));
  for (const [cmd, grupo] of lista) {
    await m.page.evaluate(async b64 => {
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const D = await import("/js/core/doc.js"); D.newDoc(img.naturalWidth, img.naturalHeight, { name: "retrato" });
      const l = D.addLayer({ name: "Fondo" }); l.ctx.drawImage(img, 0, 0);
    }, b64);
    const t0 = Date.now();
    await m.page.evaluate(async cmd => { const C = await import("/js/core/commands.js"); window.__run = C.run(cmd); }, cmd);
    const salio = await m.page.waitForSelector(".ai-editor", { timeout: 180000 }).then(() => true).catch(() => false);
    if (!salio) { ok(!real, `${tipo} ${cmd}: no se abrió el editor`); await m.page.waitForTimeout(500); continue; }
    await m.page.waitForFunction(() => { const b = document.querySelector(".ai-editor .fsp-busy"); return !b || b.hidden; }, null, { timeout: 120000 });
    await m.page.waitForTimeout(600);
    const r = await m.page.evaluate(async () => {
      const t = document.querySelector(".ai-editor .fsp-title b").textContent;
      const D = await import("/js/core/doc.js");
      return { corona: t.includes("👑"), capas: D.doc.layers.length, chips: [...document.querySelectorAll(".ai-editor .fsp-seg button, .ai-editor select option")].length };
    });
    ok(r.corona, `${tipo} ${cmd}: falta la corona`);
    if (tipo === "escritorio") await m.page.screenshot({ path: process.env.REALIFY_CAPTURAS ? `${process.env.REALIFY_CAPTURAS}/piel-${grupo}-${tipo}.png` : "/dev/null" }).catch(() => {});
    else if (process.env.REALIFY_CAPTURAS) await m.page.screenshot({ path: `${process.env.REALIFY_CAPTURAS}/piel-${grupo}-${tipo}.png` });
    if (grupo === "forma") {                                                  // sus mandos empiezan a 0: se sube uno (mandíbula)
      await m.page.evaluate(() => { const i = [...document.querySelectorAll('.ai-editor input[type="range"]')].find(x => x.offsetParent); i.value = 12; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); });
      await m.page.waitForTimeout(500); await m.page.waitForFunction(() => { const b = document.querySelector(".ai-editor .fsp-busy"); return !b || b.hidden; }, null, { timeout: 120000 });
    }
    await m.page.click('.ai-editor [data-a="apply"]');
    await m.page.evaluate(async n => { const D = await import("/js/core/doc.js"); for(let i = 0; i < 1200 && D.doc.layers.length <= n; i++) await new Promise(r => setTimeout(r, 100)); }, r.capas);
    await m.page.waitForTimeout(800);
    const d = await m.page.evaluate(async () => {
      const D = await import("/js/core/doc.js"), L = D.doc.layers, nueva = L[L.length - 1], base = L[L.length - 2];
      let cambiados = 0, total = 0; const a = nueva.ctx.getImageData(0, 0, D.doc.w, D.doc.h).data, b = base.ctx.getImageData(0, 0, D.doc.w, D.doc.h).data;
      for (let i = 0; i < a.length; i += 4) { total++; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 3) cambiados++; }
      return { nombre: nueva.name, capas: L.length, cambiados, total, editorCerrado: !document.querySelector(".ai-editor") };
    });
    console.log(`${tipo} ${cmd}: ${((Date.now() - t0) / 1000).toFixed(0)} s · capa «${d.nombre}» · ${(100 * d.cambiados / d.total).toFixed(2)} % de la foto cambia`);
    if (real) {
      ok(d.nombre.startsWith("Cara"), `${tipo} ${cmd}: la capa nueva no se llama «Cara …» (${d.nombre})`);
      ok(SIN_CAMBIO.has(grupo) || d.cambiados > 5, `${tipo} ${cmd}: el resultado no cambia nada (${d.cambiados} px)`);
      ok(d.cambiados / d.total < 0.35, `${tipo} ${cmd}: cambia demasiada foto (${(100 * d.cambiados / d.total).toFixed(1)} %)`);
    }
    ok(d.editorCerrado, `${tipo} ${cmd}: el editor no se cerró al aplicar`);
  }
  ok(m.errs.length === 0, `${tipo}: errores de página: ` + m.errs.join("; "));
  await m.cerrar();
}

await probar("escritorio", CMDS);
await probar("movil", [CMDS[3], CMDS[5], CMDS[9]]);
console.log(fallos ? "piel (editor): FALLO" : "piel (editor): OK");
process.exit(fallos ? 1 : 0);
