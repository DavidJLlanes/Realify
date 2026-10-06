/* Metadatos en OpenEXR (v257): atributos estándar owner, comments, capDate, latitude y longitude en la cabecera; el resto de la cabecera sigue siendo válido. Uso: node tests/exr-meta.mjs */
import assert from "node:assert/strict";
import { encodeExr } from "../js/io/exr.js";
const W = 8, H = 4, line = (y, R, G, B) => { for(let x = 0; x < W; x++){ R[x] = x / W; G[x] = y / H; B[x] = .5; } };
const blob = await encodeExr({ width: W, height: H, getLine: line, space: "srgb", meta: { owner: "Ana · © Ana 2026", comments: "Título — descripción", capDate: "2026:05:03 18:30:00", latitude: 40.5, longitude: -3.25 } });
const u = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(u.buffer);
assert.deepEqual([...u.subarray(0, 4)], [0x76, 0x2f, 0x31, 0x01], "número mágico");
const attrs = {}; let o = 8;
const cstr = () => { let e = o; while(u[e] !== 0) e++; const s = new TextDecoder().decode(u.subarray(o, e)); o = e + 1; return s; };
while(u[o] !== 0){ const name = cstr(), type = cstr(), size = dv.getInt32(o, true); o += 4; attrs[name] = { type, bytes: u.subarray(o, o + size) }; o += size; }
const txt = n => new TextDecoder().decode(attrs[n].bytes), f32 = n => dv.getFloat32(attrs[n].bytes.byteOffset, true);
assert.equal(txt("owner"), "Ana · © Ana 2026"); assert.equal(attrs.owner.type, "string");
assert.equal(txt("comments"), "Título — descripción"); assert.equal(txt("capDate"), "2026:05:03 18:30:00");
assert.ok(Math.abs(f32("latitude") - 40.5) < 1e-6 && Math.abs(f32("longitude") + 3.25) < 1e-6); assert.equal(attrs.latitude.type, "float");
for(const need of ["channels", "chromaticities", "compression", "dataWindow", "displayWindow", "lineOrder", "pixelAspectRatio", "screenWindowCenter", "screenWindowWidth"]) assert.ok(attrs[need], "falta " + need);
// sin metadatos: la cabecera no lleva ninguno de ellos
const plain = new Uint8Array(await (await encodeExr({ width: W, height: H, getLine: line })).arrayBuffer());
assert.ok(!Buffer.from(plain).includes("owner") && !Buffer.from(plain).includes("capDate"), "sin metadatos no hay atributos extra");
console.log("exr-meta: OK");
