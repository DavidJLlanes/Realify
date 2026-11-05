/* ═══════════════════════════════════════════════════════════════
   PRUEBA · js/features/ai-kit/
   Comprueba en el navegador las piezas comunes: imagen visible, resultado en capa nueva (con «mezcla» y deshacer), tabla de
   luz lineal y vista previa; y que depthtools.js sigue ofreciendo la API de siempre (lo reexporta desde el kit).
   Uso: node tests/ia/ai-kit.mjs
   ═══════════════════════════════════════════════════════════════ */
import { abrir, documentoDePrueba } from "./lib/navegador.mjs";

const m = await abrir("escritorio");
await documentoDePrueba(m.page, 320, 200);
const r = await m.page.evaluate(async () => {
  const out = {};
  const D = await import("/js/core/doc.js"), H = await import("/js/core/history.js");
  const kit = { vis: await import("/js/features/ai-kit/visible-image.js"), nl: await import("/js/features/ai-kit/new-layer.js"),
    fl: await import("/js/features/ai-kit/float.js"), pv: await import("/js/features/ai-kit/preview.js"),
    se: await import("/js/features/ai-kit/session.js"), mg: await import("/js/features/ai-kit/model-gate.js") };
  const v = await kit.vis.visibleImage();
  out.visible = v && v.width === 320 && v.height === 200;
  const antes = D.doc.layers.length;
  const c = document.createElement("canvas"); c.width = 320; c.height = 200;
  c.getContext("2d").fillStyle = "#f00"; c.getContext("2d").fillRect(0, 0, 320, 200);
  await kit.nl.toNewLayer(c, "Prueba kit");
  const capa = D.doc.layers[D.doc.layers.length - 1];
  out.capaNueva = D.doc.layers.length === antes + 1 && capa.name === "Prueba kit" && D.doc.activeId === capa.id;
  out.mezcla = !!(capa.filters && capa.filters[0] && capa.filters[0].mix);
  out.pixel = Array.from(capa.ctx.getImageData(10, 10, 1, 1).data).join(",") === "255,0,0,255";
  const { undo, redo } = await import("/js/core/history.js").then(h => ({ undo: h.undo, redo: h.redo }));
  if (undo) { undo(); out.deshacer = D.doc.layers.length === antes; redo(); out.rehacer = D.doc.layers.length === antes + 1; }
  out.dec = Math.abs(kit.fl.DEC[255] - 1) < 1e-6 && kit.fl.DEC[0] === 0 && Math.abs(kit.fl.DEC[128] - 0.2158605) < 1e-5;
  out.escala = kit.pv.scaled(c, 160).width === 160 && kit.pv.PREVIEW === 1280 && typeof kit.pv.WORK() === "number";
  out.sesion = typeof kit.se.aiSession === "function" && typeof kit.mg.isModelCached === "function";
  const dt = await import("/js/features/depthtools.js");
  out.depthtools = ["DEC", "hash", "enc", "pixelsOf", "visibleImage", "toNewLayer", "PREVIEW", "WORK", "scaled", "prepare", "getDepth", "openShell", "sampler"].filter(k => !(k in dt));
  out.modulos = [];
  for (const f of ["facetools", "depthtools", "depthlight", "depthzones", "textselect", "docscan"]) { try { await import(`/js/features/${f}.js`); } catch (e) { out.modulos.push(f + ": " + e.message); } }
  return out;
});
await m.cerrar();
let fallos = 0;
for (const [k, v] of Object.entries(r)) { const ok = (k === "depthtools" || k === "modulos") ? v.length === 0 : v === true; if (!ok) { fallos++; console.log("FALLO:", k, JSON.stringify(v)); } }
if (m.errs.length) { fallos++; console.log("FALLO: errores de página:", m.errs.join("; ")); }
console.log(fallos ? "ai-kit: FALLO" : "ai-kit: OK", JSON.stringify(r));
process.exit(fallos ? 1 : 0);
