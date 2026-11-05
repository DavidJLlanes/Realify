/* ═══════════════════════════════════════════════════════════════
   PRUEBA · análisis de personas con los modelos reales (navegador, WASM/WebGPU)
   Ejecuta js/ai/people/analyze.js sobre una foto: caras, 478 puntos, pose (17), manos, partes del cuerpo y ropa; calidades Bueno y
   Mejor; caché y cancelación. Los modelos se aceptan solos (el aviso de descarga se pulsa automáticamente).
   Foto: la de REALIFY_FOTO (ruta a una imagen con una persona; las fotos de personas NO se suben al repositorio) o, si no hay, el
   retrato sintético de tests/ia/fixtures (sólo se comprueba que el proceso corre sin errores).
   Uso: [REALIFY_FOTO=foto.png] node tests/ia/personas-modelos.mjs
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abrir } from "./lib/navegador.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const foto = process.env.REALIFY_FOTO || path.join(aqui, "fixtures", "retrato-sintetico.png");
const real = !!process.env.REALIFY_FOTO;
const b64 = fs.readFileSync(foto).toString("base64");
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

const m = await abrir("escritorio");
await m.page.evaluate(() => setInterval(() => { for (const b of document.querySelectorAll("button")) if (b.textContent.trim() === "Descargar" && b.offsetParent) b.click(); }, 200));
const r = await m.page.evaluate(async b64 => {
  const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0);
  const { analyze } = await import("/js/ai/people/analyze.js");
  const resumen = a => ({ q: a.calidad, w: a.w, h: a.h, personas: a.personas.map(p => ({
    caja: p.caja, puntos: p.cara.puntos ? p.cara.puntos.length : 0, puntaNariz: p.cara.puntos && p.cara.puntos[1], anchoCara: p.cara.caja.w, nariz: p.pose && p.pose.puntos.nariz, hombroI: p.pose && p.pose.puntos.hombroI,
    prop: p.proporciones, manos: p.manos.length,
    partes: p.partes && Object.fromEntries(Object.entries(p.partes.mascaras).map(([k, v]) => [k, v.reduce((s, x) => s + (x > 127 ? 1 : 0), 0) / v.length])) })) });
  const t0 = performance.now(); const bueno = await analyze(c, { quality: "bueno" }); const t1 = performance.now();
  const otra = await analyze(c, { quality: "bueno" });
  const mejor = await analyze(c, { quality: "mejor" }); const t2 = performance.now();
  const ac = new AbortController(); ac.abort(); let abortado = false;
  const { createPeopleCache } = await import("/js/ai/people/cache.js");
  try { await analyze(c, { quality: "bueno", signal: ac.signal, cache: createPeopleCache() }); } catch (e) { abortado = e.name === "AbortError"; }
  return { bueno: resumen(bueno), mejor: resumen(mejor), mismoObjeto: otra === bueno, tBueno: Math.round(t1 - t0), tMejor: Math.round(t2 - t1), abortado };
}, b64);
console.log(JSON.stringify({ bueno: r.bueno.personas[0] && { ...r.bueno.personas[0], partes: r.bueno.personas[0].partes && Object.fromEntries(Object.entries(r.bueno.personas[0].partes).filter(([, v]) => v > 0.01).map(([k, v]) => [k, +v.toFixed(2)])) }, tBueno: r.tBueno, tMejor: r.tMejor }, null, 1));
ok(r.mismoObjeto, "la segunda petición no sale de la caché");
ok(r.abortado, "la cancelación no lanza AbortError");
if (real) {
  for (const [q, a] of [["bueno", r.bueno], ["mejor", r.mejor]]) {
    ok(a.personas.length === 1, `${q}: debería haber 1 persona y hay ${a.personas.length}`);
    const p = a.personas[0]; if (!p) continue;
    ok(p.puntos === 478, `${q}: puntos de la cara ${p.puntos}`);
    ok(p.nariz && p.nariz[2] > 0.5, `${q}: la pose no encuentra la nariz`);
    ok(p.puntaNariz && p.nariz && Math.hypot(p.puntaNariz[0] - p.nariz[0], p.puntaNariz[1] - p.nariz[1]) < p.anchoCara * 0.3, `${q}: los puntos de la cara y la pose no coinciden en la nariz`);
    ok(p.partes && p.partes.pelo > 0.01 && p.partes.cara > 0.01 && p.partes.ropaArriba > 0.05, `${q}: partes sin pelo, cara o ropa`);
  }
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  ok(d(r.bueno.personas[0].nariz, r.mejor.personas[0].nariz) < 12, "Bueno y Mejor sitúan la nariz muy distinto");
}
ok(m.errs.length === 0, "errores de página: " + m.errs.join("; "));
console.log(fallos ? "personas con modelos: FALLO" : "personas con modelos: OK");
await m.cerrar();
process.exit(fallos ? 1 : 0);
