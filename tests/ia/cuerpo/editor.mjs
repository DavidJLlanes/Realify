/* ═══════════════════════════════════════════════════════════════
   PRUEBA · editor de cuerpo con los modelos reales (navegador, móvil y escritorio)
   Abre «Silueta y proporciones» sobre una foto de una persona, mueve un mando, aplica y comprueba la capa «Cuerpo · retoque» (con alfa:
   transparente donde no cambia), que el editor se cierra y que el perfil infantil no ofrece pecho, caderas ni glúteos. Foto: REALIFY_FOTO
   (las fotos de personas NO se suben al repositorio); sin ella sólo se comprueba que no hay errores.
   Uso: [REALIFY_FOTO=foto.png] node tests/ia/cuerpo/editor.mjs
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

async function probar(tipo){
  const m = await abrir(tipo);
  await m.page.evaluate(() => setInterval(() => { for (const b of document.querySelectorAll("button")) if (b.textContent.trim() === "Descargar" && b.offsetParent) b.click(); }, 200));
  await m.page.evaluate(async b64 => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const D = await import("/js/core/doc.js"); D.newDoc(img.naturalWidth, img.naturalHeight, { name: "persona" });
    const l = D.addLayer({ name: "Fondo" }); l.ctx.drawImage(img, 0, 0);
  }, b64);
  const t0 = Date.now();
  await m.page.evaluate(async () => { const C = await import("/js/core/commands.js"); window.__run = C.run("ai.bodyShape"); });
  const salio = await m.page.waitForSelector(".ai-editor", { timeout: 240000 }).then(() => true).catch(() => false);
  if (!salio) { ok(!real, `${tipo}: no se abrió el editor`); await m.cerrar(); return; }
  await m.page.waitForFunction(() => { const b = document.querySelector(".ai-editor .fsp-busy"); return !b || b.hidden; }, null, { timeout: 120000 });
  const r0 = await m.page.evaluate(async () => ({ corona: document.querySelector(".ai-editor .fsp-title b").textContent.includes("👑"),
    perfiles: [...document.querySelectorAll(".ai-editor button[data-perfil]")].filter(b => b.offsetParent).map(b => b.textContent), capas: (await import("/js/core/doc.js")).doc.layers.length }));
  ok(r0.corona, `${tipo}: falta la corona`); ok(r0.perfiles.join() === "Hombre,Mujer,Niño,Niña", `${tipo}: perfiles ${r0.perfiles}`);

  /* perfil infantil: no hay pecho, caderas ni glúteos en ninguna sección (se revisa en escritorio, donde se ven todos los mandos) */
  if (tipo === "escritorio") {
    await m.page.click(".ai-editor button[data-perfil=\"nino\"]:visible"); await m.page.waitForTimeout(300);
    const leer = () => m.page.evaluate(() => document.querySelector(".ai-editor").innerText);
    const txt = await leer();
    ok(txt.includes("Altura") && txt.includes("Hombros"), "infantil: el panel no muestra sus mandos (¿cambió la interfaz?)");
    for (const palabra of ["Pecho", "Caderas", "Glúteos", "Musculatura", "Bronceado"]) ok(!txt.includes(palabra), `infantil: aparece «${palabra}»`);
    await m.page.click(".ai-editor button[data-perfil=\"mujer\"]:visible"); await m.page.waitForTimeout(300);
    const adulto = await leer(); ok(adulto.includes("Pecho") && adulto.includes("Caderas"), "adulto: faltan Pecho o Caderas (el infantil se probaría en vacío)");
  }

  await m.page.evaluate(() => { const i = document.querySelector('.ai-editor input[type="range"]'); i.value = -12; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); });
  await m.page.waitForTimeout(500);
  await m.page.waitForFunction(() => { const b = document.querySelector(".ai-editor .fsp-busy"); return !b || b.hidden; }, null, { timeout: 120000 });
  await m.page.click('.ai-editor [data-a="apply"]');
  await m.page.evaluate(async n => { const D = await import("/js/core/doc.js"); for(let i = 0; i < 1200 && D.doc.layers.length <= n; i++) await new Promise(r => setTimeout(r, 100)); }, r0.capas);
  await m.page.waitForTimeout(800);
  const d = await m.page.evaluate(async () => {
    const D = await import("/js/core/doc.js"), L = D.doc.layers, nueva = L[L.length - 1], base = L[L.length - 2];
    const a = nueva.ctx.getImageData(0, 0, D.doc.w, D.doc.h).data, b = base.ctx.getImageData(0, 0, D.doc.w, D.doc.h).data;
    let cambiados = 0, transp = 0, total = a.length / 4;
    for (let i = 0; i < a.length; i += 4) { if (a[i + 3] < 8) transp++; else if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 3) cambiados++; }
    return { nombre: nueva.name, capas: L.length, cambiados, transp, total, editorCerrado: !document.querySelector(".ai-editor") };
  });
  console.log(`${tipo}: ${((Date.now() - t0) / 1000).toFixed(0)} s · capa «${d.nombre}» · ${(100 * d.cambiados / d.total).toFixed(2)} % cambia · ${(100 * d.transp / d.total).toFixed(0)} % transparente`);
  if (real) {
    ok(d.nombre.startsWith("Cuerpo"), `${tipo}: la capa nueva no se llama «Cuerpo …» (${d.nombre})`);
    ok(d.cambiados > 50, `${tipo}: el resultado no cambia nada (${d.cambiados} px)`);
    ok(d.transp / d.total > 0.15, `${tipo}: la capa no es transparente fuera de la persona (${(100 * d.transp / d.total).toFixed(0)} %)`);
  }
  ok(d.editorCerrado, `${tipo}: el editor no se cerró al aplicar`);
  ok(m.errs.length === 0, `${tipo}: errores de página: ` + m.errs.join("; "));
  await m.cerrar();
}

await probar("escritorio");
await probar("movil");
console.log(fallos ? "cuerpo (editor): FALLO" : "cuerpo (editor): OK");
process.exit(fallos ? 1 : 0);
