/* ═════════════════════════════════════════════════
   PRUEBA · adaptar al formato de red en el navegador (recorte real y codificación)
   Foto 400×300: «Instagram cuadrado» → 300×300 (no amplía); «Historia» → 169×300; «web» sin tocar. Los controles nuevos del lote existen en la interfaz.
   Uso: node tests/ia/biblioteca/formatos.mjs
   ═════════════════════════════════════════════════ */
import { abrir } from "../lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const m = await abrir("escritorio");
const r = await m.page.evaluate(async () => {
  const S = await import("/plugins/batch/salida.js");
  const c = document.createElement("canvas"); c.width = 400; c.height = 300; const x = c.getContext("2d"); x.fillStyle = "#f00"; x.fillRect(0, 0, 200, 300); x.fillStyle = "#00f"; x.fillRect(200, 0, 200, 300);
  const blob = await new Promise(res => c.toBlob(res, "image/png")), dim = async b => { const i = await createImageBitmap(b); return [i.width, i.height]; };
  const a = await S.adaptarAFormato(blob, "ig-cuadrado", { type: "image/jpeg" }), h = await S.adaptarAFormato(blob, "historia", { type: "image/webp" }), v = await S.adaptarAFormato(blob, "ig-cuadrado", { type: "image/avif" });
  return { a: await dim(a.blob), at: a.blob.type, h: await dim(h.blob), ht: h.blob.type, vt: v.blob.type };
});
console.log(JSON.stringify(r));
ok(r.a[0] === 300 && r.a[1] === 300 && r.at === "image/jpeg", "cuadrado " + r.a); ok(r.h[0] === 169 && r.h[1] === 300 && r.ht === "image/webp", "historia " + r.h); ok(r.vt === "image/webp", "AVIF pasa a WebP");
ok(m.errs.length === 0, "errores " + m.errs.slice(0, 2)); await m.cerrar();
console.log(fallos ? `FALLOS: ${fallos}` : "OK · formatos para redes"); process.exit(fallos ? 1 : 0);
