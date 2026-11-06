/* ═════════════════════════════════════════════════
   PRUEBA · búsqueda por texto con CLIP (modelos remotos simulados con tus archivos)
   Indexa tres lienzos de color liso (rojo, azul, verde) y una escena con un círculo amarillo, y comprueba que «cielo azul» pone primero el azul
   y «fruta amarilla / sol» el amarillo, con los vectores de 512 números de CLIP. Uso: node tests/ia/biblioteca/clip.mjs (se salta si faltan los modelos)
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";
import { servirRemotos, aceptarDescargas } from "../lib/remotos.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const sv = await servirRemotos(); if (!sv.ids.includes("clip_vision") || !sv.ids.includes("clip_text")) { console.log("SALTADA: faltan los modelos de CLIP"); process.exit(0); }
for (const tipo of ["escritorio", "movil"]) {
  const m = await abrir(tipo, { args: sv.args }); aceptarDescargas(m.page);
  const r = await m.page.evaluate(async () => {
    const mk = (f) => { const c = document.createElement("canvas"); c.width = 320; c.height = 240; const x = c.getContext("2d"); f(x); return c; };
    const fotos = { rojo: mk(x => { x.fillStyle = "#d22"; x.fillRect(0, 0, 320, 240); }), azul: mk(x => { x.fillStyle = "#26d"; x.fillRect(0, 0, 320, 240); }), verde: mk(x => { x.fillStyle = "#2a3"; x.fillRect(0, 0, 320, 240); }),
      sol: mk(x => { x.fillStyle = "#58c"; x.fillRect(0, 0, 320, 240); x.fillStyle = "#fd2"; x.beginPath(); x.arc(160, 90, 50, 0, 7); x.fill(); }) };
    const { embedImage, embedText } = await import("/js/ai/clip.js"), { buscarConClip } = await import("/js/features/library/search-photos/engine/clip.js");
    const nombres = Object.keys(fotos), regs = [];
    for (const n of nombres) regs.push({ clip: await embedImage(fotos[n]), top: [], colores: [] });
    const salida = {};
    for (const q of ["azul", "rojo", "verde", "un sol amarillo"]) { const qv = await embedText(q); salida[q] = buscarConClip(regs, q, qv).map(x => nombres[x.i] + ":" + x.cos?.toFixed(3)); }
    return salida;
  }).catch(e => ({ err: String(e) }));
  console.log(tipo, JSON.stringify(r));
  if (r.err) ok(false, `${tipo}: ${r.err}`); else {
    ok(r["azul"][0]?.startsWith("azul"), `${tipo}: «azul» no pone primero el azul`); ok(r["rojo"][0]?.startsWith("rojo"), `${tipo}: «rojo»`);
    ok(r["verde"][0]?.startsWith("verde"), `${tipo}: «verde»`); ok(r["un sol amarillo"][0]?.startsWith("sol"), `${tipo}: «un sol amarillo»`);
  }
  ok(m.errs.length === 0, `${tipo}: errores: ` + m.errs.join("; ")); await m.cerrar();
}
sv.cerrar(); console.log(fallos ? `${fallos} FALLOS` : "OK"); process.exit(fallos ? 1 : 0);
