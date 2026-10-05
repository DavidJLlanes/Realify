/* Prueba del límite de memoria de los códecs (fase 20): codifica AVIF 8 bits, AVIF 10 bits y JPEG XL con una imagen de MP megapíxeles
   (por defecto 12 y 24) y comprueba que terminan sin agotar la memoria. Uso: node tests/codec-memoria.mjs [MP ...] [--solo=avif8|avif10|jxl] */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { execSync } from "node:child_process";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const args = process.argv.slice(2), mps = args.filter(a => /^\d+$/.test(a)).map(Number), solo = (args.find(a => a.startsWith("--solo=")) || "").slice(7);
let bad = 0;
for(const mp of mps.length ? mps : [12, 24]) for(const tipo of ["avif8", "avif10", "jxl"]){
  if(solo && solo !== tipo) continue;
  const b = await chromium.launch(), page = await b.newPage(); page.setDefaultTimeout(0);
  await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1000);
  const w = Math.round(Math.sqrt(mp * 1e6 * 4 / 3)), h = Math.round(w * 3 / 4);
  const t0 = Date.now(); let peak = 0;
  const timer = setInterval(() => { try{ const kb = execSync("ps -eo rss,args | grep -i [c]hrom | awk '{s+=$1} END {print s}'", { encoding: "utf8" }); peak = Math.max(peak, Number(kb) / 1024); }catch{} }, 500);
  const r = await page.evaluate(async ({ tipo, w, h }) => {
    const C = await import("/js/io/codecs.js");
    try{
      let blob;
      if(tipo === "avif10"){ const data = new Uint16Array(w * h * 3); for(let i = 0; i < data.length; i++) data[i] = (i * 2654435761 >>> 8) & 0xffff ^ (i % 65536); blob = await C.encodeAvifDeep({ data, channels: 3, width: w, height: h }, 10, { quality: 60 }); }
      else { const px = new Uint8Array(w * h * 4); for(let i = 0; i < px.length; i += 4){ const p = i >> 2; px[i] = p % w & 255; px[i + 1] = (p / w | 0) & 255; px[i + 2] = (p * 31) & 255; px[i + 3] = 255; }
        blob = tipo === "avif8" ? await C.encodeAvif8(px, w, h, { quality: 60 }) : await C.encodeJxl(px, w, h, { quality: 85, effort: 7 }); }
      return { ok: true, bytes: blob.size, max: C.codecMaxPixels() };
    }catch(e){ return { ok: false, err: String(e && e.message || e) }; }
  }, { tipo, w, h }).catch(e => ({ ok: false, err: "página caída: " + e.message }));
  clearInterval(timer); await b.close().catch(() => {});
  const fuera = !r.ok && tipo === "jxl" && mp > 16;       // por encima del límite de JPEG XL (codecMaxPixels('jxl') = 16 MP): se aborta, y está medido
  if(!r.ok && !fuera) bad++;
  console.log(r.ok ? "APTO " : fuera ? "FUERA" : "FALLO", `· ${mp} MP (${w}×${h}) · ${tipo} · ${((Date.now() - t0) / 1000).toFixed(0)} s · pico ≈ ${peak.toFixed(0)} MB · ${r.ok ? r.bytes + " B, límite " + r.max / 1e6 + " MP" : r.err}`);
}
srv.close(); console.log(bad ? "codec-memoria: FALLO" : "codec-memoria: OK"); process.exit(bad ? 1 : 0);
