/* ═══════════════════════════════════════════════════════════════
   PRUEBA · tareas del worker de IA con modelos locales (sin descargas)
   Ejecuta en el navegador las tareas que usan modelos de assets/models (matte con U²-Net-P y caras con YuNet;
   los modelos con aviso de descarga, como el de profundidad, se dejan fuera porque esperan que alguien acepte el aviso) sobre una imagen sintética y escribe una huella del resultado.
   Sirve para comprobar que dividir o mover el worker no cambia ningún píxel:
     REALIFY_RAIZ=<copia anterior> node tests/ia/worker-tareas.mjs   →  huella A
     node tests/ia/worker-tareas.mjs                                  →  huella B   (deben ser iguales)
   ═══════════════════════════════════════════════════════════════ */
import crypto from "node:crypto";
import { abrir } from "./lib/navegador.mjs";

const m = await abrir("escritorio");
const r = await m.page.evaluate(async () => {
  const W = 256, H = 256, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#335"); g.addColorStop(1, "#ccd");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "#d96"; x.beginPath(); x.ellipse(128, 130, 60, 80, 0, 0, 7); x.fill();
  x.fillStyle = "#222"; x.fillRect(105, 110, 14, 8); x.fillRect(137, 110, 14, 8);
  const { matteAlpha } = await import("/js/ai/matte.js");
  const alpha = await matteAlpha(c, "u2netp", { tiles: false, refine: false });
  const { detectFaces } = await import("/js/ai/faces.js");
  let caras = null; try { caras = await detectFaces(c); } catch (e) { caras = "error: " + e.message; }
  return { alpha: Array.from(alpha), caras: JSON.stringify(caras) };
});
const h = b => crypto.createHash("sha256").update(b).digest("hex").slice(0, 16);
console.log("alfa", h(Buffer.from(r.alpha)), "· caras", h(Buffer.from(r.caras)), r.caras.slice(0, 60));
console.log("errores de página:", m.errs.length ? m.errs.join("; ") : "ninguno");
await m.cerrar();
process.exit(m.errs.length ? 1 : 0);
