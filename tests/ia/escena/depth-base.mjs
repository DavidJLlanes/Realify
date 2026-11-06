/* ═════════════════════════════════════════════════
   PRUEBA · profundidad Base (Depth Anything V2 Base, remoto simulado)
   Sirve el ONNX desde la carpeta de modelos, pide la profundidad de una escena sintética (suelo con perspectiva y una caja cercana) y
   comprueba que el mapa es 518×518, finito, 0-1 y que el suelo cercano (abajo) sale más cerca que el cielo (arriba).
   Uso: node tests/ia/escena/depth-base.mjs  (se salta si falta el modelo)
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";
import { servirRemotos, aceptarDescargas } from "../lib/remotos.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const sv = await servirRemotos(); if (!sv.ids.includes("depth_base")) { console.log("SALTADA: falta model_fp16.onnx"); process.exit(0); }
const m = await abrir("escritorio", { args: sv.args, depth: "base" });
aceptarDescargas(m.page); m.page.on("crash", () => console.log("CRASH página")); m.page.on("console", x => /error|fail/i.test(x.text()) && console.log("consola:", x.text().slice(0, 200))); const t0 = Date.now();
const r = await m.page.evaluate(async () => {
  const S = 518, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, "#9cc8ff"); g.addColorStop(0.5, "#cfe4ff"); g.addColorStop(0.5, "#6b5a45"); g.addColorStop(1, "#2b2218");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = "#00000055"; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(S / 2, S / 2); x.lineTo(i * S / 13, S); x.stroke(); }
  x.fillStyle = "#a33"; x.fillRect(190, 330, 140, 130);
  const rgba = x.getImageData(0, 0, S, S).data;
  const { depthModelId } = await import("/js/ai/depth.js");
  const { runModel } = await import("/js/ai/runtime.js");
  const res = await runModel("depth", "depth_base", { rgba }, [rgba.buffer]);
  const d = res.depth, med = (y0, y1) => { let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let i = 20; i < 160; i++) { s += d[y * S + i]; n++; } return s / n; };
  let fin = true; for (const v of d) if (!Number.isFinite(v) || v < 0 || v > 1) { fin = false; break; }
  return { n: d.length, fin, arriba: med(20, 120), abajo: med(400, 500), id: depthModelId() };
}).catch(e => ({ err: String(e) }));
console.log(JSON.stringify(r), (Date.now() - t0) / 1000 + " s");
ok(!r.err, r.err); if (!r.err) { ok(r.n === 518 * 518 && r.fin, "mapa no válido"); ok(r.abajo > r.arriba, `suelo no más cercano que cielo (${r.abajo} vs ${r.arriba})`); ok(r.id === "depth_base", "escritorio no elige Base: " + r.id); }
ok(m.errs.length === 0, "errores: " + m.errs.join("; "));
await m.cerrar(); sv.cerrar(); console.log(fallos ? `${fallos} FALLOS` : "OK"); process.exit(fallos ? 1 : 0);
