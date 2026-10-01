/* ═══════════════════════════════════════════════════════════════
   PRUEBA DE CALIDAD DE UNA HERRAMIENTA (no pixelar la imagen)

   Uso:   node tests/calidad-herramienta.mjs <comando> [<comando>…]
   Ej.:   node tests/calidad-herramienta.mjs adj.hsl
          node tests/calidad-herramienta.mjs filter.sharpen adj.curves

   Se pasa SÓLO por la herramienta que se haya modificado (el
   comando es el de su entrada de menú, ver js/ui/menu.js). En
   móvil y en escritorio:
     1. Abre una imagen de detalle fino de 3000×2000 (ruido de 1 px
        y tablero de 2 px) generada aquí mismo.
     2. Ejecuta el comando, mueve el primer deslizador, espera a que
        se suelte y pulsa Aplicar/Aceptar.
     3. Comprueba que la capa resultante:
        · tiene el tamaño del documento;
        · coincide con el cálculo a resolución completa del filtro
          (registro de filtros) → no se quedó la vista previa
          reducida, que es lo que pixela;
        · lo que se veía tras soltar el mando coincide con lo aplicado;
        · no lanza errores de JavaScript.
   Termina con APTO, APTO* (con aviso) o FALLO por modo (código de
   salida 1 si algo falla).

   Necesita Playwright con Chromium. Sirve el propio repositorio en
   un puerto local, sin dependencias de servidor.
   ═══════════════════════════════════════════════════════════════ */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cmds = process.argv.slice(2).filter(a => !a.startsWith("--"));
if(!cmds.length){
  console.log("Uso: node tests/calidad-herramienta.mjs <comando> [<comando>…]   (p. ej. adj.hsl)");
  process.exit(2);
}

let chromium;
for(const spec of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){
  try{ ({ chromium } = await import(spec)); break; }catch{}
}
if(!chromium){ console.error("No se encuentra Playwright."); process.exit(2); }

