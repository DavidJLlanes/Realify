/* ═════════════════════════════════════════════════
   PRUEBA · Selección rápida (navegador, móvil y escritorio)
   Abre el editor, carga 4 fotos sintéticas (nítida, la misma desenfocada, otra escena, oscura), comprueba puntuación, grupo de duplicados
   (la nítida gana) y «Marcar descartes». Uso: node tests/ia/biblioteca/editor.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

async function probar(tipo){
  const m = await abrir(tipo);
  await m.page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(200, 150, { name: "x", fill: "#fff" }); const C = await import("/js/core/commands.js"); Promise.resolve(C.run("ai.culling")).catch(() => {}); });
  const abierto = await m.page.waitForFunction(() => window.__realifyTest?.culling, null, { timeout: 30000 }).then(() => true).catch(() => false);
  ok(abierto, `${tipo}: no abre la selección rápida`); if(!abierto){ await m.cerrar(); return; }
  const r = await m.page.evaluate(async () => {
    const mk = (kind, name) => new Promise(res => {
      const c = document.createElement("canvas"); c.width = 640; c.height = 480; const x = c.getContext("2d");
      const g = x.createLinearGradient(0, 0, 640, 480); g.addColorStop(0, kind === "otra" ? "#264" : "#468"); g.addColorStop(1, kind === "otra" ? "#cb7" : "#eca"); x.fillStyle = g; x.fillRect(0, 0, 640, 480);
      if(kind !== "otra"){ for(let i = 0; i < 160; i++){ x.fillStyle = i % 2 ? "#111" : "#fff"; x.fillRect((i * 37) % 600, (i * 53) % 440, 26, 26); } }
      else { x.fillStyle = "#a33"; x.beginPath(); x.arc(320, 240, 120, 0, 7); x.fill(); for(let i = 0; i < 80; i++){ x.fillStyle = i % 2 ? "#000" : "#eee"; x.fillRect((i * 71) % 620, (i * 29) % 460, 14, 14); } }
      if(kind === "borrosa"){ const t = document.createElement("canvas"); t.width = t.height = 1; t.width = 640; t.height = 480; const y = t.getContext("2d"); y.filter = "blur(9px)"; y.drawImage(c, 0, 0); y.filter = "none"; return t.toBlob(b => res(new File([b], name + ".png", { type: "image/png" }))); }
      if(kind === "oscura"){ x.fillStyle = "rgba(0,0,0,.85)"; x.fillRect(0, 0, 640, 480); }
      c.toBlob(b => res(new File([b], name + ".png", { type: "image/png" })));
    });
    const T = window.__realifyTest.culling, files = [await mk("nitida", "a_nitida"), await mk("borrosa", "b_borrosa"), await mk("otra", "c_otra"), await mk("oscura", "d_oscura")];
    await T.anadirArchivos(files);
    return T.fotos.map(f => ({ n: f.name, p: f.puntos, g: f.grupo, m: f.mejor, on: f.on }));
  });
  console.log(tipo, JSON.stringify(r));
  ok(r.length === 4, `${tipo}: ${r.length} fotos`);
  const [a, b] = r; ok(a.p > b.p, `${tipo}: la nítida no puntúa más que la borrosa`);
  ok(a.g != null && a.g === b.g, `${tipo}: no agrupa los duplicados`); ok(a.m && !b.m, `${tipo}: la mejor del grupo debe ser la nítida`);
  ok(r[2].g == null || r[2].g !== a.g, `${tipo}: la otra escena no debe ser duplicado`);
  const d = await m.page.evaluate(async () => { const T = window.__realifyTest.culling; await T.marcarDescartes(); return T.fotos.map(f => f.on); });
  ok(d[0] === true && d[1] === false, `${tipo}: marcar descartes no deja la mejor y descarta la copia (${d})`);
  ok(m.errs.length === 0, `${tipo}: errores de consola ${m.errs.slice(0, 2)}`);
  await m.cerrar();
}
await probar("escritorio"); await probar("movil");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · selección rápida"); process.exit(fallos ? 1 : 0);
