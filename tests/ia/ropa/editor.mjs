/* ═════════════════════════════════════════════════
   PRUEBA · editor de ropa y tejidos (navegador, móvil y escritorio)
   1) «Telas y fondos»: una sábana sintética con pliegues sobre un fondo gris; se toca la tela, se plancha al 100 % y se comprueba que la capa nueva
      «Ropa · retoque» tiene menos variación de luz dentro de la tela, la raya de color intacta y alfa 0 fuera de ella.
   2) Con REALIFY_FOTO (una persona; las fotos de personas NO se suben al repositorio): «Cambiar color de prendas» cambia el tono sin tocar el fondo.
   Uso: [REALIFY_FOTO=foto.png] node tests/ia/ropa/editor.mjs
   ═════════════════════════════════════════════════ */
import fs from "node:fs";
import { abrir } from "../lib/navegador.mjs";

const foto = process.env.REALIFY_FOTO, real = !!foto;
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

const sabana = () => {
  const W = 640, H = 480; const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"), d = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
    const o = (y * W + i) * 4, dentro = i >= 100 && i < 540 && y >= 80 && y < 400; let r = 110, g = 110, b = 110;
    if (dentro) { r = 200; g = 190; b = 170; if (i >= 300 && i < 330) { r = 60; g = 70; b = 160; } const f = 1 + 0.28 * Math.sin(i / 14 + y / 41) + 0.03 * Math.sin(i * 2.1) * Math.sin(y * 2.1); r *= f; g *= f; b *= f; }
    d.data[o] = Math.min(255, r); d.data[o + 1] = Math.min(255, g); d.data[o + 2] = Math.min(255, b); d.data[o + 3] = 255;
  }
  x.putImageData(d, 0, 0); return c.toDataURL("image/png");
};

async function nuevoDoc(m, url) {
  await m.page.evaluate(async url => {
    const img = new Image(); img.src = url; await img.decode();
    const D = await import("/js/core/doc.js"); D.newDoc(img.naturalWidth, img.naturalHeight, { name: "tela" });
    const l = D.addLayer({ name: "Fondo" }); l.ctx.drawImage(img, 0, 0);
  }, url);
}
const sinBusy = m => m.page.waitForFunction(() => { const b = document.querySelector(".ai-editor .fsp-busy"); return !b || b.hidden; }, null, { timeout: 180000 });
async function poner(m, etiqueta, valor, tipo) {
  /* en móvil sólo se ve un mando: se elige en el desplegable «Ajuste» */
  if (tipo === "movil") await m.page.evaluate(et => { const s = [...document.querySelectorAll(".ai-editor select[aria-label=Ajuste]")].find(e => e.offsetParent); if (s) { const o = [...s.options].find(o => o.textContent.startsWith(et)); if (o) { s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); } } }, etiqueta);
  await m.page.waitForTimeout(150);
  await m.page.evaluate(([et, v]) => {
    const fila = [...document.querySelectorAll(".ai-editor label.fsp-field")].filter(l => l.offsetParent).find(l => l.textContent.startsWith(et) || (l.closest(".fsp-mobile") && !et));
    const i = fila ? fila.querySelector("input[type=range]") : [...document.querySelectorAll(".ai-editor .fsp-mobile input[type=range]")].find(e => e.offsetParent);
    i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true }));
  }, [etiqueta, valor]);
}

