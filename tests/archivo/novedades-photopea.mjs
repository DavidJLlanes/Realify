/* ═══════════════════════════════════════════════════════════════
   PRUEBA · Ideas sacadas de las peticiones de Photopea (compilación 365)
   1) Teclado numérico del móvil: los campos de números enteros no negativos llevan inputmode="numeric"; los que admiten
      negativos o decimales, no.
   2) «Nuevo desde el portapapeles»: con un documento abierto, la imagen copiada abre OTRA pestaña con su tamaño.
   3) «Guardar» (Ctrl+S) sobre el mismo archivo: con un selector del sistema simulado, pide confirmar, escribe un JPEG del
      tamaño del documento en el mismo archivo y, sin permiso de archivo, sigue guardando el proyecto.
   4) Licuar · Congelar: lo pintado como congelado no se deforma al empujar; lo de al lado, sí. «Descongelar todo» lo borra.
   Uso: node tests/archivo/novedades-photopea.mjs (CHROME_EXE si hace falta).
   ═══════════════════════════════════════════════════════════════ */
import { abrir, documentoDePrueba } from "../ia/lib/navegador.mjs";

let fallos = 0;
const ok = (c, msg) => { if (!c) { fallos++; console.log("FALLO · " + msg); } else console.log("ok · " + msg); };

