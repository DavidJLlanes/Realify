/* ═════════════════════════════════════════════════
   PRUEBA · MI-GAN (relleno ligero), móvil y escritorio
   Rellena un cuadrado sobre un degradado con «rellenar» (js/ai/relleno.js forzando MI-GAN) y comprueba que el hueco queda
   cerca del degradado y que fuera del hueco la imagen no cambia. Uso: node tests/ia/restaurar/migan.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
for (const tipo of ["escritorio", "movil"]) {
  const m = await abrir(tipo);
  const r = await m.page.evaluate(async () => {
    const N = 512, rgba = new Uint8ClampedArray(N * N * 4), hole = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; rgba[i] = x / 2; rgba[i + 1] = y / 2; rgba[i + 2] = 128; rgba[i + 3] = 255; }
    const ref = new Uint8ClampedArray(rgba);
    for (let y = 200; y < 300; y++) for (let x = 200; x < 300; x++) { hole[y * N + x] = 1; rgba[(y * N + x) * 4] = 255; rgba[(y * N + x) * 4 + 1] = 0; rgba[(y * N + x) * 4 + 2] = 0; }
    const { runModel } = await import("/js/ai/runtime.js");
    const res = await runModel("migan", "migan", { rgba, hole, size: N }, [rgba.buffer, hole.buffer]);
    let err = 0, c = 0, fuera = 0;
    for (let y = 200; y < 300; y++) for (let x = 200; x < 300; x++) { const i = (y * N + x) * 4; err += Math.abs(res.rgba[i] - ref[i]) + Math.abs(res.rgba[i + 1] - ref[i + 1]); c += 2; }
    for (let y = 20; y < 100; y++) for (let x = 20; x < 100; x++) { const i = (y * N + x) * 4; fuera = Math.max(fuera, Math.abs(res.rgba[i] - ref[i])); }
    return { medio: err / c, fuera };
  }).catch(e => ({ err: String(e) }));
  console.log(tipo, JSON.stringify(r));
  ok(!r.err, `${tipo}: ${r.err}`); if (!r.err) { ok(r.medio < 40, `${tipo}: el hueco no se rellena bien (${r.medio})`); ok(r.fuera <= 3, `${tipo}: cambia fuera del hueco`); }
  ok(m.errs.length === 0, `${tipo}: errores: ` + m.errs.join("; "));
  await m.cerrar();
}
console.log(fallos ? `${fallos} FALLOS` : "OK"); process.exit(fallos ? 1 : 0);