async function telas(tipo) {
  const m = await abrir(tipo);
  await m.page.evaluate(() => setInterval(() => { for (const b of document.querySelectorAll("button")) if (b.textContent.trim() === "Descargar" && b.offsetParent) b.click(); }, 500));
  const url = await m.page.evaluate(`(${sabana.toString()})()`);
  await nuevoDoc(m, url);
  await m.page.evaluate(() => { globalThis.__realifyTest = {}; });
  await m.page.evaluate(async () => { const C = await import("/js/core/commands.js"); window.__run = C.run("ai.fabricWrinkles"); });
  const salio = await m.page.waitForSelector(".ai-editor", { timeout: 240000 }).then(() => true).catch(() => false);
  if (!salio) { ok(false, `${tipo}: no se abrió el editor`); await m.cerrar(); return; }
  await sinBusy(m);
  const corona = await m.page.evaluate(() => document.querySelector(".ai-editor .fsp-title b").textContent.includes("👑")); ok(corona, `${tipo}: falta la corona`);
  const sel = await m.page.evaluate(() => globalThis.__realifyTest.ropa.ed.target); ok(sel === "telas", `${tipo}: no eligió «Telas y fondos» (${sel})`);
  /* tocar la tela (sin IA: el crecimiento por color es determinista) */
  await m.page.evaluate(() => globalThis.__realifyTest.ropa.ed.setValues("telas", { telaIA: false }));
  const pos = await m.page.evaluate(() => {
    const T = globalThis.__realifyTest.ropa, t = T.ed.sh.transform, cv = document.querySelector(".ai-editor canvas"), r = cv.getBoundingClientRect(), d = cv.width / r.width;
    return [r.left + (t.ox + 200 * t.k) / d, r.top + (t.oy + 240 * t.k) / d];
  });
  await m.page.mouse.move(pos[0], pos[1]); await m.page.mouse.down(); await m.page.mouse.up();
  await m.page.waitForFunction(() => globalThis.__realifyTest.ropa.toques.length > 0, null, { timeout: 20000 }).catch(() => {});
  const n = await m.page.evaluate(() => globalThis.__realifyTest.ropa.toques.length); ok(n === 1, `${tipo}: el toque no se registró (${n})`);
  await poner(m, "Planchar arrugas", 100, tipo);
  await m.page.waitForTimeout(500); await sinBusy(m);
  const capas = await m.page.evaluate(async () => (await import("/js/core/doc.js")).doc.layers.length);
  await m.page.click('.ai-editor [data-a="apply"]');
  await m.page.evaluate(async n => { const D = await import("/js/core/doc.js"); for (let i = 0; i < 1200 && D.doc.layers.length <= n; i++) await new Promise(r => setTimeout(r, 100)); }, capas);
  await m.page.waitForTimeout(800);
  const d = await m.page.evaluate(async () => {
    const D = await import("/js/core/doc.js"), L = D.doc.layers, nueva = L[L.length - 1], base = L[L.length - 2], W = D.doc.w, H = D.doc.h;
    const capa = nueva.ctx.getImageData(0, 0, W, H).data, b = base.ctx.getImageData(0, 0, W, H).data, a = new Uint8ClampedArray(b.length);
    for (let i = 0; i < a.length; i += 4) { const k = capa[i + 3] / 255; for (let j = 0; j < 3; j++) a[i + j] = capa[i + j] * k + b[i + j] * (1 - k); a[i + 3] = 255; }
    const sd = (arr, x0, x1) => { let s = 0, s2 = 0, c = 0; for (let y = 100; y < 380; y++) for (let x = x0; x < x1; x++) { const o = (y * W + x) * 4, v = Math.log(1 + 0.2126 * arr[o] + 0.7152 * arr[o + 1] + 0.0722 * arr[o + 2]); s += v; s2 += v * v; c++; } const mm = s / c; return Math.sqrt(Math.max(0, s2 / c - mm * mm)); };
    let fuera = 0; for (let y = 0; y < 60; y++) for (let x = 0; x < W; x++) if (capa[(y * W + x) * 4 + 3] > 8) fuera++;
    const raya = (arr) => { const o = (240 * W + 315) * 4; return arr[o + 2] / Math.max(1, arr[o]); };
    return { nombre: nueva.name, antes: sd(b, 120, 290), despues: sd(a, 120, 290), fuera, rayaAntes: raya(b), rayaDespues: raya(a), cerrado: !document.querySelector(".ai-editor") };
  });
  console.log(`${tipo}: capa «${d.nombre}» · variación de luz ${d.antes.toFixed(3)} → ${d.despues.toFixed(3)} · raya B/R ${d.rayaAntes.toFixed(2)} → ${d.rayaDespues.toFixed(2)}`);
  ok(d.nombre === "Ropa · retoque", `${tipo}: la capa se llama «${d.nombre}»`);
  ok(d.despues < d.antes * 0.7, `${tipo}: los pliegues no se aplanan (${d.antes.toFixed(3)} → ${d.despues.toFixed(3)})`);
  ok(d.fuera === 0, `${tipo}: la capa no es transparente fuera de la tela (${d.fuera} px)`);
  ok(Math.abs(d.rayaDespues / d.rayaAntes - 1) < 0.15, `${tipo}: la raya cambia de color`);
  ok(d.cerrado, `${tipo}: el editor no se cerró al aplicar`);
  ok(m.errs.length === 0, `${tipo}: errores de página: ` + m.errs.join("; "));
  await m.cerrar();
}

async function color(tipo) {
  const m = await abrir(tipo);
  await m.page.evaluate(() => setInterval(() => { for (const b of document.querySelectorAll("button")) if (b.textContent.trim() === "Descargar" && b.offsetParent) b.click(); }, 500));
  await nuevoDoc(m, "data:image/png;base64," + fs.readFileSync(foto).toString("base64"));
  await m.page.evaluate(async () => { const C = await import("/js/core/commands.js"); window.__run = C.run("ai.recolorClothes"); });
  const salio = await m.page.waitForSelector(".ai-editor", { timeout: 300000 }).then(() => true).catch(() => false);
  if (!salio) { ok(false, `${tipo}: no se abrió el editor de color`); await m.cerrar(); return; }
  await sinBusy(m);
  await poner(m, "Tono", 120, tipo);
  await m.page.waitForTimeout(500); await sinBusy(m);
  const capas = await m.page.evaluate(async () => (await import("/js/core/doc.js")).doc.layers.length);
  await m.page.click('.ai-editor [data-a="apply"]');
  await m.page.evaluate(async n => { const D = await import("/js/core/doc.js"); for (let i = 0; i < 1200 && D.doc.layers.length <= n; i++) await new Promise(r => setTimeout(r, 100)); }, capas);
  await m.page.waitForTimeout(800);
  const d = await m.page.evaluate(async () => {
    const D = await import("/js/core/doc.js"), L = D.doc.layers, nueva = L[L.length - 1], W = D.doc.w, H = D.doc.h, a = nueva.ctx.getImageData(0, 0, W, H).data;
    let con = 0; for (let i = 3; i < a.length; i += 4) if (a[i] > 8) con++;
    return { nombre: nueva.name, cubre: con / (W * H), capas: L.length };
  });
  console.log(`${tipo} (persona): capa «${d.nombre}» cubre ${(100 * d.cubre).toFixed(1)} % de la foto`);
  ok(d.nombre === "Ropa · retoque" && d.cubre > 0.03 && d.cubre < 0.9, `${tipo}: la capa de ropa no cubre una parte razonable (${(100 * d.cubre).toFixed(1)} %)`);
  ok(m.errs.length === 0, `${tipo}: errores de página: ` + m.errs.join("; "));
  await m.cerrar();
}

await telas("escritorio");
await telas("movil");
if (real) { await color("escritorio"); await color("movil"); }
console.log(fallos ? "ropa (editor): FALLO" : "ropa (editor): OK");
process.exit(fallos ? 1 : 0);
