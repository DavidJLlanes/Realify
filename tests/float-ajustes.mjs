/* Prueba de los ajustes en coma flotante (fases 11, 12 y 20): sobre un PNG de 16 bits de rango estrecho (el caso que a 8 bits sale a escalones) se
   aplica cada ajuste y se comprueba que la capa nueva CONSERVA sus 16 bits, que su lienzo de 8 bits es el redondeo de esos 16 bits, que se parece al cálculo
   de 8 bits de siempre (la diferencia media no pasa de ~2 niveles) y que, si el ajuste cambió la imagen, el degradado sale SUAVE (muchos más valores distintos
   en los 16 bits que en los 8). Uso: node tests/float-ajustes.mjs <comando…>   (p. ej. adj.tone adj.shadowsHighlights); sin argumentos, todos los migrados. */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALL = ["adj.tone", "adj.toneBand", "adj.selectiveColor", "adj.gradientMap", "adj.colorBalance", "adj.shadowsHighlights", "adj.clahe", "adj.lowLight", "adj.grayscale",
  "adj.invert", "adj.auto", "adj.autoLevels", "adj.colorGrading", "adj.splitToning", "adj.photoFilter", "adj.labCurves", "adj.rangeHsl", "adj.replaceColor", "adj.desaturate",
  "adj.dehaze", "adj.hdrTone", "adj.tonalContrast", "adj.graduatedFilter", "adj.equalize"];
const cmds = process.argv.slice(2).filter(a => !a.startsWith("--")); const list = cmds.length ? cmds : ALL;
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${srv.address().port}/`, b = await chromium.launch(); let failed = false;

/* PNG de 16 bits de rango estrecho y con color: 1200×400, R 18000→22800, G 21000→24600 + y, B 30000→25000 */
async function make16(page){
  const b64 = await page.evaluate(async () => {
    const { png16 } = await import("/js/io/formats16.js"), W = 1200, H = 400, d = new Uint16Array(W * H * 3);
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 3; d[i] = 18000 + x * 4 + (y >> 3); d[i + 1] = 21000 + x * 3 + y * 6; d[i + 2] = 30000 - x * 4 - (y >> 2); }
    const blob = await png16({ data: d, channels: 3, w: W, h: H, space: "srgb" }), u = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for(let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s);
  });
  const f = path.join(os.tmpdir(), "narrow16.png"); fs.writeFileSync(f, Buffer.from(b64, "base64")); return f;
}
for(const cmd of list){
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(), errs = [], problems = [];
  page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.dismiss().catch(() => {}));
  let info = {};
  try{
    await page.goto(BASE); await page.waitForTimeout(1200);
    const f = await make16(page);
    await page.setInputFiles("#filePicker", f); await page.waitForTimeout(1800);
    const has = await page.evaluate(async () => { const D = await import("/js/core/doc.js"); const L = D.doc.layers[0]; return !!(L.hiSrc && L.hiSrc.data); });
    if(!has) problems.push("la imagen de prueba no abrió con origen de 16 bits");
    page.evaluate(c => import("/js/ui/commands.js").then(m => m.run(c)), cmd).catch(e => errs.push(String(e)));
    await page.waitForTimeout(1800);
    const apply = page.locator("button:visible", { hasText: /^(Aplicar|Aceptar)$/ });
    if(await apply.count()){
      let r = page.locator(".modal-card input[type=range]:visible").first();
      if(await r.count()){ try{ await r.focus({ timeout: 1000 }); for(let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight"); }catch{} }
      await page.waitForTimeout(2200);
      await apply.last().click({ timeout: 60000 });
    }
    await page.waitForTimeout(4500);
    info = await page.evaluate(async () => {
      const D = await import("/js/core/doc.js"), H = await import("/js/core/hisrc.js"), reg = await import("/js/editor/filterregistry.js");
      const L = D.doc.layers[D.doc.layers.length - 1], base = D.doc.layers[0], c = L.canvas, o = { capas: D.doc.layers.length, nombre: L.name, hi: !!L.hiSrc, filtro: L.filters && L.filters[0] && L.filters[0].id };
      if(!L.hiSrc || L === base) return o;
      const hs = L.hiSrc, W = c.width, Hh = c.height, px = c.getContext("2d").getImageData(0, 0, W, Hh).data;
      // 1) el lienzo de 8 bits es el redondeo (con el mismo tramado) de los 16 bits
      let bad = 0, n = 0; for(let y = 0; y < Hh; y += 7) for(let x = 0; x < W; x += 5){ const i = (y * W + x) * 4, j = (y * W + x) * 3;
        for(let k = 0; k < 3; k++){ n++; if(H.hiToCanvas8(hs.data[j + k], x, y, k, hs.dither) !== px[i + k]) bad++; } }
      o.redondeoMal = +(100 * bad / n).toFixed(2);
      // 2) se parece al cálculo de 8 bits de siempre
      const f = L.filters && L.filters[0];
      if(f && reg.knownFilter(f.id)){ const ref = await reg.renderFilter(f.id, base, f.params, true); if(ref){ const rp = ref.getContext("2d").getImageData(0, 0, W, Hh).data; let s = 0, m = 0; for(let i = 0; i < px.length; i += 28){ s += Math.abs(px[i] - rp[i]) + Math.abs(px[i + 1] - rp[i + 1]) + Math.abs(px[i + 2] - rp[i + 2]); m += 3; } o.difReferencia = +(s / m).toFixed(2); } }
      // 3) ¿cambió la imagen? ¿sale suave? (una fila del centro)
      const row = Math.floor(Hh / 2); const d16 = new Set(), d8 = new Set(); let changed = 0;
      const bj = base.hiSrc.data;
      for(let x = 0; x < W; x++){ const j = (row * W + x) * 3, i = (row * W + x) * 4; d16.add(hs.data[j]); d8.add(px[i]); if(Math.abs(hs.data[j] - bj[j]) > 300 || Math.abs(hs.data[j + 1] - bj[j + 1]) > 300) changed++; }
      o.cambia = changed > W * 0.05; o.valores16 = d16.size; o.valores8 = d8.size;
      return o;
    });
    if(!info.hi) problems.push(info.capas < 2 ? "no se creó ninguna capa" : "la capa nueva NO conserva los 16 bits");
    if(info.hi && info.redondeoMal > 1) problems.push(`el lienzo de 8 bits no es el redondeo de los 16 (${info.redondeoMal} % distintos)`);
    if(info.difReferencia > 2.5) problems.push(`se aleja del cálculo de 8 bits (dif. media ${info.difReferencia})`);
    if(info.hi && info.cambia && info.valores16 < info.valores8 * 3) problems.push(`el degradado no sale suave: ${info.valores16} valores en 16 bits frente a ${info.valores8} en 8`);
  }catch(e){ problems.push("error de la prueba: " + String(e.message || e).split("\n")[0]); }
  if(errs.length) problems.push("errores JS: " + errs.slice(0, 2).join(" | "));
  if(problems.length) failed = true;
  console.log(`${problems.length ? "FALLO" : "APTO "} · ${cmd} · ${JSON.stringify(info)}`); for(const p of problems) console.log("        - " + p);
  await ctx.close();
}
await b.close(); srv.close(); console.log(failed ? "float-ajustes: FALLO" : "float-ajustes: OK"); process.exit(failed ? 1 : 0);
