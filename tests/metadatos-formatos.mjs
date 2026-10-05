/* Metadatos al exportar en todos los formatos (v253): genera un «original» con EXIF (con nota del fabricante), IPTC y XMP, lo filtra con io/metadata.js y lo incrusta en JPEG, PNG, WebP, AVIF, JPEG XL, TIFF y PDF; tests/metadatos_check.py lo verifica con PIL, pillow-heif y tifffile: una capa cuyo origen sólo cubre un rectángulo del lienzo (recortado o desplazado). Los motores de
   coma flotante (editor/floatadjust.js y floatfilter.js) deben calcular en 16 bits dentro del rectángulo y en 8 bits fuera, devolver el rectángulo,
   y el resultado debe ser coherente: el lienzo es el redondeo de los 16 bits dentro, y el cálculo de 8 bits fuera. Además, el guardado de proyecto
   debe conservar el rectángulo. Uso: node tests/hi-parcial.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(), errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if(/project|16 bits/.test(m.text())) console.log("consola:", m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const res = await page.evaluate(async () => {
  const M = await import("/js/io/metadata.js"), W = await import("/js/exif/writer.js"), C = await import("/js/io/codecs.js"), F = await import("/js/io/formats.js"), P = await import("/js/io/professional-formats.js");
  const enc = s => new TextEncoder().encode(s), out = {};
  const toB64 = async b => { const u = new Uint8Array(await b.arrayBuffer()); let s = ""; for(let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
  // un «original»: EXIF con nota del fabricante en el desplazamiento 200, IPTC y XMP
  const maker = new Uint8Array(40); maker.set(enc("MAKERTEST")); new DataView(maker.buffer).setUint32(16, 200, true);
  const inline = new Uint8Array(4); new DataView(inline.buffer).setUint32(0, 200, true);
  const exifIn = W.buildTIFF([W.eAscii(0x010F, "TestCam"), W.eAscii(0x0110, "Modelo 9"), W.eAscii(0x013B, "Ana Original"), W.eAscii(0x8298, "© Ana"), W.eAscii(0x010E, "Foto de prueba")],
    [W.eAscii(0x9003, "2020:01:02 03:04:05"), W.eShort(0x8827, 400), { tag: 0x927C, type: 7, count: 40, bytes: inline }, W.eAscii(0xA431, "SERIAL123")],
    [W.eByte(0, [2, 3, 0, 0]), W.eAscii(1, "N"), W.eRat(2, [[40, 1], [30, 1], [0, 1]]), W.eAscii(3, "W"), W.eRat(4, [[3, 1], [0, 1], [0, 1]])], { start: 400, extra: { off: 200, bytes: maker } });
  const sets = [{ rec: 1, ds: 90, bytes: new Uint8Array([0x1B, 0x25, 0x47]) }, { rec: 2, ds: 80, bytes: enc("Ana IPTC") }, { rec: 2, ds: 116, bytes: enc("© IPTC 2020") }, { rec: 2, ds: 25, bytes: enc("playa") }, { rec: 2, ds: 25, bytes: enc("verano") }, { rec: 2, ds: 90, bytes: enc("Cádiz") }];
  const xmpIn = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Título XMP</rdf:li></rdf:Alt></dc:title><dc:creator><rdf:Seq><rdf:li>Ana XMP</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>`;
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 48; const x = cv.getContext("2d"); const g = x.createLinearGradient(0, 0, 64, 48); g.addColorStop(0, "#f00"); g.addColorStop(1, "#00f"); x.fillStyle = g; x.fillRect(0, 0, 64, 48);
  const blobOf = type => new Promise(r => cv.toBlob(r, type, .9));
  const origJpg = await M.embedMetadata(await blobOf("image/jpeg"), { exif: exifIn, xmp: xmpIn, iptc: M.buildIptc(sets, { author: true, text: true, gps: true, date: true }) });
  out.original = await toB64(origJpg);
  const orig = await M.readOriginalMetadata(new File([origJpg], "o.jpg"));
  out.leido = { maker: !!orig.maker && orig.maker.off, iptc: orig.iptc.length, xmp: !!orig.xmp };
  const policy = { author: true, date: true, camera: true, gps: true, text: true, ids: true, maker: true };
  const over = { title: "Título editado", description: "Descripción editada", author: "Beto Editor", copyright: "© Beto 2024", keywords: ["uno", "dos"], date: "2024-05-03T18:30", lat: -33.5, lon: 151.25 };
  const meta = M.filterMetadata(orig, policy, { w: 64, h: 48, over });
  const meta0 = M.filterMetadata(orig, { ...policy, maker: false, ids: false, gps: false }, { w: 64, h: 48 });
  out.sinOver = { exif: !!meta0.exif, xmp: !!meta0.xmp, iptc: !!meta0.iptc };
  const px = x.getImageData(0, 0, 64, 48);
  const files = {
    jpg: await blobOf("image/jpeg"), png: await blobOf("image/png"), webp: await blobOf("image/webp"),
    avif: await F.avifFromCanvas(cv, .6, "srgb"), jxl: await C.encodeJxl(new Uint8Array(px.data.buffer), 64, 48, { quality: 85, effort: 3 }), tif: await P.tiffFromCanvas(cv, "srgb")
  };
  for(const [k, b] of Object.entries(files)){ const r = await M.embedMetadata(b, meta); out[k] = await toB64(r); out[k + "_cambia"] = r !== b; }
  const fx = M.fieldsFromXmp(meta.xmp);
  out.pdf = await toB64(await F.pdfFromCanvases([cv], { info: { title: fx.title, author: fx.author, subject: fx.description, keywords: fx.keywords, date: "2024-05-03T18:30:00" }, xmp: meta.xmp }));
  // XMP extendido: un XMP enorme se parte en segmentos
  const big = M.xmpSegments(`<x:xmpmeta xmlns:x="adobe:ns:meta/">${"a".repeat(150000)}</x:xmpmeta>`);
  out.extSegs = big.length; out.md5 = [M.md5hex(new TextEncoder().encode("")), M.md5hex(new TextEncoder().encode("The quick brown fox jumps over the lazy dog"))];
  out.fields = fx;
  return out;
});
fs.mkdirSync("/tmp/sc/out", { recursive: true });
for(const k of ["original", "jpg", "png", "webp", "avif", "jxl", "tif", "pdf"]) fs.writeFileSync(`/tmp/sc/out/m.${k}`, Buffer.from(res[k], "base64"));
const small = { ...res }; for(const k of ["original", "jpg", "png", "webp", "avif", "jxl", "tif", "pdf"]) delete small[k];
console.log(JSON.stringify(small));
const ok = res.leido.maker === 200 && res.leido.iptc >= 5 && res.leido.xmp && ["jpg", "png", "webp", "avif", "jxl", "tif"].every(k => res[k + "_cambia"]) && res.extSegs >= 3
  && res.md5[0] === "d41d8cd98f00b204e9800998ecf8427e" && res.md5[1] === "9e107d9d372bb6826bd81d3542a419d6";
console.log(ok && !errs.length ? "OK (falta metadatos_check.py)" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
