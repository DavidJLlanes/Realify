/* Prueba del lector de credenciales de contenido (js/exif/c2pa.js) con archivos firmados de verdad (c2pa-python: tests/c2pa_gen.py los genera).
   Uso: node tests/c2pa.mjs [carpeta con c2pa_out.jpg, c2pa_out.png y c2pa_tamper.jpg] */
import fs from "node:fs";
import assert from "node:assert/strict";
import { readC2pa } from "../js/exif/c2pa.js";
const D = process.argv[2] || "/tmp/sc";
const rd = f => new Uint8Array(fs.readFileSync(`${D}/${f}`));
for(const f of ["c2pa_out.jpg", "c2pa_out.png"]){
  const r = await readC2pa(rd(f)), m = r && r.manifests.find(x => x.active);
  console.log(f, JSON.stringify({ c: r && r.container, g: m && m.claim.generator, t: m && m.claim.title, a: m && m.actions, au: m && m.authors, s: m && m.signature && { alg: m.signature.alg, cn: m.signature.cert && m.signature.cert.subject, iss: m.signature.cert && m.signature.cert.issuer, n: m.signature.chainLength }, ai: m && m.aiDeclared, h: m && m.hash, as: m && m.assertions.map(a => a.label) }));
  assert.ok(r && m, f + ": debe leer el manifiesto");
  assert.equal(m.claim.title, "Foto de prueba");
  assert.match(m.claim.generator, /Realify C2PA test/);
  assert.ok(m.actions.some(a => a.action === "c2pa.created" && a.sourceType === "trainedAlgorithmicMedia"), "acción created con fuente de IA");
  assert.ok(m.aiDeclared);
  assert.deepEqual(m.authors, ["Ana Autora"]);
  assert.equal(m.signature.alg, "ES256");
  assert.equal(m.signature.cert.subject.CN, "C2PA Signer");
  assert.equal(m.signature.cert.subject.O, "C2PA Test Signing Cert"); assert.equal(m.signature.cert.issuer.CN, "Intermediate CA");
  assert.ok(m.signature.chainLength >= 2);
  assert.equal(m.hash.status, "match", f + ": el hash de los datos debe coincidir");
  assert.equal(m.verify.signature, "valid", f + ": la firma COSE debe verificarse");
  assert.equal(m.verify.chain, "incomplete", f + ": la cadena de prueba no incluye la raíz");
  assert.ok(m.thumbnails.length >= 1 && m.thumbnails[0].bytes.length > 100, f + ": miniatura firmada");
}
// firma alterada: se cambia el generador dentro del manifiesto (la firma ya no corresponde) → inválida; los datos de la imagen siguen igual
{
  const u = rd("c2pa_out.jpg").slice(), at = Buffer.from(u).indexOf("Realify C2PA test");   // el generador va dentro de la reclamación firmada
  assert.ok(at > 0); u[at + 1] = "a".charCodeAt(0);
  const r = await readC2pa(u), m = r.manifests.find(x => x.active);
  assert.equal(m.verify.signature, "invalid", "un manifiesto alterado debe dar firma inválida");
  assert.equal(m.hash.status, "match", "los datos de la imagen no se tocaron");
}
// cadena rota: se estropea la firma del certificado intermedio dentro del archivo
{
  const pem = fs.readFileSync(`${D}/es256_certs.pem`, "utf8").split("-----END CERTIFICATE-----").filter(x => x.includes("BEGIN"));
  const inter = Buffer.from(pem[1].replace(/-----BEGIN CERTIFICATE-----|\s/g, ""), "base64"), u = rd("c2pa_out.jpg").slice(), at = Buffer.from(u).indexOf(inter);
  assert.ok(at > 0, "el certificado intermedio está en el archivo");
  u[at + inter.length - 3] ^= 0x55;                                       // la firma del intermedio (lo firma la raíz, que no va en el archivo): se detecta si es el que firma al hoja
  const first = Buffer.from(pem[0].replace(/-----BEGIN CERTIFICATE-----|\s/g, ""), "base64"), at0 = Buffer.from(u).indexOf(first);
  u[at0 + first.length - 3] ^= 0x55;                                      // la firma de la hoja (la firma el intermedio): la cadena queda rota
  const r = await readC2pa(u), m = r.manifests.find(x => x.active);
  assert.equal(m.verify.chain, "broken", "una firma de certificado alterada debe romper la cadena");
}
// AVIF y HEIC (hash BMFF)
for(const f of ["c2pa_out.avif", "c2pa_out.heic"]){
  if(!fs.existsSync(`${D}/${f}`)) { console.log("(sin", f, ")"); continue; }
  const u = rd(f), r = await readC2pa(u), m = r.manifests.find(x => x.active);
  assert.ok(["AVIF", "HEIC"].includes(r.container), f + " contenedor " + r.container);
  assert.equal(m.hash.status, "match", f + ": hash BMFF"); assert.equal(m.verify.signature, "valid", f + ": firma");
  const t = u.slice(); t[t.length - 3] ^= 1; assert.equal((await readC2pa(t)).manifests.find(x => x.active).hash.status, "mismatch", f + ": alterado");
}
const t = await readC2pa(rd("c2pa_tamper.jpg"));
console.log("alterado:", t.manifests.find(x => x.active).hash);
assert.equal(t.manifests.find(x => x.active).hash.status, "mismatch");
assert.equal(await readC2pa(new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9])), null);
console.log("OK");
