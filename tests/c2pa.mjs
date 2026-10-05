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
}
const t = await readC2pa(rd("c2pa_tamper.jpg"));
console.log("alterado:", t.manifests.find(x => x.active).hash);
assert.equal(t.manifests.find(x => x.active).hash.status, "mismatch");
assert.equal(await readC2pa(new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9])), null);
console.log("OK");
