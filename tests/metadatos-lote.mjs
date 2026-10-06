/* Metadatos en el lote y las Acciones en lote (v255): una foto con EXIF/IPTC/XMP se abre, se exporta y recibe los suyos (sin ubicación) más los campos editados
   de la foto de referencia. Usa /tmp/sc/out/m.original (lo deja tests/metadatos-formatos.mjs). Uso: node tests/metadatos-lote.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(), errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const orig = fs.readFileSync("/tmp/sc/out/m.original").toString("base64");
const res = await page.evaluate(async orig => {
  const D = await import("/js/core/doc.js"), O = await import("/js/io/open.js"), BM = await import("/js/io/batchmeta.js"), M = await import("/js/io/metadata.js");
  const bytes = Uint8Array.from(atob(orig), c => c.charCodeAt(0)), file = new File([bytes], "foto.jpg", { type: "image/jpeg" });
  await O.openFile(file);
  const out = { fuente: !!D.doc.source?.file };
  D.doc.metaEdit = { title: "T lote", description: "", author: "Autor de lote", copyright: "© Lote", keywords: ["a", "b"], date: "2030-01-01T00:00", lat: 10, lon: 20, remove: [] };
  const f = BM.sharedFields(); out.lista = f && Object.keys(f).filter(k => Array.isArray(f[k]) ? f[k].length : f[k]);
  const c = document.createElement("canvas"); c.width = 32; c.height = 24; c.getContext("2d").fillRect(0, 0, 32, 24);
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", .9));
  const check = async (key, opts) => { const r = await BM.embedForBatch(blob, opts), o = await M.readOriginalMetadata(new File([r], "x.jpg")); const g = tag => o.tiff && o.tiff.ifd0.find(e => e.tag === tag);
    out[key] = { cambia: r !== blob, autor: g(0x013B) ? new TextDecoder().decode(g(0x013B).bytes).replace(/\0.*/, "") : null, gps: !!(o.tiff && o.tiff.gps.length), camara: g(0x010F) ? new TextDecoder().decode(g(0x010F).bytes).replace(/\0.*/, "") : null, iptc: o.iptc.length, xmp: /Autor de lote/.test(o.xmp || ""), serie: !!(o.tiff && o.tiff.exif.find(e => e.tag === 0xA431)) }; };
  await check("nada", {}); await check("original", { keep: true }); await check("soloCampos", { fields: f }); await check("ambos", { keep: true, fields: f });
  return out;
}, orig);
console.log(JSON.stringify(res));
const ok = res.fuente && res.lista.join() === "title,author,copyright,keywords" && !res.nada.cambia && res.original.camara === "TestCam" && res.original.autor === "Ana Original" && !res.original.gps && !res.original.serie
  && res.soloCampos.autor === "Autor de lote" && res.soloCampos.camara === null && res.ambos.autor === "Autor de lote" && res.ambos.camara === "TestCam" && !res.ambos.gps && res.ambos.xmp;
console.log(ok && !errs.length ? "OK" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
