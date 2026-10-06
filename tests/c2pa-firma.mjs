/* Firma C2PA al exportar (js/exif/c2pasign.js): firma un JPEG, un PNG, un AVIF y un HEIC con los certificados de prueba de c2pa-python y deja los archivos en /tmp/sc/out
   para que tests/c2pa_firma_check.py (c2pa-python, el verificador de referencia) los valide. Uso: node tests/c2pa-firma.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(), errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const certs = fs.readFileSync("/tmp/sc/es256_certs.pem", "utf8"), key = fs.readFileSync("/tmp/sc/es256_private.key", "utf8");
const avif = fs.readFileSync("/tmp/sc/c2pa_in.avif").toString("base64"), heic = fs.readFileSync("/tmp/sc/c2pa_in.heic").toString("base64");
const res = await page.evaluate(async ({ certs, key, avif, heic }) => {
  const S = await import("/js/exif/c2pasign.js"), R = await import("/js/exif/c2pa.js");
  const toB64 = async u => { let s = ""; for(let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
  const cv = document.createElement("canvas"); cv.width = 80; cv.height = 60; const x = cv.getContext("2d"); const g = x.createLinearGradient(0, 0, 80, 60); g.addColorStop(0, "#fa0"); g.addColorStop(1, "#06c"); x.fillStyle = g; x.fillRect(0, 0, 80, 60);
  const blobOf = t => new Promise(r => cv.toBlob(r, t, .9)), fromB64 = s => new Blob([Uint8Array.from(atob(s), c => c.charCodeAt(0))]);
  const creds = await S.loadCredentials(certs, key), out = { signer: creds.signer.name, chain: creds.chain.length };
  const info = { title: "Foto firmada", author: "Ana Firmante", copyright: "© Ana 2026", source: "composite", version: "255" };
  const inputs = { jpg: await blobOf("image/jpeg"), png: await blobOf("image/png"), avif: fromB64(avif), heic: fromB64(heic) };
  out.files = {}; out.info = {};
  for(const [k, bl] of Object.entries(inputs)){
    const r = await S.signC2pa(bl, creds, info); out.files[k] = await toB64(new Uint8Array(await r.blob.arrayBuffer()));
    const back = await R.readC2pa(new Uint8Array(await r.blob.arrayBuffer())), m = back.manifests[0];
    out.info[k] = { c: back.container, firma: m.verify.signature, cadena: m.verify.chain, hash: m.hash.status, titulo: m.claim.title, autor: m.authors, acciones: m.actions.map(a => a.action + ":" + a.sourceType) };
  }
  // un manifiesto grande se parte en varios segmentos APP11
  const big = { ...info, copyright: "x".repeat(150000) };
  const rb = await S.signC2pa(inputs.jpg, creds, big); out.files.big = await toB64(new Uint8Array(await rb.blob.arrayBuffer()));
  const backBig = await R.readC2pa(new Uint8Array(await rb.blob.arrayBuffer())); out.big = { firma: backBig.manifests[0].verify.signature, hash: backBig.manifests[0].hash.status, size: rb.blob.size };
  // errores
  try{ await S.signC2pa(new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])]), creds, info); out.errFormato = false; }catch(e){ out.errFormato = e.message; }
  try{ await S.signC2pa(new Blob([Uint8Array.from(atob(out.files.jpg), c => c.charCodeAt(0))]), creds, info); out.errYa = false; }catch(e){ out.errYa = e.message; }
  try{ await S.loadCredentials("nada", key); }catch(e){ out.errCert = e.message; }
  try{ await S.loadCredentials(certs, "-----BEGIN EC PRIVATE KEY-----\nAAAA\n-----END EC PRIVATE KEY-----"); }catch(e){ out.errClave = e.message; }
  // clave que no corresponde al certificado
  const other = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]), pk = new Uint8Array(await crypto.subtle.exportKey("pkcs8", other.privateKey));
  const pem = "-----BEGIN PRIVATE KEY-----\n" + btoa(String.fromCharCode(...pk)).match(/.{1,64}/g).join("\n") + "\n-----END PRIVATE KEY-----";
  try{ await S.signC2pa(inputs.jpg, await S.loadCredentials(certs, pem), info); out.errClaveAjena = false; }catch(e){ out.errClaveAjena = e.message; }
  return out;
}, { certs, key, avif, heic });
fs.mkdirSync("/tmp/sc/out", { recursive: true });
for(const [k, v] of Object.entries(res.files)) fs.writeFileSync(`/tmp/sc/out/firma.${k === "big" ? "big.jpg" : k === "jpg" ? "jpg" : k}`, Buffer.from(v, "base64"));
const small = { ...res }; delete small.files; console.log(JSON.stringify(small, null, 1).slice(0, 1800));
const okk = ["jpg", "png", "avif", "heic"].every(k => res.info[k].firma === "valid" && res.info[k].hash === "match" && res.info[k].titulo === "Foto firmada" && res.info[k].autor[0] === "Ana Firmante" && res.info[k].acciones[0] === "c2pa.created:composite")
  && res.big.firma === "valid" && res.big.hash === "match" && res.errFormato && res.errYa && res.errCert && res.errClave && /no corresponde al certificado/.test(res.errClaveAjena);
console.log(okk && !errs.length ? "OK (falta c2pa_firma_check.py)" : "FALLO", errs.join("|")); await b.close(); srv.close(); process.exit(okk && !errs.length ? 0 : 1);
