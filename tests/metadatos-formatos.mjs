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
  // XMP extendido: ida y vuelta por un JPEG real (descripción de 120 KB)
  const bigMeta = M.filterMetadata(null, { author: false, date: false, camera: false, gps: false, text: false, ids: false, maker: false }, { w: 64, h: 48, over: { description: "x".repeat(120000), author: "Ext" } });
  const bj = await M.embedMetadata(await blobOf("image/jpeg"), bigMeta), bu = new Uint8Array(await bj.arrayBuffer());
  const back = await M.readXmp(bu), ext = M.readXmpExtended(bu);
  out.ext = { main: back.length, tieneAviso: /HasExtendedXMP="[0-9A-F]{32}"/.test(back), extIgual: ext === bigMeta.xmp, md5: ext && /HasExtendedXMP="([0-9A-F]{32})"/.exec(back)[1] === M.md5hex(new TextEncoder().encode(ext)).toUpperCase() };
  out.fields = fx;
  // nota del fabricante en AVIF/JXL (mismo desplazamiento) y TIFF (Canon: se reubica y se corrigen sus desplazamientos)
  const mk2 = new Uint8Array(40); new DataView(mk2.buffer).setUint16(0, 1, true); new DataView(mk2.buffer).setUint16(2, 1, true); new DataView(mk2.buffer).setUint16(4, 3, true);
  new DataView(mk2.buffer).setUint32(6, 8, true); new DataView(mk2.buffer).setUint32(10, 218, true); for(let i = 0; i < 8; i++) new DataView(mk2.buffer).setUint16(18 + i * 2, 0x1100 + i, true);
  const inl2 = new Uint8Array(4); new DataView(inl2.buffer).setUint32(0, 200, true);
  const exifCanon = W.buildTIFF([W.eAscii(0x010F, "Canon"), W.eAscii(0x0110, "Canon EOS Test")], [W.eAscii(0x9003, "2020:01:02 03:04:05"), { tag: 0x927C, type: 7, count: 40, bytes: inl2 }], [], { start: 400, extra: { off: 200, bytes: mk2 } });
  const canonJpg = await M.embedMetadata(await blobOf("image/jpeg"), { exif: exifCanon });
  const oc = await M.readOriginalMetadata(new File([canonJpg], "c.jpg"));
  const mc = M.filterMetadata(oc, { ...policy }, { w: 64, h: 48 });
  out.canon = { make: mc.maker && mc.maker.make, off: mc.maker && mc.maker.off };
  out.tifCanon = await toB64(await M.embedMetadata(files.tif, mc)); out.avifCanon = await toB64(await M.embedMetadata(files.avif, mc)); out.jxlCanon = await toB64(await M.embedMetadata(files.jxl, mc));
  // nota grande (> 64 KB): el JPEG sigue llevando el resto del EXIF y los demás formatos la llevan
  const bigMk = new Uint8Array(70000); bigMk.set(enc("BIGMAKER")); const inl3 = new Uint8Array(4); new DataView(inl3.buffer).setUint32(0, 200, true);
  const exifBig = W.buildTIFF([W.eAscii(0x010F, "TestCam"), W.eAscii(0x013B, "Ana Grande")], [W.eAscii(0x9003, "2020:01:02 03:04:05"), { tag: 0x927C, type: 7, count: bigMk.length, bytes: inl3 }], [], { start: 70300, extra: { off: 200, bytes: bigMk } });
  const bigOrig = new File([await M.embedMetadata(await blobOf("image/png"), { exif: exifBig })], "b.png");
  const ob = await M.readOriginalMetadata(bigOrig), mb = M.filterMetadata(ob, { ...policy }, { w: 64, h: 48 });
  out.big = { maker: !!ob.maker, len: mb.maker && mb.maker.bytes.length, exifGrande: mb.exif.length > 65000, jpegLite: mb.exifJpeg.length < 65000 };
  const bj2 = new Uint8Array(await (await M.embedMetadata(await blobOf("image/jpeg"), mb)).arrayBuffer()), bp = new Uint8Array(await (await M.embedMetadata(await blobOf("image/png"), mb)).arrayBuffer());
  out.big.jpgOk = bj2[0] === 0xFF && bj2.length > 1000; out.big.pngTiene = new TextDecoder("latin1").decode(bp).includes("BIGMAKER");
  // quitar campos concretos del original (vaciarlos en «Editar metadatos»)
  const mq = M.filterMetadata(orig, policy, { w: 64, h: 48, over: { remove: ["author", "gps", "keywords", "date"], title: "Solo título" } });
  const tq = M.parseTiff(mq.exif.buffer.slice(mq.exif.byteOffset, mq.exif.byteOffset + mq.exif.length), 0), iq = M.parseIim(mq.iim);
  out.quitar = { autorExif: tq.ifd0.some(e => e.tag === 0x013B), copyExif: tq.ifd0.some(e => e.tag === 0x8298), fechaExif: tq.exif.some(e => e.tag === 0x9003), gps: tq.gps.length,
    autorIim: iq.some(e => e.ds === 80), copyIim: iq.some(e => e.ds === 116), clavesIim: iq.filter(e => e.ds === 25).length, tituloIim: iq.some(e => e.ds === 5),
    xmpAutor: /Ana Original|Ana IPTC/.test(mq.xmp || ""), xmpClaves: /<dc:subject>/.test(mq.xmp || ""), xmpTitulo: /Solo título/.test(mq.xmp || ""), xmpCopy: /<dc:rights>/.test(mq.xmp || "") };
  // IPTC de originales que no son JPEG: PNG (perfil crudo) y TIFF (33723)
  const ip = M.buildIptc(sets, { author: true, text: true, gps: true, date: true });
  const pngI = await M.embedMetadata(await blobOf("image/png"), { iptc: ip });
  const tifI = await M.embedMetadata(files.tif, { iim: M.buildIim(sets, { author: true, text: true, gps: true, date: true }) });
  const oP = await M.readOriginalMetadata(new File([pngI], "i.png")), oT = await M.readOriginalMetadata(new File([tifI], "i.tif"));
  out.iptcAny = { png: oP.iptc.length, tif: oT.iptc.length, autor: [oP, oT].map(o => { const a = o.iptc.find(e => e.ds === 80); return a ? new TextDecoder().decode(a.bytes) : null; }) };
  return out;
});
fs.mkdirSync("/tmp/sc/out", { recursive: true });
for(const k of ["original", "jpg", "png", "webp", "avif", "jxl", "tif", "pdf", "tifCanon", "avifCanon", "jxlCanon"]) fs.writeFileSync(`/tmp/sc/out/m.${k}`, Buffer.from(res[k], "base64"));
const small = { ...res }; for(const k of ["original", "jpg", "png", "webp", "avif", "jxl", "tif", "pdf", "tifCanon", "avifCanon", "jxlCanon"]) delete small[k];
console.log(JSON.stringify(small));
const ok = res.leido.maker === 200 && res.leido.iptc >= 5 && res.leido.xmp && ["jpg", "png", "webp", "avif", "jxl", "tif"].every(k => res[k + "_cambia"]) && res.extSegs >= 3 && res.ext.tieneAviso && res.ext.extIgual && res.ext.md5 && res.ext.main < 2000
  && res.quitar.autorExif === false && res.quitar.copyExif && res.quitar.fechaExif === false && res.quitar.gps === 0 && !res.quitar.autorIim && res.quitar.copyIim && res.quitar.clavesIim === 0 && res.quitar.tituloIim && !res.quitar.xmpAutor && !res.quitar.xmpClaves && res.quitar.xmpTitulo && res.quitar.xmpCopy
  && res.canon.make === "Canon" && res.big.maker && res.big.exifGrande && res.big.jpegLite && res.big.jpgOk && res.big.pngTiene && res.iptcAny.png >= 5 && res.iptcAny.tif >= 5 && res.iptcAny.autor[0] === "Ana IPTC" && res.iptcAny.autor[1] === "Ana IPTC"
  && res.md5[0] === "d41d8cd98f00b204e9800998ecf8427e" && res.md5[1] === "9e107d9d372bb6826bd81d3542a419d6";
console.log(ok && !errs.length ? "OK (falta metadatos_check.py)" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
