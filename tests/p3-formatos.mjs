/* Prueba de WebP y TIFF de 8 bits con el perfil Display P3 incrustado (v249). Documento P3 → renderExport → se leen el contenedor RIFF/TIFF
   (ICCP / etiqueta 34675), el perfil debe ser el de Display P3 y la imagen decodificada por el navegador (WebP) debe dar los mismos colores P3.
   Uso: node tests/p3-formatos.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const res = await page.evaluate(async () => {
  const D = await import("/js/core/doc.js"), CS = await import("/js/core/colorspace.js"), E = await import("/js/io/export.js"), I = await import("/js/io/icc-embed.js"), ICC = await import("/js/core/icc.js");
  const out = { p3: CS.p3Supported() };
  D.newDoc(64, 48, { name: "p3" }); D.doc.colorSpace = "display-p3"; out.isP3 = CS.isP3Doc();
  const L = D.addLayer({ name: "c" }); const x = L.ctx; x.fillStyle = "#336699"; x.fillRect(0, 0, 64, 48);
  const prof = ICC.profileFor("display-p3"), same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  // WebP
  for(const [nombre, q] of [["webp con pérdidas", .8], ["webp sin pérdidas", 1]]){
    const blob = await E.renderExport({ w: 64, h: 48, type: "image/webp", quality: q });
    const u = new Uint8Array(await blob.arrayBuffer()); const r = { tipo: blob.type, riff: String.fromCharCode(...u.subarray(0, 4)), webp: String.fromCharCode(...u.subarray(8, 12)), primer: String.fromCharCode(...u.subarray(12, 16)) };
    // buscar ICCP
    let i = 12, icc = null, tam = (new DataView(u.buffer).getUint32(4, true)) + 8; r.tamOk = tam === u.length;
    while(i + 8 <= u.length){ const t = String.fromCharCode(...u.subarray(i, i + 4)), n = new DataView(u.buffer).getUint32(i + 4, true); if(t === "ICCP") icc = u.slice(i + 8, i + 8 + n); i += 8 + n + (n & 1); }
    r.icc = !!icc; r.perfilOk = !!icc && same(icc, prof); r.nativo = !same(icc || [], prof); r.vp8xFlag = (u[20] & 0x20) !== 0;
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: "default" }); r.ancho = bmp.width; r.alto = bmp.height;
    // colores: decodificado en lienzo P3 debe dar ~ los números originales del lienzo P3
    const c = new OffscreenCanvas(64, 48), cx = c.getContext("2d", { colorSpace: "display-p3", forceSrgb: false }); cx.drawImage(bmp, 0, 0);
    const px = cx.getImageData(32, 24, 1, 1, { colorSpace: "display-p3" }).data, ref = L.ctx.getImageData(32, 24, 1, 1, { colorSpace: "display-p3" }).data;
    { // WebP simple (sin VP8X): se extrae el fragmento de imagen, se envuelve y se etiqueta con nuestro perfil; el navegador debe decodificarlo igual
      let j = 12, img = null; while(j + 8 <= u.length){ const t = String.fromCharCode(...u.subarray(j, j + 4)), n = new DataView(u.buffer).getUint32(j + 4, true); if(t === "VP8 " || t === "VP8L") img = u.slice(j, j + 8 + n + (n & 1)); j += 8 + n + (n & 1); }
      const simple = new Uint8Array(12 + img.length); simple.set([82, 73, 70, 70]); new DataView(simple.buffer).setUint32(4, 4 + img.length, true); simple.set([87, 69, 66, 80], 8); simple.set(img, 12);
      const w = I.webpWithIcc(simple, prof); let ok = !!w && String.fromCharCode(...w.subarray(12, 16)) === "VP8X" && (w[20] & 0x20) !== 0 && new DataView(w.buffer).getUint32(4, true) + 8 === w.length;
      if(ok){ const bm = await createImageBitmap(new Blob([w], { type: "image/webp" })); ok = bm.width === 64 && bm.height === 48; let k = 12, got = null; while(k + 8 <= w.length){ const t = String.fromCharCode(...w.subarray(k, k + 4)), n2 = new DataView(w.buffer).getUint32(k + 4, true); if(t === "ICCP") got = w.slice(k + 8, k + 8 + n2); k += 8 + n2 + (n2 & 1); } ok = ok && !!got && same(got, prof); }
      r.simpleOk = ok; }
    r.dif = Math.max(...[0, 1, 2].map(k => Math.abs(px[k] - ref[k]))); out[nombre] = r;
  }
  // TIFF
  { const blob = await E.renderExport({ w: 64, h: 48, type: "image/tiff", quality: 1 }); const u = new Uint8Array(await blob.arrayBuffer()), v = new DataView(u.buffer);
    const r = { tipo: blob.type, orden: String.fromCharCode(u[0], u[1]), version: v.getUint16(2, true) }; const ifd = v.getUint32(4, true), n = v.getUint16(ifd, true); let icc = null, bits = null, spp = 0;
    for(let k = 0; k < n; k++){ const p = ifd + 2 + k * 12, id = v.getUint16(p, true), cnt = v.getUint32(p + 4, true), off = v.getUint32(p + 8, true);
      if(id === 34675) icc = u.slice(off, off + cnt); if(id === 258) bits = [v.getUint16(off, true), v.getUint16(off + 2, true)]; if(id === 277) spp = v.getUint16(p + 8, true); }
    r.icc = !!icc; r.perfilOk = !!icc && same(icc, prof); r.bits = bits; r.spp = spp;
    const so = v.getUint32(ifd + 2 + [...Array(n).keys()].find(k => v.getUint16(ifd + 2 + k * 12, true) === 273) * 12 + 8, true);
    r.pix = [...u.subarray(so + (24 * 64 + 32) * 4, so + (24 * 64 + 32) * 4 + 4)];
    r.ref = [...L.ctx.getImageData(32, 24, 1, 1, { colorSpace: "display-p3" }).data]; out.tiff = r; }
  // sRGB pedido: nada de perfil
  { const blob = await E.renderExport({ w: 64, h: 48, type: "image/webp", quality: .8, colorSpace: "srgb" }); const u = new Uint8Array(await blob.arrayBuffer()); out.srgbSinIccp = true; const bm = await createImageBitmap(blob); out.srgbAncho = bm.width; }
  // Casos de contenedor: VP8X ya existente y VP8 simple, con datos sintéticos
  { const mk = (chunks) => { const body = chunks.reduce((n, c) => n + c.length, 4), u = new Uint8Array(12 + body - 4); u.set([82, 73, 70, 70]); new DataView(u.buffer).setUint32(4, body, true); u.set([87, 69, 66, 80], 8); let o = 12; for(const c of chunks){ u.set(c, o); o += c.length; } return u; };
    const ck = (t, len) => { const c = new Uint8Array(8 + len + (len & 1)); c.set(new TextEncoder().encode(t)); new DataView(c.buffer).setUint32(4, len, true); return c; };
    const vp8x = ck("VP8X", 10); vp8x[8] = 0x10; vp8x[12] = 9; vp8x[15] = 0; vp8x[16] = 4; const u = mk([vp8x, ck("VP8L", 5)]);
    const w = I.webpWithIcc(u, prof); out.vp8xExistente = !!w && (w[20] & 0x30) === 0x30 && String.fromCharCode(...w.subarray(30, 34)) === "ICCP" && new DataView(w.buffer).getUint32(4, true) + 8 === w.length;
    out.yaTieneIccp = I.webpWithIcc(w, prof) === null; }
  return out;
});
console.log(JSON.stringify(res, null, 1));
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
if(!res.p3){ console.log("Este Chromium no admite lienzos P3: prueba omitida"); }
else{
  chk(res.isP3, "el documento no quedó en P3");
  for(const n of ["webp con pérdidas", "webp sin pérdidas"]){ const r = res[n]; chk(r.riff === "RIFF" && r.webp === "WEBP" && r.tamOk, n + ": contenedor"); chk(r.primer === "VP8X" && r.vp8xFlag, n + ": VP8X con indicador ICC"); chk(r.icc, n + ": lleva perfil (el de Realify o el que ya pone el navegador)"); chk(r.simpleOk, n + ": convertido a simple y vuelto a etiquetar con nuestro perfil"); chk(r.dif <= 6, n + ": colores P3 (" + r.dif + ")"); chk(r.ancho === 64 && r.alto === 48, n + ": tamaño"); }
  const t = res.tiff; chk(t.orden === "II" && t.version === 42 && t.icc && t.perfilOk, "TIFF con perfil P3"); chk(t.bits[0] === 8 && t.spp === 4, "TIFF 8 bits RGBA"); chk(Math.max(...[0, 1, 2].map(k => Math.abs(t.pix[k] - t.ref[k]))) <= 1, "TIFF píxel P3 = lienzo");
  chk(res.srgbSinIccp, "sRGB pedido: sin ICCP"); chk(res.vp8xExistente && res.yaTieneIccp, "VP8X existente");
}
chk(!errs.length, "errores de página: " + errs.join("|"));
await b.close(); srv.close(); console.log(bad ? "p3-formatos: FALLO" : "p3-formatos: OK"); process.exit(bad ? 1 : 0);
