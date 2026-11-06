/* ═══════════════════════════════════════════════════════════════
   BANCO DE UNMARK (F11.7) · mide la detección y el relleno con marcas sintéticas
   20 escenas limpias × 4 tipos de marca (texto, esquina de stock, sello de fecha, mosaico). Por cada caso: recuperación (qué parte de la marca real cubre la detección), PSNR y SSIM DENTRO de la marca frente a la foto limpia, antes y después de quitarla.
   Uso: CHROME_EXE=… node tests/unmark/banco.mjs [--umbral] [--guardar]   (--guardar escribe las imágenes de muestra en tests/unmark/salida/ para la revisión visual del titular; --umbral falla si empeora el mínimo fijado)
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs"; import path from "node:path";
import { abrir } from "../ia/lib/navegador.mjs";
const guardar = process.argv.includes("--guardar"), umbral = process.argv.includes("--umbral");
const { page, cerrar } = await abrir("escritorio");
const res = await page.evaluate(async guardar => {
  const E = await import("/tests/unmark/lib/escenas.js"), D = await import("/js/filters/unmark/detect.js"), I = await import("/js/filters/unmark/inpaint.js");
  const filas = [], muestras = [];
  for(let i = 0; i < E.N_ESCENAS; i++){
    const limpio = E.escena(i), ld = limpio.getContext("2d").getImageData(0, 0, E.W, E.H);
    for(const tipo of E.TIPOS){
      const { canvas, verdad } = E.marcar(limpio, tipo, i), md = canvas.getContext("2d").getImageData(0, 0, E.W, E.H);
      const det = D.detectMarks(canvas, { sens: 60, zones: "all", minsize: 20, maxsize: 40 });
      const ids = new Set(det.regions.map(r => r.id)), mask = D.fullMaskFromDetection(det, ids, E.W, E.H);
      let cubre = 0, tot = 0, fuera = 0, dentro = 0; for(let q = 0; q < verdad.length; q++){ if(verdad[q]){ tot++; if(mask[q]) cubre++; } if(mask[q]){ dentro++; if(!verdad[q]) fuera++; } }
      const out = I.inpaint(md, mask, { method: "hybrid", expand: 5, feather: 4, texture: 0.6, grain: 0.3, seed: 7 }).img;
      const antes = E.medir(md.data, ld.data, verdad), despues = E.medir(out.data, ld.data, verdad);
      filas.push({ i, tipo, recup: cubre / tot, sobra: dentro ? fuera / dentro : 0, regiones: det.regions.length, psnr0: antes.psnr, psnr1: despues.psnr, ssim0: antes.ssim, ssim1: despues.ssim });
      if(guardar && i < 3){ const c = document.createElement("canvas"); c.width = E.W * 3; c.height = E.H; const x = c.getContext("2d"); x.drawImage(limpio, 0, 0); x.drawImage(canvas, E.W, 0); const o = document.createElement("canvas"); o.width = E.W; o.height = E.H; o.getContext("2d").putImageData(out, 0, 0); x.drawImage(o, E.W * 2, 0); muestras.push({ n: `${tipo}-${i}.jpg`, d: c.toDataURL("image/jpeg", 0.85) }); }
    }
  }
  return { filas, muestras };
}, guardar);
await cerrar();
const med = (a, f) => a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0;
console.log("tipo       recup  sobra  PSNR antes→después   SSIM antes→después");
const por = {};
for (const t of ["texto", "esquina", "fecha", "mosaico"]) {
  const f = res.filas.filter(x => x.tipo === t); por[t] = { recup: med(f, x => x.recup), psnr: med(f, x => x.psnr1), ssim: med(f, x => x.ssim1) };
  console.log(t.padEnd(10), (100 * por[t].recup).toFixed(0).padStart(4) + "%", (100 * med(f, x => x.sobra)).toFixed(0).padStart(5) + "%", med(f, x => x.psnr0).toFixed(1).padStart(8), "→", por[t].psnr.toFixed(1).padEnd(8), med(f, x => x.ssim0).toFixed(3), "→", por[t].ssim.toFixed(3));
}
if (guardar) { const dir = "tests/unmark/salida"; fs.mkdirSync(dir, { recursive: true }); for (const m of res.muestras) fs.writeFileSync(path.join(dir, m.n), Buffer.from(m.d.split(",")[1], "base64")); console.log("muestras en", dir, "(original · con marca · resultado)"); }
if (umbral) {
  const base = JSON.parse(fs.readFileSync("tests/unmark/umbrales.json", "utf8")); let mal = 0;
  for (const t of Object.keys(base)) for (const k of ["recup", "psnr", "ssim"]) if (por[t][k] < base[t][k] - 1e-6) { mal++; console.log(`FALLO: ${t} ${k} ${por[t][k].toFixed(3)} < ${base[t][k]}`); }
  process.exit(mal ? 1 : 0);
}
if (process.argv.includes("--fijar")) fs.writeFileSync("tests/unmark/umbrales.json", JSON.stringify(por, null, 1));
