/* ═══════════════════════════════════════════════════════════════
   FIRMAR CON CREDENCIALES DE CONTENIDO (C2PA) AL EXPORTAR (v255)
   Escribe un manifiesto C2PA nuevo en un JPEG, un PNG, un AVIF o un HEIC ya exportado, firmado con el certificado y la clave privada que aporta la
   persona (cadena PEM + clave PKCS#8 PEM; ES256/384/512, PS256 o Ed25519). Va lo último: cualquier cambio posterior de los píxeles lo invalidaría.
   Qué lleva: acciones (c2pa.created con la fuente digital elegida), el hash de los datos del archivo (hash.data, o hash BMFF en AVIF/HEIC) y, si se
   quiere, autor y copyright (schema.org CreativeWork). Las credenciales que trajera el original NO se conservan (no se reescriben ingredientes).
   Qué NO garantiza: que un verificador confíe en tu certificado (hace falta uno de la lista de confianza de C2PA); un certificado propio sale como
   «emisor desconocido» pero con firma válida. La clave privada sólo vive en la memoria de la pestaña. Se comprueba el resultado con el lector
   (`verifySignature`) antes de entregarlo. Comprobado con c2pa-python (tests/c2pa-firma.mjs).
   ═══════════════════════════════════════════════════════════════ */
import { verifySignature, readC2pa } from "./c2pa.js";