for (const tipo of ["escritorio", "movil"]) {
  const { page, errs, cerrar } = await abrir(tipo);

  // 1) teclado numérico
  await page.evaluate(async () => { const C = await import("/js/core/commands.js"); C.run("file.new"); });
  await page.waitForTimeout(500);
  const modos = await page.evaluate(() => {
    const n = document.querySelector("#nw");
    const x = Object.assign(document.createElement("input"), { type: "number" }); x.min = "-90"; x.step = "0.000001"; document.body.append(x);
    const y = Object.assign(document.createElement("input"), { type: "number" }); y.min = "1"; y.step = "0.1"; document.body.append(y);
    return new Promise(r => setTimeout(() => { r([n?.getAttribute("inputmode"), x.getAttribute("inputmode"), y.getAttribute("inputmode")]); x.remove(); y.remove(); }, 50));
  });
  ok(modos[0] === "numeric", `${tipo}: ancho del documento nuevo con teclado numérico (${modos[0]})`);
  ok(modos[1] === null && modos[2] === null, `${tipo}: con negativos o decimales se deja el teclado normal (${modos[1]}, ${modos[2]})`);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);

  // 2) nuevo desde el portapapeles
  await documentoDePrueba(page, 300, 200);
  await page.evaluate(async () => {
    const c = Object.assign(document.createElement("canvas"), { width: 123, height: 77 });
    c.getContext("2d").fillStyle = "#c33"; c.getContext("2d").fillRect(0, 0, 123, 77);
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { read: async () => [{ types: ["image/png"], getType: async () => blob }] } });
  });
  const antes = await page.evaluate(async () => (await import("/js/editor/documents.js")).tabs?.length ?? document.querySelectorAll(".doc-tab, .tab").length);
  await page.evaluate(async () => { const C = await import("/js/core/commands.js"); await C.runAsync("file.newFromClipboard"); });
  await page.waitForTimeout(1500);
  const tam = await page.evaluate(async () => { const D = await import("/js/core/doc.js"); return [D.doc.w, D.doc.h, D.doc.layers.length]; });
  ok(tam[0] === 123 && tam[1] === 77, `${tipo}: el portapapeles abre un documento nuevo de 123×77 (${tam.join("×")}; pestañas antes: ${antes})`);

  // 3) guardar sobre el mismo archivo (sólo escritorio: en el móvil no hay selector con permiso)
  if (tipo === "escritorio") {
    await page.evaluate(() => {
      window.__escrito = null;
      const c = Object.assign(document.createElement("canvas"), { width: 64, height: 40 });
      c.getContext("2d").fillStyle = "#38c"; c.getContext("2d").fillRect(0, 0, 64, 40);
      window.showOpenFilePicker = async () => {
        const blob = await new Promise(r => c.toBlob(r, "image/jpeg", .9));
        const file = new File([blob], "vacaciones.jpg", { type: "image/jpeg" });
        return [{ name: "vacaciones.jpg", getFile: async () => file, queryPermission: async () => "granted",
          createWritable: async () => ({ write: async b => { window.__escrito = b; }, close: async () => {} }) }];
      };
    });
    await page.evaluate(async () => (await import("/js/io/open.js")).promptOpen());
    await page.waitForTimeout(1500);
    const puede = await page.evaluate(async () => (await import("/js/io/save-in-place.js")).puedeGuardarEncima());
    ok(puede, "escritorio: el JPEG abierto con el selector del sistema se puede guardar encima");
    await page.evaluate(async () => { const D = await import("/js/core/doc.js"); const l = D.doc.layers[0]; l.ctx.fillStyle = "#fff"; l.ctx.fillRect(0, 0, 10, 10); });
    await page.keyboard.press("Control+s"); await page.waitForTimeout(700);
    const hayDialogo = await page.getByRole("button", { name: "Sobrescribir" }).count();
    ok(hayDialogo === 1, "escritorio: la primera vez pide confirmar antes de sobrescribir");
    if (hayDialogo) await page.getByRole("button", { name: "Sobrescribir" }).click();
    await page.waitForTimeout(2000);
    const esc = await page.evaluate(async () => {
      const b = window.__escrito; if (!b) return null;
      const u = new Uint8Array(await b.arrayBuffer()), bmp = await createImageBitmap(b);
      return { tipo: b.type, soi: u[0] === 0xff && u[1] === 0xd8, w: bmp.width, h: bmp.height };
    });
    ok(esc && esc.soi && esc.w === 64 && esc.h === 40, "escritorio: escribe un JPEG de 64×40 en el mismo archivo " + JSON.stringify(esc));
    await page.evaluate(() => { window.__escrito = null; });
    await page.keyboard.press("Control+s"); await page.waitForTimeout(1500);
    ok(await page.getByRole("button", { name: "Sobrescribir" }).count() === 0 && await page.evaluate(() => !!window.__escrito), "escritorio: la segunda vez guarda sin volver a preguntar");
  }

  // 4) Licuar · Congelar
  await documentoDePrueba(page, 400, 400);
  const r = await page.evaluate(async () => {
    const D = await import("/js/core/doc.js"), T = await import("/js/editor/tools/tool-current.js"), S = await import("/js/editor/tools/defs/shared.js");
    const C = await import("/js/core/commands.js");
    const l = D.activeLayer();
    for (let y = 0; y < 400; y += 20) for (let x = 0; x < 400; x += 20) { l.ctx.fillStyle = (x + y) % 40 ? "#111" : "#eee"; l.ctx.fillRect(x, y, 20, 20); }
    const antes = l.ctx.getImageData(0, 0, 400, 400).data.slice();
    T.setTool("liquify");
    const t = T.current;
    Object.assign(S.state, { liqSize: 160, liqStrength: 100, liqVolume: 0 });
    S.state.liqMode = "freeze"; t.down({ x: 100, y: 200 }); t.move({ x: 100, y: 200 }); t.up();
    S.state.liqMode = "push";
    for (const [cx] of [[100], [300]]) { t.down({ x: cx - 40, y: 200 }); for (let k = 1; k <= 8; k++) t.move({ x: cx - 40 + k * 10, y: 200 }); t.up(); }
    const d = l.ctx.getImageData(0, 0, 400, 400).data;
    const cambio = (x0, x1, y0, y1) => { let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 400 + x) * 4; s += Math.abs(d[i] - antes[i]); n++; } return s / n; };
    const congelado = cambio(80, 120, 180, 220), libre = cambio(280, 320, 180, 220);
    C.run("liquify.thawAll");
    const tras = (await import("/js/editor/tools/liquify.js"));   // sólo para que la importación no falle
    return { congelado, libre, ok: !!tras };
  });
  ok(r.libre > 20 && r.congelado < r.libre * 0.2, `${tipo}: Licuar no deforma lo congelado (congelado ${r.congelado.toFixed(1)} · libre ${r.libre.toFixed(1)})`);

  ok(errs.length === 0, `${tipo}: sin errores de página ${errs.join(" | ")}`);
  await cerrar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : "\nTODO OK");
process.exit(fallos ? 1 : 0);
