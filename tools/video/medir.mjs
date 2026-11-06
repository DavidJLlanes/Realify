/* ═══════════════════════════════════════════════════════════════
   VÍDEO · EJECUTA EL MEDIDOR DE WEBCODECS EN EL NAVEGADOR DE DESARROLLO (F15.1)
   Abre plugins/video/estudio/medir.html en Chromium sin ventana, ejecuta la medición y la guarda en docs/video-medidas/<etiqueta>.json.
   Uso: CHROME_EXE=/usr/bin/google-chrome node tools/video/medir.mjs [etiqueta]   ·   Límites: es el equipo de desarrollo, no un móvil.
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import { abrir } from "../../tests/ia/lib/navegador.mjs";
const etiqueta = process.argv[2] || "desarrollo-escritorio";
const m = await abrir("escritorio");
await m.page.goto(m.page.url().replace(/\/[^/]*$/, "/") + "plugins/video/estudio/medir.html");
const r = await m.page.evaluate(async () => { const mod = await import("/plugins/video/estudio/medir.js"); return mod.medir(); });
fs.mkdirSync("docs/video-medidas", { recursive: true }); fs.writeFileSync(`docs/video-medidas/${etiqueta}.json`, JSON.stringify(r, null, 1));
for (const f of r.filas) console.log(f.tamano, f.codec, f.aceleracion, "enc", f.codifica ? f.codificar_ms_fotograma + "ms" : "no", "dec", f.decodifica ? f.decodificar_ms_fotograma + "ms" : "no", f.error || "");
await m.cerrar();
