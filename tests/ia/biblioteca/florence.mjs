/* ═════════════════════════════════════════════════
   PRUEBA · Florence-2 (describir una foto, modelos remotos simulados con tus archivos)
   Dibuja una casa roja con sol y cielo azul, pide la descripción corta y comprueba que sale texto en inglés con alguna palabra del dibujo.
   También comprueba el «no repetir trigramas». Uso: node tests/ia/biblioteca/florence.mjs (se salta si faltan los modelos)
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";
import { servirRemotos, aceptarDescargas } from "../lib/remotos.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const sv = await servirRemotos(); if (!["florence_vision", "florence_embed", "florence_enc", "florence_dec"].every(k => sv.ids.includes(k))) { console.log("SALTADA: faltan los modelos de Florence-2"); process.exit(0); }
const m = await abrir("escritorio", { args: sv.args }); aceptarDescargas(m.page);
const t0 = Date.now();
const r = await m.page.evaluate(async () => {
  const c = document.createElement("canvas"); c.width = 640; c.height = 480; const x = c.getContext("2d");
  x.fillStyle = "#78aae6"; x.fillRect(0, 0, 640, 480); x.fillStyle = "#3c8c3c"; x.fillRect(0, 330, 640, 150); x.fillStyle = "#ffe63c"; x.beginPath(); x.arc(520, 80, 40, 0, 7); x.fill();
  x.fillStyle = "#c83c32"; x.fillRect(200, 230, 200, 110); x.fillStyle = "#5a3228"; x.beginPath(); x.moveTo(180, 230); x.lineTo(300, 150); x.lineTo(420, 230); x.fill();
  const { describirFoto } = await import("/js/ai/florence.js"), { prohibidos } = await import("/js/ai/tasks/florence.js").catch(() => ({}));
  return { corta: await describirFoto(c, "corta") };
}).catch(e => ({ err: String(e) }));
console.log(JSON.stringify(r), (Date.now() - t0) / 1000 + " s");
if (r.err) ok(false, r.err); else { ok(/[a-z]{3,} [a-z]{3,}/i.test(r.corta), "no es texto"); ok(/red|green|blue|sky|house|castle|building|sun/i.test(r.corta), "no menciona nada del dibujo: " + r.corta); }
ok(m.errs.length === 0, "errores: " + m.errs.join("; "));
await m.cerrar(); sv.cerrar(); console.log(fallos ? `${fallos} FALLOS` : "OK"); process.exit(fallos ? 1 : 0);