const te = new TextEncoder();
const cat = parts => { let n = 0; for(const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for(const p of parts){ out.set(p, o); o += p.length; } return out; };
const u32 = n => Uint8Array.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const hex = h => Uint8Array.from(h.match(/../g).map(x => parseInt(x, 16)));
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const sha = async (name, data) => new Uint8Array(await crypto.subtle.digest(name, data));
const ascii = (u, i, n) => String.fromCharCode(...u.subarray(i, i + n));

/* ── CBOR (RFC 8949): lo que hace falta para el manifiesto ───────────────────── */
function head(major, n){
  if(n < 24) return [major << 5 | n];
  if(n < 256) return [major << 5 | 24, n];
  if(n < 65536) return [major << 5 | 25, n >> 8, n & 255];
  if(n < 4294967296) return [major << 5 | 26, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const out = [major << 5 | 27]; let v = BigInt(n); for(let s = 56n; s >= 0n; s -= 8n) out.push(Number((v >> s) & 255n)); return out;
}
/** Valores: número entero o decimal, texto, Uint8Array (bytes), booleano, null, Array, Map (claves cualesquiera) u objeto (claves de texto, en su orden). */
export function cborEncode(v){
  if(v === null || v === undefined) return Uint8Array.of(0xF6);
  if(v === true) return Uint8Array.of(0xF5);
  if(v === false) return Uint8Array.of(0xF4);
  if(typeof v === "number"){
    if(Number.isInteger(v)) return Uint8Array.from(v >= 0 ? head(0, v) : head(1, -1 - v));
    const o = new Uint8Array(9); o[0] = 0xFB; new DataView(o.buffer).setFloat64(1, v); return o;
  }
  if(typeof v === "string"){ const b = te.encode(v); return cat([Uint8Array.from(head(3, b.length)), b]); }
  if(v instanceof Uint8Array) return cat([Uint8Array.from(head(2, v.length)), v]);
  if(Array.isArray(v)) return cat([Uint8Array.from(head(4, v.length)), ...v.map(cborEncode)]);
  if(v && typeof v === "object" && "__tag" in v) return cat([Uint8Array.from(head(6, v.__tag)), cborEncode(v.value)]);
  const entries = v instanceof Map ? [...v] : Object.entries(v);
  return cat([Uint8Array.from(head(5, entries.length)), ...entries.flatMap(([k, x]) => [cborEncode(k), cborEncode(x)])]);
}

/* ── JUMBF (ISO 19566-5): cajas y superboxes ─────────────────────────────────── */
const box = (type, payload) => cat([u32(8 + payload.length), te.encode(type), payload]);
const UUID = { c2pa: "6332706100110010800000aa00389b71", manifest: "63326d6100110010800000aa00389b71", assertions: "6332617300110010800000aa00389b71",
  claim: "6332636c00110010800000aa00389b71", signature: "6332637300110010800000aa00389b71", cbor: "63626f7200110010800000aa00389b71", json: "6a736f6e00110010800000aa00389b71" };
const jumd = (uuid, label) => box("jumd", cat([hex(UUID[uuid]), Uint8Array.of(0x03), te.encode(label), Uint8Array.of(0)]));
const superbox = (uuid, label, children) => box("jumb", cat([jumd(uuid, label), ...children]));

/* ── credenciales ────────────────────────────────────────────────────────────── */
const pemBlocks = (text, kind) => [...text.matchAll(new RegExp(`-----BEGIN ${kind}-----([\\s\\S]*?)-----END ${kind}-----`, "g"))].map(m => b64(m[1].replace(/\s+/g, "")));
const SIGNERS = [
  { alg: -7, name: "ES256", imp: { name: "ECDSA", namedCurve: "P-256" }, sign: { name: "ECDSA", hash: "SHA-256" } },
  { alg: -35, name: "ES384", imp: { name: "ECDSA", namedCurve: "P-384" }, sign: { name: "ECDSA", hash: "SHA-384" } },
  { alg: -36, name: "ES512", imp: { name: "ECDSA", namedCurve: "P-521" }, sign: { name: "ECDSA", hash: "SHA-512" } },
  { alg: -37, name: "PS256", imp: { name: "RSA-PSS", hash: "SHA-256" }, sign: { name: "RSA-PSS", saltLength: 32 } },
  { alg: -38, name: "PS384", imp: { name: "RSA-PSS", hash: "SHA-384" }, sign: { name: "RSA-PSS", saltLength: 48 } },
  { alg: -39, name: "PS512", imp: { name: "RSA-PSS", hash: "SHA-512" }, sign: { name: "RSA-PSS", saltLength: 64 } },
  { alg: -8, name: "Ed25519", imp: { name: "Ed25519" }, sign: { name: "Ed25519" } }
];
/** Lee la cadena de certificados (PEM, el del firmante primero) y la clave privada (PKCS#8 PEM, «BEGIN PRIVATE KEY»). Devuelve { chain, key, signer } o lanza un Error con el motivo. */
export async function loadCredentials(certText, keyText){
  const chain = pemBlocks(certText, "CERTIFICATE");
  if(!chain.length) throw new Error("El archivo de certificados no contiene ningún «BEGIN CERTIFICATE»");
  const keys = pemBlocks(keyText, "PRIVATE KEY");
  if(!keys.length) throw new Error(/BEGIN (EC|RSA) PRIVATE KEY/.test(keyText) ? "La clave está en formato antiguo (SEC1/PKCS#1): conviértela a PKCS#8 («openssl pkcs8 -topk8 -nocrypt»)" : /ENCRYPTED/.test(keyText) ? "La clave está cifrada con contraseña: usa una sin cifrar (PKCS#8)" : "El archivo de clave no contiene ningún «BEGIN PRIVATE KEY»");
  let key = null, signer = null;
  for(const s of SIGNERS){ try{ key = await crypto.subtle.importKey("pkcs8", keys[0], s.imp, false, ["sign"]); signer = s; break; }catch{ /* otro tipo de clave */ } }
  if(!key) throw new Error("No se pudo leer la clave privada (se admiten ES256/384/512, PS256/384/512 y Ed25519 en PKCS#8)");
  return { chain, key, signer };
}

/* ── manifiesto ──────────────────────────────────────────────────────────────── */
const SOURCES = { creation: "digitalCreation", composite: "composite", ai: "trainedAlgorithmicMedia" };
const uuid4 = () => crypto.randomUUID();
const MIME = { jpeg: "image/jpeg", png: "image/png", avif: "image/avif", heic: "image/heic" };

/** Manifiesto (superbox c2pa) firmado; `dataHash` es el hash.data (o BMFF) ya completo. */
async function buildManifest(creds, info, hashAssertion){
  const generator = info.generator || "Realify", version = String(info.version || "");
  const actions = { actions: [{ action: "c2pa.created", digitalSourceType: `http://cv.iptc.org/newscodes/digitalsourcetype/${SOURCES[info.source] || SOURCES.creation}`, softwareAgent: version ? `${generator}/${version}` : generator, when: info.when }] };
  const assertions = [{ label: "c2pa.actions", box: box("cbor", cborEncode(actions)), uuid: "cbor" }];
  if(info.author || info.copyright){
    const cw = { "@context": "http://schema.org/", "@type": "CreativeWork" };
    if(info.author) cw.author = [{ "@type": "Person", name: info.author }];
    if(info.copyright) cw.copyrightNotice = info.copyright;
    assertions.push({ label: "stds.schema-org.CreativeWork", box: box("json", te.encode(JSON.stringify(cw))), uuid: "json" });
  }
  assertions.push({ label: hashAssertion.label, box: box("cbor", cborEncode(hashAssertion.data)), uuid: "cbor" });
  const supers = assertions.map(a => superbox(a.uuid, a.label, [a.box]));
  const refs = [];
  for(const [i, a] of assertions.entries()){                       // hash de cada aserción = SHA-256 del contenido de su superbox (descripción + datos)
    const content = cat([jumd(a.uuid, a.label), a.box]);
    refs.push({ url: `self#jumbf=c2pa.assertions/${a.label}`, hash: await sha("SHA-256", content) });
  }
  const label = `urn:uuid:${uuid4()}`;
  const claim = { claim_generator: version ? `${generator}/${version}` : generator, claim_generator_info: [{ name: generator, ...(version ? { version } : {}) }],
    "dc:title": info.title || "Sin título", "dc:format": MIME[info.format], instanceID: `xmp:iid:${uuid4()}`, signature: "self#jumbf=c2pa.signature", assertions: refs, alg: "sha256" };
  const claimBytes = cborEncode(claim);
  const x5 = creds.chain.length === 1 ? creds.chain[0] : creds.chain;
  const protectedBytes = cborEncode(new Map([[1, creds.signer.alg], [33, x5]]));            // C2PA lleva la cadena (x5chain, 33) en la cabecera protegida
  const sigStruct = cat([Uint8Array.of(0x84, 0x6A), te.encode("Signature1"), cborEncode(protectedBytes), Uint8Array.of(0x40), cborEncode(claimBytes)]);
  const signature = new Uint8Array(await crypto.subtle.sign(creds.signer.sign, creds.key, sigStruct));
  const cose = cat([Uint8Array.of(0xD2), cborEncode([protectedBytes, new Map([["pad", new Uint8Array(0)]]), null, signature])]);
  const manifest = superbox("manifest", label, [superbox("assertions", "c2pa.assertions", supers), superbox("claim", "c2pa.claim", [box("cbor", cborEncode(claim))]), superbox("signature", "c2pa.signature", [box("cbor", cose)])]);
  return { store: superbox("c2pa", "c2pa", [manifest]), cose, claimBytes };
}

/* ── contenedores ────────────────────────────────────────────────────────────── */
const crcTable = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u => { let c = 0xFFFFFFFF; for(let i = 0; i < u.length; i++) c = crcTable[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

/** JPEG: la caja JUMBF en segmentos APP11 («JP», instancia, número de paquete) justo tras SOI; los paquetes siguientes repiten LBox y TBox. */
function jpegSegments(store){
  const MAX = 65535 - 2 - 8, segs = [];
  let pos = 0, z = 1;
  while(pos < store.length){
    const room = z === 1 ? MAX : MAX - 8, chunk = store.subarray(pos, pos + room);
    pos += chunk.length;
    const payload = z === 1 ? chunk : cat([store.subarray(0, 8), chunk]);
    const len = 2 + 8 + payload.length;
    segs.push(cat([Uint8Array.of(0xFF, 0xEB, len >> 8, len & 255, 0x4A, 0x50, 0x02, 0x11), u32(z), payload]));
    z++;
  }
  return cat(segs);
}
const pngChunk = (type, payload) => { const body = cat([te.encode(type), payload]); return cat([u32(payload.length), body, u32(crc32(body))]); };
function bmffBoxes(u){
  const out = []; let o = 0;
  while(o + 8 <= u.length){
    let size = new DataView(u.buffer, u.byteOffset + o, 4).getUint32(0), hdr = 8;
    const type = ascii(u, o + 4, 4);
    if(size === 1){ size = Number(new DataView(u.buffer, u.byteOffset + o + 8, 8).getBigUint64(0)); hdr = 16; } else if(size === 0) size = u.length - o;
    if(size < hdr || o + size > u.length) return null;
    out.push({ type, start: o, end: o + size }); o += size;
  }
  return out;
}
const C2PA_UUID = hex("d8fec3d61b0e483c92975828877ec481");

/** Firma `blob` (JPEG, PNG, AVIF o HEIC) con `creds` (de loadCredentials); `info`: { title, author, copyright, source: "creation"|"composite"|"ai", version }.
    Devuelve { blob, container } o lanza un Error. */
export async function signC2pa(blob, creds, info = {}){
  const u = new Uint8Array(await blob.arrayBuffer());
  let kind = null;
  if(u[0] === 0xFF && u[1] === 0xD8) kind = "jpeg";
  else if(u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4E && u[3] === 0x47) kind = "png";
  else if(ascii(u, 4, 4) === "ftyp") kind = /^avi[fs]$/.test(ascii(u, 8, 4)) ? "avif" : /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(ascii(u, 8, 4)) ? "heic" : null;
  if(!kind) throw new Error("Este formato no admite credenciales de contenido (JPEG, PNG, AVIF y HEIC sí)");
  if((await readC2pa(u).catch(() => null))?.manifests?.length) throw new Error("El archivo ya lleva credenciales de contenido y no se reescriben");
  const meta = { ...info, format: kind, when: new Date().toISOString().replace(/\.\d+Z$/, "Z") };
  let at, lenGuess = 0, built, out;
  if(kind === "jpeg" || kind === "png"){
    // posición del manifiesto: tras SOI (JPEG) o tras IHDR (PNG); lo excluido del hash es el segmento/trozo completo, así que el hash es el del archivo original
    at = kind === "jpeg" ? 2 : 8 + 12 + new DataView(u.buffer, u.byteOffset + 8, 4).getUint32(0);
    const hash = await sha("SHA-256", u);
    for(let i = 0; i < 5; i++){
      built = await buildManifest(creds, meta, { label: "c2pa.hash.data", data: { exclusions: [{ start: at, length: lenGuess }], name: "jumbf manifest", alg: "sha256", hash, pad: new Uint8Array(0) } });
      const part = kind === "jpeg" ? jpegSegments(built.store) : pngChunk("caBX", built.store);
      if(part.length === lenGuess){ out = cat([u.subarray(0, at), part, u.subarray(at)]); break; }
      lenGuess = part.length;
    }
  } else {
    // BMFF: caja «uuid» de C2PA al final del archivo (no mueve los desplazamientos de los datos); hash = SHA-2 de (desplazamiento ‖ caja) de las cajas de primer nivel que no se excluyen
    const boxes = bmffBoxes(u);
    if(!boxes) throw new Error("Estructura de cajas no válida");
    const parts = [];
    for(const b of boxes){ if(["ftyp", "mfra", "free", "skip"].includes(b.type)) continue; if(b.type === "uuid" && u.subarray(b.start + 8, b.start + 24).every((v, k) => v === C2PA_UUID[k])) continue; const off = new Uint8Array(8); new DataView(off.buffer).setBigUint64(0, BigInt(b.start)); parts.push(off, u.subarray(b.start, b.end)); }
    const hash = await sha("SHA-256", cat(parts));
    built = await buildManifest(creds, meta, { label: "c2pa.hash.bmff.v3", data: { exclusions: [{ xpath: "/uuid", data: [{ offset: 8, value: C2PA_UUID }] }, { xpath: "/ftyp" }, { xpath: "/mfra" }, { xpath: "/free" }, { xpath: "/skip" }], alg: "sha256", hash, name: "jumbf manifest" } });
    const payload = cat([Uint8Array.of(0, 0, 0, 0), te.encode("manifest"), Uint8Array.of(0), new Uint8Array(8), built.store]);
    out = cat([u, box("uuid", cat([C2PA_UUID, payload]))]);
  }
  if(!out) throw new Error("No se pudo calcular el tamaño del manifiesto");
  // se comprueba lo escrito con el propio lector: firma válida (la clave corresponde al certificado), hash coincidente
  const back = await readC2pa(out), m = back && back.manifests.find(x => x.active);
  if(!m) throw new Error("El manifiesto escrito no se pudo leer de nuevo");
  if(!m.verify || m.verify.signature !== "valid") throw new Error("La clave privada no corresponde al certificado (la firma no se verifica)");
  if(!m.hash || m.hash.status !== "match") throw new Error("El hash de los datos no coincide: no se entrega un archivo con credenciales rotas");
  return { blob: new Blob([out], { type: blob.type }), container: kind, signer: creds.signer.name, chain: m.verify.chain };
}