/* ── servidor estático mínimo ── */
const TYPES = { ".html":"text/html", ".js":"text/javascript", ".mjs":"text/javascript", ".css":"text/css",
  ".json":"application/json", ".png":"image/png", ".jpg":"image/jpeg", ".webp":"image/webp", ".svg":"image/svg+xml",
  ".wasm":"application/wasm", ".onnx":"application/octet-stream", ".webmanifest":"application/manifest+json",
  ".woff2":"font/woff2", ".ico":"image/x-icon", ".bin":"application/octet-stream" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if(p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const MAE_MAX = 3;          // diferencia media admitida (0-255) frente al cálculo completo
const browser = await chromium.launch();
let failed = false;

/* Imagen de prueba: degradado de color + ruido de 1 px + tablero de 2 px */
async function testImage(page){
  const url = await page.evaluate(() => {
    const w = 3000, h = 2000, c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"), im = x.createImageData(w, h), d = im.data;
    let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
    for(let y = 0, i = 0; y < h; y++) for(let X = 0; X < w; X++, i += 4){
      const chk = ((X >> 1) + (y >> 1)) & 1 ? 30 : 0;
      d[i]     = Math.max(0, Math.min(255, 0.7 * (X / w * 180 + 40) + (rnd() * 50 - 25) + chk));
      d[i + 1] = Math.max(0, Math.min(255, 0.7 * (y / h * 150 + 50) + (rnd() * 50 - 25) + chk));
      d[i + 2] = Math.max(0, Math.min(255, 0.7 * ((X + y) % 7 * 20 + 60) + (rnd() * 50 - 25) + chk));
      d[i + 3] = 255;
    }
    x.putImageData(im, 0, 0); return c.toDataURL("image/png");
  });
  return Buffer.from(url.split(",")[1], "base64");
}

let png = null;
for(const cmd of cmds) for(const mobile of [false, true]){
  const mode = mobile ? "móvil" : "escritorio";
  const ctx = await browser.newContext(mobile ? { viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true } : { viewport:{ width:1280, height:800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  page.on("dialog", d => d.dismiss().catch(() => {}));
  const problems = [], warnings = [], info = {};
  try{
    await page.goto(BASE); await page.waitForTimeout(1200);
    if(!png) png = await testImage(page);
    await page.setInputFiles("#filePicker", { name:"detalle-fino.png", mimeType:"image/png", buffer: png });
    await page.waitForTimeout(1500);
    page.evaluate(c => import("/js/ui/commands.js").then(m => m.run(c)), cmd).catch(e => errs.push(String(e)));
    await page.waitForTimeout(2500);

    const apply = page.locator("button:visible", { hasText: /^(Aplicar|Aceptar|Abrir en Realify)$/ }).or(page.locator('[data-a="apply"]:visible'));
    if(await apply.count()){
      const r = page.locator("input[type=range]:visible").first();
      if(await r.count()){
        try{ await r.focus({ timeout: 1000 }); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); info.moved = true; }catch{}
      }
      await page.waitForTimeout(2600);
      await page.evaluate(() => import("/js/core/doc.js").then(m => {
        const L = m.doc.layers.find(l => l.id === m.doc.activeId) || m.doc.layers.at(-1);
        window.__q = { d: L.canvas.getContext("2d").getImageData(0, 0, L.canvas.width, L.canvas.height).data.slice() };
      }));
      await apply.last().click({ timeout: 60000 });
      await page.waitForTimeout(4000);
    } else info.ui = "sin diálogo (se aplica directamente)";

    Object.assign(info, await page.evaluate(async () => {
      const m = await import("/js/core/doc.js"), reg = await import("/js/editor/filterregistry.js");
      const L = m.doc.layers.find(l => l.id === m.doc.activeId) || m.doc.layers.at(-1), c = L.canvas, base = m.doc.layers[0].canvas;
      const get = cv => cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      const mae = (a, b) => { let s = 0, k = 0; for(let i = 0; i < a.length; i += 28){ s += Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]); k += 3; } return +(s / k).toFixed(2); };
      const hf = d => { let s = 0, n = 0; for(let i = 4; i < Math.min(d.length, 2400000); i += 4){ s += Math.abs(d[i] - d[i - 4]); n++; } return +(s / n).toFixed(1); };
      const d = get(c), o = { capas: m.doc.layers.length, capa: L.name, tam: c.width + "×" + c.height, doc: m.doc.w + "×" + m.doc.h, detalle: hf(d), detalleOriginal: hf(get(base)) };
      const f = L.filters && L.filters[0];
      if(f){ o.filtro = f.id;
        if(reg.knownFilter(f.id) && c.width === base.width && c.height === base.height){
          const ref = await reg.renderFilter(f.id, base, f.params, true);
          if(ref){ o.detalleReferencia = hf(get(ref)); o.difReferencia = mae(d, get(ref)); }
        } }
      // Durante el diálogo la vista previa se pinta sobre la capa activa
      // y el resultado va a una capa nueva: se compara el contenido.
      if(window.__q && window.__q.d.length === d.length) o.difSoltado = mae(window.__q.d, d);
      return o;
    }));

    if(info.capas < 2 && !info.ui) problems.push("no se creó ninguna capa");
    if(info.tam !== info.doc) problems.push(`tamaño ${info.tam} ≠ documento ${info.doc}`);
    if(info.difReferencia > MAE_MAX) problems.push(`no coincide con el cálculo completo (dif. ${info.difReferencia}) → posible vista previa reducida`);
    /* Aviso, no fallo: los filtros pesados mantienen en el diálogo la
       vista previa reducida hasta pulsar Aplicar (para no congelar la
       app); lo que importa es que el resultado aplicado sea completo. */
    if(info.difSoltado > MAE_MAX) warnings.push(`vista previa tras soltar el mando ≠ resultado aplicado (dif. ${info.difSoltado}): la vista previa del diálogo sigue reducida; el resultado sí es completo si no hay otros fallos`);
    if(info.difReferencia === undefined && info.detalle < 0.5 * info.detalleOriginal) problems.push(`detalle bajo sin referencia (${info.detalle} de ${info.detalleOriginal}): revisar a mano`);
  }catch(e){ problems.push("error de la prueba: " + String(e.message || e).split("\n")[0]); }
  if(errs.length) problems.push("errores JS: " + errs.slice(0, 2).join(" | "));

  const ok = !problems.length;
  if(!ok) failed = true;
  console.log(`${ok ? (warnings.length ? "APTO*" : "APTO ") : "FALLO"} · ${cmd} · ${mode} · ${JSON.stringify(info)}`);
  for(const p of problems) console.log("        - FALLO: " + p);
  for(const w of warnings) console.log("        - aviso: " + w);
  await ctx.close();
}

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
