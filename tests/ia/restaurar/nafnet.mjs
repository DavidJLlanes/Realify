/* ═════════════════════════════════════════════════
   PRUEBA · NAFNet (quitar desenfoque con IA), móvil y escritorio
   Desenfoca un patrón de bordes en horizontal, pasa «restore/nafnet» por el worker con el ONNX local y comprueba que el
   contraste de los bordes sube sin salirse del rango. Uso: node tests/ia/restaurar/nafnet.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

for (const tipo of ["escritorio", "movil"]) {
  const m = await abrir(tipo);
  const r = await m.page.evaluate(async () => {
    const W = 200, H = 160, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    x.fillStyle = "#ddd"; x.fillRect(0, 0, W, H); x.fillStyle = "#222";
    for (let i = 0; i < 8; i++) x.fillRect(15 + i * 22, 20, 8 + (i % 3) * 3, 120);
    const o = document.createElement("canvas"); o.width = W; o.height = H; const ox = o.getContext("2d");
    ox.filter = "blur(4px)"; ox.drawImage(c, 0, 0);
    const d0 = ox.getImageData(0, 0, W, H), rgba = new Uint8ClampedArray(d0.data);
    const { runModel } = await import("/js/ai/runtime.js");
    const res = await runModel("restore", "nafnet", { rgba, w: W, h: H, strength: 0 }, [rgba.buffer]);
    const grad = a => { let s = 0; for (let y = 40; y < 120; y++) for (let i = 1; i < W; i++) { const q = a[(y * W + i) * 4] - a[(y * W + i - 1) * 4]; s += q * q; } return s; };
    return { antes: grad(d0.data), despues: grad(res.rgba), n: res.rgba.length === W * H * 4 };
  }).catch(e => ({ err: String(e) }));
  console.log(tipo, JSON.stringify(r));
  ok(!r.err, `${tipo}: ${r.err}`); if (!r.err) { ok(r.n, "tamaño de salida"); ok(r.despues > r.antes * 1.15, `${tipo}: no aumenta la nitidez`); }
  ok(m.errs.length === 0, `${tipo}: errores de página: ` + m.errs.join("; "));
  await m.cerrar();
}
console.log(fallos ? `${fallos} FALLOS` : "OK"); process.exit(fallos ? 1 : 0);
