/* ═══════════════════════════════════════════════════════════════
   PRUEBA · efecto Color: la versión WebGL da lo mismo que la de CPU
   Dibuja un fotograma con degradados y colores, lo pasa por las dos y exige diferencia máxima ≤ 2 niveles; mide el tiempo de cada una. Uso: CHROME_EXE=… node tests/video/color-gl.mjs
   ═══════════════════════════════════════════════════════════════ */
import { abrir } from "../ia/lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const { page, errs, cerrar } = await abrir("escritorio");
const r = await page.evaluate(async () => {
  const { aplicarColor, POR_DEFECTO } = await import("/plugins/video/effects/color/motor.js"), { crearGL } = await import("/plugins/video/effects/color/gl.js");
  const c = Object.assign(document.createElement("canvas"), { width: 480, height: 270 }), x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 480, 270); g.addColorStop(0, "#f33"); g.addColorStop(.5, "#3c6"); g.addColorStop(1, "#36f"); x.fillStyle = g; x.fillRect(0, 0, 480, 270);
  x.fillStyle = "#fa0"; x.fillRect(40, 30, 120, 60); x.fillStyle = "#222"; x.fillRect(300, 150, 100, 80);
  const gl = crearGL(); if (!gl) return { sinGL: true };
  const casos = [{ exposicion: 1 }, { contraste: 50, saturacion: -40 }, { temperatura: 60, tinte: -30 }, { exposicion: -.7, contraste: -30, saturacion: 70, temperatura: -40, tinte: 50 }], out = [];
  for (const p0 of casos) {
    const p = { ...POR_DEFECTO, ...p0 }, im = x.getImageData(0, 0, 480, 270); aplicarColor(im.data, p);
    const o = gl.aplicar(c, p), d = o.getContext("2d").getImageData(0, 0, 480, 270).data; let max = 0; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) max = Math.max(max, Math.abs(d[i + k] - im.data[i + k]));
    out.push(max);
  }
  const t0 = performance.now(); for (let i = 0; i < 20; i++) gl.aplicar(c, { ...POR_DEFECTO, exposicion: 1 }); const tGL = (performance.now() - t0) / 20;
  const t1 = performance.now(); for (let i = 0; i < 20; i++) { const im = x.getImageData(0, 0, 480, 270); aplicarColor(im.data, { ...POR_DEFECTO, exposicion: 1 }); } const tCPU = (performance.now() - t1) / 20;
  return { out, tGL, tCPU };
});
if (r.sinGL) console.log("(sin WebGL en este navegador: se omite)"); else { ok(r.out.every(m => m <= 2), "WebGL ≈ CPU, diferencia máxima por caso: " + r.out.join(", ")); console.log(`480×270: WebGL ${r.tGL.toFixed(1)} ms · CPU ${r.tCPU.toFixed(1)} ms`); }
ok(errs.length === 0, "sin errores " + errs.join("|"));
await cerrar(); console.log(fallos ? `${fallos} fallos` : "OK · color WebGL"); process.exit(fallos ? 1 : 0);
