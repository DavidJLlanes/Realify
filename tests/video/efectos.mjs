/* ═════════════════════════════════════════════════
   PRUEBA · efectos de vídeo: registro, manifiestos, motor de color (Node) y efectos WebGL en el navegador. Uso: CHROME_EXE=… node tests/video/efectos.mjs
   ═════════════════════════════════════════════════ */
import { aplicarColor, tablaTono } from "../../plugins/video/effects/color/motor.js";
import { crearRegistroEfectos } from "../../plugins/video/effects/registro.js";
import { MANIFIESTOS, registrarTodos } from "../../plugins/video/effects/lista.js";
import { abrir } from "../ia/lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

// motor de color puro
const px = (r, g, b) => new Uint8ClampedArray([r, g, b, 255]);
ok(aplicarColor(px(10, 20, 30), {}).join() === "10,20,30,255", "color neutro no toca");
const claro = aplicarColor(px(100, 100, 100), { exposicion: 1 }); ok(claro[0] > 100, "exposición +1 aclara");
const osc = aplicarColor(px(100, 100, 100), { exposicion: -1 }); ok(osc[0] < 100, "exposición −1 oscurece");
const gris = aplicarColor(px(200, 50, 50), { saturacion: -100 }); ok(Math.abs(gris[0] - gris[1]) < 2 && Math.abs(gris[1] - gris[2]) < 2, "saturación −100 deja gris");
const calido = aplicarColor(px(120, 120, 120), { temperatura: 80 }); ok(calido[0] > calido[2], "temperatura cálida: más rojo que azul");
const t = tablaTono({ contraste: 50 }); ok(t[0] === 0 && t[255] === 255 && t[64] < 64 && t[192] > 192, "contraste curva en S");
ok(tablaTono({}).every((v, i) => Math.abs(v - i) <= 1), "tabla neutra ≈ identidad");

// registro y manifiestos
const r = crearRegistroEfectos(); registrarTodos(r);
ok(r.lista().length === MANIFIESTOS.length && ["color", "sensor", "camaras"].every(id => r.tiene(id)), "los tres efectos están registrados");
for (const m of r.lista()) ok(m.params.every(p => p.key && p.label && p.type && p.def !== undefined) && m.version >= 1, "manifiesto válido: " + m.id);

// efectos reales en el navegador (WebGL)
const nav = await abrir("escritorio"), { page } = nav;
const res = await page.evaluate(async () => {
  const L = await import("/plugins/video/effects/lista.js"), R = await import("/plugins/video/effects/registro.js"), reg = R.crearRegistroEfectos(); L.registrarTodos(reg);
  const src = Object.assign(document.createElement("canvas"), { width: 320, height: 200 }), x = src.getContext("2d"), g = x.createLinearGradient(0, 0, 320, 200); g.addColorStop(0, "#c33"); g.addColorStop(1, "#36c"); x.fillStyle = g; x.fillRect(0, 0, 320, 200);
  const diff = (a, b) => { const d1 = a.getContext("2d").getImageData(0, 0, a.width, a.height).data, d2 = b.getContext("2d").getImageData(0, 0, b.width, b.height).data; let s = 0; for (let i = 0; i < d1.length; i += 4) s += Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]); return s / (d1.length / 4); };
  const out = {};
  for (const [id, params] of [["color", { exposicion: 1, saturacion: 40 }], ["sensor", { dosis: 100 }], ["camaras", { estilo: "vhs", intensidad: 100 }]]) {
    try { const e = await reg.instanciar(id, { ancho: 320, alto: 200, fps: 30 }), a = await e.process(src, params, 0.5), b = await e.process(src, params, 0.9); out[id] = { dif: +diff(src, a).toFixed(2), anim: +diff(a, b).toFixed(2), w: a.width, h: a.height }; e.dispose(); } catch (err) { out[id] = { error: err.message }; }
  }
  return out;
});
console.log(JSON.stringify(res));
ok(res.color.dif > 5 && res.color.w === 320, "color cambia la imagen");
for (const id of ["sensor", "camaras"]) { if (res[id].error) console.log("AVISO", id, res[id].error); else { ok(res[id].dif > 0.3 && res[id].w === 320 && res[id].h === 200, id + " cambia la imagen y conserva el tamaño"); } }
ok(nav.errs.length === 0, "sin errores de página: " + nav.errs.join(" | "));
await nav.cerrar();
console.log(fallos ? `${fallos} fallos` : "OK · efectos de vídeo"); process.exit(fallos ? 1 : 0);
