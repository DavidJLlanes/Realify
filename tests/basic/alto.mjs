/* ═══════════════════════════════════════════════════════════════
   PRUEBA · ALTO VISIBLE DE BASIC (iPhone instalado)
   Simula el iPhone instalado (navigator.standalone, pantalla de 440×956): sana, la app mide toda la pantalla; encogida por el fallo
   del teclado de iOS, usa el último alto bueno guardado; fuera del iPhone instalado no se toca (alto natural). En todos los casos la
   barra inferior queda dentro de la pantalla.
   Uso: node tests/basic/alto.mjs   Salidas: OK / FALLO y código de salida.
   ═══════════════════════════════════════════════════════════════ */
import { abrir } from "../ia/lib/navegador.mjs";
const { page, cerrar } = await abrir("escritorio");
const base = page.url().replace(/\/[^/]*$/, "/");
const nav = page.context().browser();
const res = {};
for (const [nombre, alto, guardado] of [["sana", 956, 0], ["encogida", 752, 0], ["encogida+guardado", 752, 940]]) {
  const ctx = await nav.newContext({ viewport: { width: 440, height: alto }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.addInitScript(([g]) => {
    Object.defineProperty(navigator, "standalone", { value: true });
    Object.defineProperty(screen, "height", { value: 956 }); Object.defineProperty(screen, "width", { value: 440 });
    if (g) localStorage.setItem("realify-basic-alto:v956", String(g));
  }, [guardado]);
  const p = await ctx.newPage(); await p.goto(base + "basic/"); await p.waitForTimeout(1200);
  res[nombre] = await p.evaluate(async () => ({ pie: (await import("/basic/js/app/alto.js")).textoAlto(), barra: document.querySelector('.barra-inf')?.getBoundingClientRect().bottom, alto: getComputedStyle(document.documentElement).getPropertyValue("--alto"), stage: document.getElementById("stage").getBoundingClientRect().height, inner: innerHeight }));
  await ctx.close();
}
const ctx = await nav.newContext({ viewport: { width: 412, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
const p = await ctx.newPage(); await p.goto(base + "basic/"); await p.waitForTimeout(1000);
res.android = await p.evaluate(() => ({ barra: document.querySelector('.barra-inf')?.getBoundingClientRect().bottom, alto: getComputedStyle(document.documentElement).getPropertyValue("--alto"), stage: document.getElementById("stage").getBoundingClientRect().height }));
const fallos = [], exige = (c, m) => { if (!c) fallos.push(m + " " + JSON.stringify(res)); };
exige(res.sana.alto === "956px" && res.sana.stage === 956, "sana: no ocupa toda la pantalla");
exige(res["encogida+guardado"].stage === 940, "encogida: no usa el último alto bueno");
exige(/alto 956px \(medido\)/.test(res.sana.pie), "falta el diagnóstico del alto");
exige(res.android.alto === "" && res.android.stage === 800, "fuera del iPhone instalado no debe tocar el alto");
for (const [k, r] of Object.entries(res)) exige(!(r.barra > r.stage + 0.5), k + ": la barra inferior se sale de la pantalla");
console.log(fallos.length ? "FALLO\n  - " + fallos.join("\n  - ") : "OK");
await ctx.close(); await cerrar();
process.exit(fallos.length ? 1 : 0);
