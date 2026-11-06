/* ═════════════════════════════════════════════════
   PRUEBA · medios de vídeo en el navegador (móvil y escritorio): codifica un vídeo sintético con el codificador del editor (MP4 y WebM), lo vuelve a abrir
   con el decodificador (duración, tamaño, fps y color de los fotogramas), lo repite dentro de un worker y prueba el respaldo y los archivos no válidos.
   Uso: node tests/video/medios.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../ia/lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

async function probar(tipo) {
  const m = await abrir(tipo);
  const r = await m.page.evaluate(async () => {
    const I = await import("/plugins/video/media/importar.js"), W = await import("/plugins/video/workers/cliente.js"), E = await import("/plugins/video/media/decoders/elemento-video.js");
    const out = {}, dibujar = (i, n) => { const c = new OffscreenCanvas(320, 240), x = c.getContext("2d"); x.fillStyle = i < n / 2 ? "#e02020" : "#2040e0"; x.fillRect(0, 0, 320, 240); x.fillStyle = "#fff"; x.fillRect(10 + i * 4, 100, 30, 30); return c; };
    const color = c => { const d = c.getContext("2d").getImageData(c.width - 20, 10, 1, 1).data; return d[0] > d[2] ? "rojo" : "azul"; };
    const hacer = async (cont) => { const e = await I.crearCodificador({ ancho: 320, alto: 240, fps: 30, contenedor: cont }); for (let i = 0; i < 30; i++) await e.anadir(dibujar(i, 30), i / 30); return { blob: await e.cerrar(), codec: e.codec }; };
    for (const cont of ["mp4", "webm"]) {
      const { blob, codec } = await hacer(cont), f = new File([blob], "t." + cont, { type: blob.type, lastModified: 5 });
      const a = await I.abrirMedio(f), i = a.lector.info, f1 = await a.lector.fotograma(0.1), f2 = await a.lector.fotograma(0.9); let n = 0; for await (const x of a.lector.fotogramas(0, 0.5)) n++;
      out[cont] = { codec, bytes: blob.size, dec: a.decodificador, dur: +i.duracion.toFixed(2), w: i.ancho, h: i.alto, fps: Math.round(i.fps), huella: a.medio.huella, c1: color(f1.lienzo), c2: color(f2.lienzo), n }; a.lector.cerrar();
    }
    // respaldo: un decodificador roto con la máxima prioridad no impide abrir
    I.decodificadores.registrar({ id: "roto", prioridad: 1000, soporta: () => { throw new Error("no"); } });
    const { blob } = await hacer("webm"), fw = new File([blob], "w.webm"), b = await I.abrirMedio(fw); out.respaldo = b.decodificador; b.lector.cerrar();
    // decodificador de respaldo directo (<video>)
    const ev = await E.abrir(fw), fe = await ev.fotograma(0.9); out.elemento = { dur: +ev.info.duracion.toFixed(1), c: color(fe.lienzo) }; ev.cerrar();
    // worker
    const t = W.crearTrabajador(); const ab = await t.abrir(fw); const fr = await t.fotograma(0.9); out.worker = { w: ab.medio.ancho, bmp: fr.imagen.width, t: +fr.t.toFixed(2) }; fr.imagen.close();
    await t.iniciarCodificacion({ ancho: 320, alto: 240, fps: 30, contenedor: "webm" });
    for (let i = 0; i < 10; i++) { const bm = await createImageBitmap(dibujar(i, 10)); await t.anadir(bm, i / 30, 1 / 30); }
    const wb = await t.terminar(); const re = await I.abrirMedio(new File([wb], "w2.webm")); out.workerSalida = { bytes: wb.size, dur: +re.lector.info.duracion.toFixed(2) }; re.lector.cerrar();
    // errores claros
    try { await t.abrir(new File(["hola"], "x.mp4")); out.malo = "sin error"; } catch (e) { out.malo = e.message; }
    out.sigueVivo = (await t.abrir(fw)).medio.ancho; await t.cerrar();
    try { await I.abrirMedio(new File(["hola"], "x.mp4")); out.malo2 = "sin error"; } catch (e) { out.malo2 = e.message; }
    try { await I.crearCodificador({ ancho: 100000, alto: 100000, fps: 30, contenedor: "mp4" }); out.enorme = "sin error"; } catch (e) { out.enorme = e.message; }
    return out;
  });
  console.log(tipo, JSON.stringify(r));
  for (const c of ["mp4", "webm"]) { const x = r[c]; ok(x && x.bytes > 1000 && x.dec === "mediabunny" && x.w === 320 && x.h === 240, `${tipo}/${c}: datos ${JSON.stringify(x)}`); ok(Math.abs(x.dur - 1) < 0.1 && x.fps >= 28 && x.fps <= 32, `${tipo}/${c}: duración o fps ${x.dur} ${x.fps}`); ok(x.c1 === "rojo" && x.c2 === "azul", `${tipo}/${c}: colores ${x.c1} ${x.c2}`); ok(x.n >= 14 && x.n <= 16, `${tipo}/${c}: fotogramas en 0,5 s = ${x.n}`); ok(x.huella === "t." + c + "|" + x.bytes + "|5", `${tipo}/${c}: huella ${x.huella}`); }
  ok(r.respaldo === "mediabunny", `${tipo}: respaldo ${r.respaldo}`); ok(r.elemento && r.elemento.c === "azul", `${tipo}: decodificador <video> ${JSON.stringify(r.elemento)}`);
  ok(r.worker && r.worker.w === 320 && r.worker.bmp === 320 && r.worker.t > 0.8, `${tipo}: worker ${JSON.stringify(r.worker)}`); ok(r.workerSalida && r.workerSalida.dur > 0.25 && r.workerSalida.dur < 0.4, `${tipo}: codificar en worker ${JSON.stringify(r.workerSalida)}`);
  ok(/vídeo|abrir|decodificar/i.test(r.malo) && r.malo !== "sin error", `${tipo}: error de archivo malo en worker: ${r.malo}`); ok(r.sigueVivo === 320, `${tipo}: el worker sigue vivo tras un error`);
  ok(/No puedo abrir|no puede/i.test(r.malo2), `${tipo}: error de archivo malo: ${r.malo2}`); ok(/no puede codificar/i.test(r.enorme), `${tipo}: resolución imposible: ${r.enorme}`);
  ok(m.errs.length === 0, `${tipo}: errores de consola ${m.errs.slice(0, 2)}`); await m.cerrar();
}
await probar("escritorio"); await probar("movil");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · medios de vídeo"); process.exit(fallos ? 1 : 0);
